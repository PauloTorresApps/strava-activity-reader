require('dotenv').config();

/**
 * Configurações de ambiente
 * Aplica SRP - centraliza configurações
 */
class Environment {
    static get PORT() {
        return process.env.PORT || 3000;
    }

    static get STRAVA_CLIENT_ID() {
        const clientId = process.env.STRAVA_CLIENT_ID;
        if (!clientId) {
            throw new Error('STRAVA_CLIENT_ID environment variable is required');
        }
        return clientId;
    }

    static get STRAVA_CLIENT_SECRET() {
        const clientSecret = process.env.STRAVA_CLIENT_SECRET;
        if (!clientSecret) {
            throw new Error('STRAVA_CLIENT_SECRET environment variable is required');
        }
        return clientSecret;
    }

    static get REDIRECT_URI() {
        return `http://localhost:${this.PORT}/callback`;
    }

    static get NODE_ENV() {
        return process.env.NODE_ENV || 'development';
    }

    static get LOG_LEVEL() {
        return process.env.LOG_LEVEL || 'info';
    }

    static isDevelopment() {
        return this.NODE_ENV === 'development';
    }

    static isProduction() {
        return this.NODE_ENV === 'production';
    }
}

module.exports = Environment;