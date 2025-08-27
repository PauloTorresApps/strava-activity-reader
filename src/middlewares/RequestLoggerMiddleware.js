// src/middlewares/RequestLoggerMiddleware.js
const Logger = require('../utils/Logger');

/**
 * Middleware de logging de requisições
 * Aplica SRP - responsável apenas por logar requisições
 */
class RequestLoggerMiddleware {
    constructor() {
        this.logger = new Logger('RequestLogger');
    }

    log() {
        return (req, res, next) => {
            const start = Date.now();

            // Override do res.end para capturar quando response termina
            const originalEnd = res.end;
            res.end = (...args) => {
                const duration = Date.now() - start;

                this.logger.info('Request completed', {
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`,
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });

                originalEnd.apply(res, args);
            };

            this.logger.info('Request started', {
                method: req.method,
                path: req.path,
                ip: req.ip
            });

            next();
        };
    }
}

module.exports = RequestLoggerMiddleware;