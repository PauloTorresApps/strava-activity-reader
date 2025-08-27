const axios = require('axios');
const Environment = require('./Environment');
const Logger = require('../utils/Logger');

/**
 * Gerenciador de tokens OAuth
 * Aplica SRP - responsável apenas pelo gerenciamento de tokens
 */
class TokenManager {
    constructor() {
        this.tokens = {};
        this.logger = new Logger('TokenManager');
    }

    setTokens(tokenData) {
        this.tokens = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: tokenData.expires_at,
            scope: tokenData.scope
        };
        
        this.logger.info('Tokens set successfully', {
            expires_at: new Date(tokenData.expires_at * 1000).toISOString()
        });
    }

    getAccessToken() {
        return this.tokens.access_token;
    }

    hasValidToken() {
        return !!this.tokens.access_token;
    }

    isTokenExpired() {
        if (!this.tokens.expires_at) {
            return true;
        }
        return this.tokens.expires_at < (Date.now() / 1000);
    }

    async refreshToken() {
        if (!this.tokens.refresh_token) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await axios.post('https://www.strava.com/oauth/token', {
                client_id: Environment.STRAVA_CLIENT_ID,
                client_secret: Environment.STRAVA_CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: this.tokens.refresh_token,
            });

            this.setTokens(response.data);
            this.logger.info('Token refreshed successfully');
            
            return response.data;
        } catch (error) {
            this.logger.error('Failed to refresh token:', error);
            throw new Error('Token refresh failed');
        }
    }

    clearTokens() {
        this.tokens = {};
        this.logger.info('Tokens cleared');
    }
}

module.exports = TokenManager;