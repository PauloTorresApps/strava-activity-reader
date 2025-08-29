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

            // Determina status code
            const status = error.status || error.statusCode || 500;

            // Para requisições AJAX/API, retorna JSON
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(status).json({
                    error: 'Internal server error',
                    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
                    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
                });
            }

            // Para requisições normais, tenta renderizar template de erro
            try {
                res.status(status).render('error', {
                    status: status,
                    message: error.message || 'An error occurred',
                    error: process.env.NODE_ENV === 'development' ? error : {},
                    details: process.env.NODE_ENV === 'development' ? error.stack : null,
                    t: req.t || {},
                    lang: req.language || 'en'
                });
            } catch (renderError) {
                // Se falhar ao renderizar, envia HTML básico
                this.logger.error('Failed to render error template:', renderError);
                res.status(status).send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Error ${status}</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                            .error { max-width: 500px; margin: 0 auto; }
                            h1 { color: #e74c3c; }
                            p { color: #666; }
                            a { color: #fc5200; text-decoration: none; }
                        </style>
                    </head>
                    <body>
                        <div class="error">
                            <h1>Error ${status}</h1>
                            <p>${error.message || 'An error occurred'}</p>
                            <p><a href="/">← Back to Home</a></p>
                        </div>
                    </body>
                    </html>
                `);
            }
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

            const status = 404;

            // Para requisições AJAX/API
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(status).json({
                    error: 'Page not found',
                    path: req.path
                });
            }

            // Para requisições normais
            try {
                res.status(status).render('error', {
                    status: status,
                    message: `The page '${req.path}' was not found on this server.`,
                    error: {},
                    details: null,
                    t: req.t || {},
                    lang: req.language || 'en'
                });
            } catch (renderError) {
                // Fallback HTML
                res.status(status).send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Page Not Found</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                            .error { max-width: 500px; margin: 0 auto; }
                            h1 { color: #e74c3c; }
                        </style>
                    </head>
                    <body>
                        <div class="error">
                            <h1>404 - Page Not Found</h1>
                            <p>The page '${req.path}' was not found.</p>
                            <p><a href="/">← Back to Home</a></p>
                        </div>
                    </body>
                    </html>
                `);
            }
        };
    }

    _handleMulterError(error, req, res) {
        let message = 'File upload error';
        let status = 400;

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
            default:
                message = 'File upload error: ' + error.message;
        }

        if (req.xhr || req.headers.accept?.includes('application/json')) {
            res.status(status).json({ error: message });
        } else {
            try {
                res.status(status).render('error', {
                    status: status,
                    message: message,
                    error: {},
                    details: null,
                    t: req.t || {},
                    lang: req.language || 'en'
                });
            } catch (renderError) {
                res.status(status).send(`<h1>Upload Error</h1><p>${message}</p><a href="javascript:history.back()">← Back</a>`);
            }
        }
    }

    _handleValidationError(error, req, res) {
        const status = 400;
        const message = 'Validation error: ' + error.message;

        if (req.xhr || req.headers.accept?.includes('application/json')) {
            res.status(status).json({
                error: 'Validation error',
                details: error.message
            });
        } else {
            try {
                res.status(status).render('error', {
                    status: status,
                    message: message,
                    error: {},
                    details: null,
                    t: req.t || {},
                    lang: req.language || 'en'
                });
            } catch (renderError) {
                res.status(status).send(`<h1>Validation Error</h1><p>${message}</p><a href="javascript:history.back()">← Back</a>`);
            }
        }
    }
}

module.exports = ErrorMiddleware;