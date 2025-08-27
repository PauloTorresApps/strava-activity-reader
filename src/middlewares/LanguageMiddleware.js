const fs = require('fs');
const path = require('path');
const Validator = require('../utils/Validator');

/**
 * Middleware de internacionalização
 * Aplica SRP - responsável apenas por configurar idioma
 */
class LanguageMiddleware {
    constructor() {
        this.locales = this._loadLocales();
    }

    configure() {
        return (req, res, next) => {
            let lang = req.query.lang || 
                      (req.headers['accept-language'] || 'en').split(',')[0].split('-')[0];
            
            lang = Validator.validateLanguage(lang);
            
            req.language = lang;
            req.t = this.locales[lang];
            
            next();
        };
    }

    _loadLocales() {
        const localesDir = path.join(__dirname, '../../locales');
        const locales = {};

        const files = fs.readdirSync(localesDir);
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const lang = path.basename(file, '.json');
                const filePath = path.join(localesDir, file);
                locales[lang] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
        });

        return locales;
    }
}

module.exports = LanguageMiddleware;