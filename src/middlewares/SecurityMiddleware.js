const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Logger = require('../utils/Logger');

/**
 * Middleware de segurança centralizado
 * Aplica SRP - responsável apenas por validações de segurança
 */
class SecurityMiddleware {
    constructor() {
        this.rateLimiter = new RateLimiter();
        this.csrfProtection = new CSRFProtection();
        this.logger = new Logger('SecurityMiddleware');
    }

    /**
     * Rate limiting por IP e tipo de requisição
     */
    rateLimit() {
        return (req, res, next) => {
            try {
                const clientId = this._getClientId(req);
                const type = req.file ? 'upload' : 'request';

                const result = this.rateLimiter.checkRequest(clientId, type);

                res.set({
                    'X-RateLimit-Remaining': result.remaining,
                    'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
                });

                next();
            } catch (error) {
                this._handleRateLimitError(error, res);
            }
        };
    }

    /**
     * Validação segura de uploads
     */
    secureUpload() {
        return (req, res, next) => {
            if (!req.file) return next();

            try {
                SecurityValidator.validateUpload(req.file);
                this.logger.info('File upload validated', {
                    filename: req.file.filename,
                    size: req.file.size,
                    mimetype: req.file.mimetype
                });
                next();
            } catch (error) {
                this._cleanupUploadedFile(req.file);
                res.status(400).json({ error: error.message });
            }
        };
    }

    /**
     * Proteção CSRF para formulários
     */
    csrfProtection() {
        return (req, res, next) => {
            if (req.method === 'GET') {
                req.csrfToken = this.csrfProtection.generateToken(req.sessionID || req.ip);
                return next();
            }

            try {
                const token = req.body._csrf || req.headers['x-csrf-token'];
                this.csrfProtection.validateToken(token, req.sessionID || req.ip);
                next();
            } catch (error) {
                this.logger.warn('CSRF validation failed', {
                    ip: req.ip,
                    path: req.path,
                    error: error.message
                });
                res.status(403).json({ error: 'CSRF validation failed' });
            }
        };
    }

    /**
     * Sanitização de parâmetros de entrada
     */
    sanitizeRequest() {
        return (req, res, next) => {
            // Sanitiza query parameters
            for (const key in req.query) {
                if (typeof req.query[key] === 'string') {
                    req.query[key] = this._sanitizeString(req.query[key]);
                }
            }

            // Sanitiza body parameters
            for (const key in req.body) {
                if (typeof req.body[key] === 'string') {
                    req.body[key] = this._sanitizeString(req.body[key]);
                }
            }

            // Sanitiza path parameters
            for (const key in req.params) {
                if (typeof req.params[key] === 'string') {
                    req.params[key] = this._sanitizeString(req.params[key]);
                }
            }

            next();
        };
    }

    /**
     * Headers de segurança
     */
    securityHeaders() {
        return (req, res, next) => {
            res.set({
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com;"
            });
            next();
        };
    }

    // Métodos privados
    _getClientId(req) {
        return req.ip + (req.user?.id || '') + (req.sessionID || '');
    }

    _handleRateLimitError(error, res) {
        if (error instanceof RateLimitError) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                resetTime: error.resetTime,
                retryAfter: Math.ceil((error.resetTime - Date.now()) / 1000)
            });
        }
        throw error;
    }

    _cleanupUploadedFile(file) {
        if (file && file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            this.logger.info('Cleaned up invalid upload', { path: file.path });
        }
    }

    _sanitizeString(str) {
        return str
            .replace(/[<>\"'&]/g, '') // Remove HTML/script chars
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
            .trim()
            .substring(0, 1000); // Limit length
    }
}

/**
 * Validador de segurança
 */
class SecurityValidator {
    /**
     * Validação de path seguro
     */
    static validateFilePath(filename, baseDir = 'output') {
        if (!filename || typeof filename !== 'string') {
            throw new SecurityError('Invalid filename');
        }

        // Blacklist de caracteres perigosos
        const forbidden = ['..', '/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0', '\n', '\r'];
        if (forbidden.some(char => filename.includes(char))) {
            throw new SecurityError('Path traversal attempt detected');
        }

        // Whitelist restritiva
        if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
            throw new SecurityError('Filename contains illegal characters');
        }

        // Verificação de extensão
        const allowedExtensions = ['.mp4', '.mov', '.avi', '.png', '.svg', '.webm'];
        if (!allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext))) {
            throw new SecurityError('File extension not allowed');
        }

        // Path resolution seguro
        const safePath = path.resolve(baseDir, path.basename(filename));
        const baseResolved = path.resolve(baseDir);

        if (!safePath.startsWith(baseResolved)) {
            throw new SecurityError('Directory traversal blocked');
        }

        return safePath;
    }

    /**
     * Sanitização de filtros FFmpeg
     */
    static sanitizeFFmpegFilter(filter) {
        if (!filter || typeof filter !== 'string') return '';

        // Remove caracteres perigosos
        const dangerous = [';', '&', '|', '`', '$', '(', ')', '{', '}', '[', ']', '\\', '\n', '\r', '"', "'"];
        let sanitized = filter;

        dangerous.forEach(char => {
            sanitized = sanitized.replace(new RegExp('\\' + char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
        });

        // Whitelist de filtros FFmpeg seguros
        const allowedFilters = [
            'overlay', 'scale', 'format', 'colorchannelmixer',
            'pad', 'crop', 'drawtext', 'drawbox', 'fade'
        ];

        const filterName = sanitized.split('=')[0].split(':')[0];
        if (!allowedFilters.includes(filterName)) {
            throw new SecurityError(`Filter '${filterName}' not allowed`);
        }

        return sanitized.substring(0, 500); // Limit length
    }

    /**
     * Validação de upload
     */
    static validateUpload(file) {
        if (!file) throw new SecurityError('No file provided');

        // Size limits
        const MAX_SIZE = 500 * 1024 * 1024; // 500MB
        if (file.size > MAX_SIZE) {
            throw new SecurityError('File exceeds maximum size (500MB)');
        }

        // MIME type validation
        const allowedMimes = [
            'video/mp4', 'video/quicktime', 'video/x-msvideo',
            'video/mpeg', 'video/x-ms-wmv', 'video/webm'
        ];

        if (!allowedMimes.includes(file.mimetype)) {
            throw new SecurityError('File type not allowed');
        }

        // Filename validation
        this.validateFilePath(file.filename);

        return true;
    }
}

/**
 * Rate Limiter
 */
class RateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 min
        this.maxRequests = options.max || 20;
        this.maxUploads = options.uploads || 5;
        this.clients = new Map();

        // Auto-cleanup a cada hora
        setInterval(() => this._cleanup(), 60 * 60 * 1000);
    }

    checkRequest(clientId, type = 'request') {
        const now = Date.now();
        const client = this.clients.get(clientId) || this._createClient(now);

        if (now > client.resetTime) {
            this._resetClient(client, now);
        }

        const limit = type === 'upload' ? this.maxUploads : this.maxRequests;
        const current = client[type + 's'] || 0;

        if (current >= limit) {
            throw new RateLimitError(`Too many ${type}s`, client.resetTime);
        }

        client[type + 's'] = current + 1;
        this.clients.set(clientId, client);

        return {
            remaining: limit - (current + 1),
            resetTime: client.resetTime
        };
    }

    _createClient(now) {
        return {
            requests: 0,
            uploads: 0,
            resetTime: now + this.windowMs
        };
    }

    _resetClient(client, now) {
        client.requests = 0;
        client.uploads = 0;
        client.resetTime = now + this.windowMs;
    }

    _cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, client] of this.clients) {
            if (now > client.resetTime + this.windowMs) {
                this.clients.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`RateLimiter: cleaned ${cleaned} expired entries`);
        }
    }
}

/**
 * Proteção CSRF
 */
class CSRFProtection {
    constructor() {
        this.tokens = new Map();
        this.tokenTTL = 3600000; // 1 hour

        // Cleanup tokens expirados
        setInterval(() => this._cleanup(), 15 * 60 * 1000);
    }

    generateToken(sessionId) {
        const token = crypto.randomBytes(32).toString('hex');
        this.tokens.set(token, {
            sessionId,
            expires: Date.now() + this.tokenTTL,
            used: false
        });
        return token;
    }

    validateToken(token, sessionId) {
        const tokenData = this.tokens.get(token);

        if (!tokenData) {
            throw new SecurityError('Invalid CSRF token');
        }

        if (Date.now() > tokenData.expires) {
            this.tokens.delete(token);
            throw new SecurityError('CSRF token expired');
        }

        if (tokenData.sessionId !== sessionId) {
            throw new SecurityError('CSRF token mismatch');
        }

        if (tokenData.used) {
            throw new SecurityError('CSRF token already used');
        }

        // Mark as used (single use)
        tokenData.used = true;
        return true;
    }

    _cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [token, data] of this.tokens) {
            if (now > data.expires || data.used) {
                this.tokens.delete(token);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`CSRFProtection: cleaned ${cleaned} expired tokens`);
        }
    }
}

/**
 * Classes de erro
 */
class SecurityError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SecurityError';
        this.status = 400;
    }
}

class RateLimitError extends Error {
    constructor(message, resetTime) {
        super(message);
        this.name = 'RateLimitError';
        this.status = 429;
        this.resetTime = resetTime;
    }
}

module.exports = {
    SecurityMiddleware,
    SecurityValidator,
    RateLimiter,
    CSRFProtection,
    SecurityError,
    RateLimitError
};