// src/utils/Validator.js
/**
 * Validador utilitário
 * Aplica SRP - responsável apenas por validações
 */
class Validator {
    static validateActivityId(id) {
        if (!id || typeof id !== 'string') {
            throw new Error('Activity ID must be a non-empty string');
        }

        if (!/^\d+$/.test(id)) {
            throw new Error('Activity ID must contain only numbers');
        }

        return true;
    }

    static validateVideoFile(file) {
        if (!file) {
            throw new Error('No file provided');
        }

        const allowedMimeTypes = [
            'video/mp4', 'video/mpeg', 'video/quicktime',
            'video/x-msvideo', 'video/x-ms-wmv'
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new Error('Invalid file type. Only video files are allowed.');
        }

        const maxSize = 500 * 1024 * 1024; // 500MB
        if (file.size > maxSize) {
            throw new Error('File too large. Maximum size is 500MB.');
        }

        return true;
    }

    static validateLanguage(lang) {
        const supportedLanguages = ['en', 'pt', 'es'];
        return supportedLanguages.includes(lang) ? lang : 'en';
    }

    static validatePagination(perPage) {
        const num = parseInt(perPage);
        if (isNaN(num) || num < 1 || num > 200) {
            return 30; // default
        }
        return num;
    }
}

module.exports = Validator;