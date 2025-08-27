// src/utils/Logger.js
/**
 * Logger utilitário
 * Aplica SRP - responsável apenas por logging
 */
class Logger {
    constructor(context = 'Application') {
        this.context = context;
    }

    info(message, data = null) {
        const timestamp = new Date().toISOString();
        const logData = data ? JSON.stringify(data) : '';
        console.log(`[${timestamp}] [${this.context}] INFO: ${message} ${logData}`);
    }

    error(message, error = null) {
        const timestamp = new Date().toISOString();
        const errorData = error ? (error.stack || error.message || error) : '';
        console.error(`[${timestamp}] [${this.context}] ERROR: ${message} ${errorData}`);
    }

    warn(message, data = null) {
        const timestamp = new Date().toISOString();
        const logData = data ? JSON.stringify(data) : '';
        console.warn(`[${timestamp}] [${this.context}] WARN: ${message} ${logData}`);
    }

    debug(message, data = null) {
        if (process.env.NODE_ENV === 'development') {
            const timestamp = new Date().toISOString();
            const logData = data ? JSON.stringify(data) : '';
            console.debug(`[${timestamp}] [${this.context}] DEBUG: ${message} ${logData}`);
        }
    }
}

module.exports = Logger;