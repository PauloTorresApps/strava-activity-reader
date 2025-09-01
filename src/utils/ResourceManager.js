// ===========================================
// RESOURCE MANAGER - CORREÇÃO VAZAMENTOS
// ===========================================

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const Logger = require('../utils/Logger');

/**
 * Gerenciador de recursos críticos
 * Previne vazamentos de memória e processos órfãos
 */
class ResourceManager {
    constructor() {
        this.activeProcesses = new Map();
        this.tempFiles = new Set();
        this.maxProcesses = 2;
        this.processTimeout = 300000; // 5 min
        this.cleanupInterval = 60000; // 1 min
        this.logger = new Logger('ResourceManager');

        this._startCleanupTimer();
        this._setupGracefulShutdown();
    }

    /**
     * Executa FFmpeg com controle rigoroso de recursos
     */
    async executeFFmpeg(inputPath, outputPath, options = {}) {
        if (this.activeProcesses.size >= this.maxProcesses) {
            throw new Error('Resource limit: Too many active processes');
        }

        const processId = this._generateProcessId();
        const timeout = options.timeout || this.processTimeout;

        try {
            return await this._runFFmpegProcess(processId, inputPath, outputPath, options, timeout);
        } finally {
            this.activeProcesses.delete(processId);
        }
    }

    /**
     * Registra arquivo temporário para cleanup automático
     */
    registerTempFile(filePath) {
        this.tempFiles.add(filePath);
        this.logger.debug('Temp file registered', { path: filePath });
    }

    /**
     * Remove arquivo temporário
     */
    async cleanupTempFile(filePath) {
        try {
            await fs.unlink(filePath);
            this.tempFiles.delete(filePath);
            this.logger.debug('Temp file cleaned', { path: filePath });
        } catch (error) {
            // Arquivo já não existe - OK
            this.tempFiles.delete(filePath);
        }
    }

    /**
     * Força término de processo
     */
    killProcess(processId) {
        const processInfo = this.activeProcesses.get(processId);
        if (processInfo) {
            processInfo.process.kill('SIGKILL');
            this.activeProcesses.delete(processId);
            this.logger.warn('Process force killed', { processId });
        }
    }

    /**
     * Status atual dos recursos
     */
    getResourceStatus() {
        return {
            activeProcesses: this.activeProcesses.size,
            tempFiles: this.tempFiles.size,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime()
        };
    }

    // Métodos privados
    async _runFFmpegProcess(processId, inputPath, outputPath, options, timeout) {
        return new Promise((resolve, reject) => {
            const args = this._buildFFmpegArgs(inputPath, outputPath, options);
            const process = spawn('ffmpeg', args, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // Timeout rigoroso
            const timer = setTimeout(() => {
                process.kill('SIGKILL');
                reject(new Error('FFmpeg timeout exceeded'));
            }, timeout);

            // Registra processo ativo
            this.activeProcesses.set(processId, {
                process,
                startTime: Date.now(),
                inputPath,
                outputPath
            });

            let stderr = '';

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                clearTimeout(timer);

                if (code === 0) {
                    this.logger.info('FFmpeg completed successfully', { processId, code });
                    resolve(outputPath);
                } else {
                    this.logger.error('FFmpeg failed', { processId, code, stderr });
                    reject(new Error(`FFmpeg failed with code ${code}`));
                }
            });

            process.on('error', (error) => {
                clearTimeout(timer);
                this.logger.error('FFmpeg process error', { processId, error: error.message });
                reject(error);
            });
        });
    }

    _buildFFmpegArgs(inputPath, outputPath, options) {
        const args = ['-y', '-i', inputPath];

        if (options.filters) {
            args.push('-filter_complex', options.filters);
        }

        if (options.codec) {
            args.push('-c:v', options.codec);
        } else {
            args.push('-c:v', 'libx264');
        }

        if (options.preset) {
            args.push('-preset', options.preset);
        } else {
            args.push('-preset', 'medium');
        }

        args.push(outputPath);
        return args;
    }

    _generateProcessId() {
        return `ffmpeg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    _startCleanupTimer() {
        setInterval(async () => {
            await this._performCleanup();
        }, this.cleanupInterval);
    }

    async _performCleanup() {
        // Limpa processos órfãos
        const now = Date.now();
        for (const [id, info] of this.activeProcesses) {
            if (now - info.startTime > this.processTimeout) {
                this.logger.warn('Killing orphaned process', { processId: id });
                info.process.kill('SIGKILL');
                this.activeProcesses.delete(id);
            }
        }

        // Limpa arquivos temporários antigos
        const tempArray = Array.from(this.tempFiles);
        for (const filePath of tempArray) {
            try {
                const stats = await fs.stat(filePath);
                const age = now - stats.mtime.getTime();

                // Remove arquivos com mais de 1 hora
                if (age > 3600000) {
                    await this.cleanupTempFile(filePath);
                }
            } catch (error) {
                // Arquivo não existe - remove da lista
                this.tempFiles.delete(filePath);
            }
        }

        this.logger.debug('Cleanup completed', {
            activeProcesses: this.activeProcesses.size,
            tempFiles: this.tempFiles.size
        });
    }

    _setupGracefulShutdown() {
        const cleanup = async () => {
            this.logger.info('Graceful shutdown initiated');

            // Mata todos os processos ativos
            for (const [id, info] of this.activeProcesses) {
                info.process.kill('SIGTERM');
            }

            // Aguarda 5s antes de força bruta
            setTimeout(() => {
                for (const [id, info] of this.activeProcesses) {
                    info.process.kill('SIGKILL');
                }
            }, 5000);

            // Remove arquivos temporários
            const cleanup = Array.from(this.tempFiles).map(file =>
                this.cleanupTempFile(file).catch(() => { })
            );
            await Promise.all(cleanup);

            this.logger.info('Shutdown complete');
            process.exit(0);
        };

        process.on('SIGTERM', cleanup);
        process.on('SIGINT', cleanup);
        process.on('SIGUSR2', cleanup); // Nodemon
    }
}

/**
 * Token Manager com persistência
 * Corrige perda de tokens em restart
 */
class PersistentTokenManager {
    constructor(storagePath = '.tokens.json') {
        this.storagePath = storagePath;
        this.logger = new Logger('PersistentTokenManager');
        this.tokens = this._loadTokens();
    }

    async setTokens(tokenData) {
        this.tokens = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: tokenData.expires_at,
            scope: tokenData.scope,
            savedAt: Date.now()
        };

        await this._saveTokens();

        this.logger.info('Tokens persisted', {
            expires_at: new Date(tokenData.expires_at * 1000).toISOString()
        });
    }

    getAccessToken() {
        return this.tokens?.access_token;
    }

    hasValidToken() {
        return !!(this.tokens?.access_token && !this.isTokenExpired());
    }

    isTokenExpired() {
        if (!this.tokens?.expires_at) return true;
        return this.tokens.expires_at < (Date.now() / 1000);
    }

    async refreshToken() {
        if (!this.tokens?.refresh_token) {
            throw new Error('No refresh token available');
        }

        try {
            const axios = require('axios');
            const Environment = require('../config/Environment');

            const response = await axios.post('https://www.strava.com/oauth/token', {
                client_id: Environment.STRAVA_CLIENT_ID,
                client_secret: Environment.STRAVA_CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: this.tokens.refresh_token,
            });

            await this.setTokens(response.data);
            this.logger.info('Token refreshed successfully');

            return response.data;
        } catch (error) {
            this.logger.error('Token refresh failed:', error);
            await this.clearTokens();
            throw new Error('Token refresh failed');
        }
    }

    async clearTokens() {
        this.tokens = {};
        await this._saveTokens();
        this.logger.info('Tokens cleared');
    }

    _loadTokens() {
        try {
            const fs = require('fs');
            if (fs.existsSync(this.storagePath)) {
                const data = fs.readFileSync(this.storagePath, 'utf8');
                const tokens = JSON.parse(data);

                // Verifica se tokens não estão muito antigos (30 dias)
                if (tokens.savedAt && Date.now() - tokens.savedAt < 30 * 24 * 60 * 60 * 1000) {
                    if (this.logger) {
                        this.logger.info('Tokens loaded from storage');
                    } else {
                        console.log('[PersistentTokenManager] Tokens loaded from storage');
                    }
                    return tokens;
                }
            }
        } catch (error) {
            if (this.logger) {
                this.logger.warn('Failed to load tokens from storage:', error.message);
            } else {
                console.warn('[PersistentTokenManager] Failed to load tokens from storage:', error.message);
            }
        }

        return {};
    }

    async _saveTokens() {
        try {
            const fs = require('fs').promises;
            await fs.writeFile(this.storagePath, JSON.stringify(this.tokens, null, 2));
        } catch (error) {
            this.logger.error('Failed to save tokens:', error);
        }
    }
}

/**
 * Memory Monitor
 * Detecta vazamentos e alerta quando necessário
 */
class MemoryMonitor {
    constructor(options = {}) {
        this.heapThreshold = options.heapThreshold || 500 * 1024 * 1024; // 500MB
        this.checkInterval = options.checkInterval || 30000; // 30s
        this.logger = new Logger('MemoryMonitor');
        this.measurements = [];
        this.maxMeasurements = 10;

        this._startMonitoring();
    }

    _startMonitoring() {
        setInterval(() => {
            const usage = process.memoryUsage();
            this.measurements.push({
                timestamp: Date.now(),
                heapUsed: usage.heapUsed,
                heapTotal: usage.heapTotal,
                external: usage.external
            });

            // Mantém apenas últimas medições
            if (this.measurements.length > this.maxMeasurements) {
                this.measurements.shift();
            }

            // Alerta se heap muito alto
            if (usage.heapUsed > this.heapThreshold) {
                this.logger.warn('High memory usage detected', {
                    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
                    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB'
                });
            }

            // Detecta possível vazamento (crescimento constante)
            if (this.measurements.length >= 5) {
                const recent = this.measurements.slice(-5);
                const growing = recent.every((curr, i) =>
                    i === 0 || curr.heapUsed > recent[i - 1].heapUsed
                );

                if (growing) {
                    this.logger.error('Potential memory leak detected', {
                        trend: recent.map(m => Math.round(m.heapUsed / 1024 / 1024))
                    });
                }
            }
        }, this.checkInterval);
    }

    getMemoryStats() {
        const current = process.memoryUsage();
        return {
            current: {
                heapUsed: Math.round(current.heapUsed / 1024 / 1024),
                heapTotal: Math.round(current.heapTotal / 1024 / 1024),
                external: Math.round(current.external / 1024 / 1024)
            },
            history: this.measurements.map(m => ({
                timestamp: m.timestamp,
                heapUsed: Math.round(m.heapUsed / 1024 / 1024)
            }))
        };
    }
}

module.exports = {
    ResourceManager,
    PersistentTokenManager,
    MemoryMonitor
};