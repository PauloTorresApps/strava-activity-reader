const Logger = require('../utils/Logger');

/**
 * Middleware de autenticação
 * Aplica SRP - responsável apenas por verificar autenticação
 */
class AuthMiddleware {
    constructor(tokenManager) {
        this.tokenManager = tokenManager;
        this.logger = new Logger('AuthMiddleware');
    }

    /**
     * Verifica se usuário está autenticado
     */
    requireAuth() {
        return async (req, res, next) => {
            try {
                if (!this.tokenManager.hasValidToken()) {
                    this.logger.warn('Unauthenticated access attempt', {
                        ip: req.ip,
                        path: req.path
                    });
                    return res.redirect('/');
                }

                // Verifica se token expirou
                if (this.tokenManager.isTokenExpired()) {
                    try {
                        await this.tokenManager.refreshToken();
                        this.logger.info('Token refreshed successfully');
                    } catch (error) {
                        this.logger.error('Token refresh failed:', error);
                        return res.redirect('/');
                    }
                }

                next();
            } catch (error) {
                this.logger.error('Auth middleware error:', error);
                res.status(500).send('Authentication error');
            }
        };
    }
}

module.exports = AuthMiddleware;