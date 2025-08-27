const Logger = require('../utils/Logger');
const multer = require('multer');

/**
 * Middleware de tratamento de erros
 * Aplica SRP - responsável apenas por tratar erros
 */
class ErrorMiddleware {
    constructor() {
        this.logger = new Logger('ErrorMiddleware');
    }

    /**
     * Handler global de erros
     */
    globalErrorHandler() {
        return (error, req, res, next) => {
            this.logger.error('Global error handler triggered:', error);

            // Erros do Multer
            if (error instanceof multer.MulterError) {
                return this._handleMulterError(error, req, res);
            }

            // Erros de validação
            if (error.name === 'ValidationError') {
                return this._handleValidationError(error, req, res);
            }

            // Erro padrão
            res.status(500).render('error', {
                message: 'Internal server error',
                t: req.t || {},
                lang: req.language || 'en'
            });
        };
    }

    /**
     * Handler para 404
     */
    notFoundHandler() {
        return (req, res) => {
            this.logger.warn('404 Not Found', { 
                path: req.path, 
                method: req.method,
                ip: req.ip 
            });

            res.status(404).render('error', {
                message: 'Page not found',
                t: req.t || {},
                lang: req.language || 'en'
            });
        };
    }

    _handleMulterError(error, req, res) {
        let message = 'File upload error';
        
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                message = 'File too large. Maximum size is 500MB';
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = 'Unexpected file field';
                break;
        }

        res.status(400).json({ error: message });
    }

    _handleValidationError(error, req, res) {
        res.status(400).json({ 
            error: 'Validation error',
            details: error.message 
        });
    }
}

module.exports = ErrorMiddleware;