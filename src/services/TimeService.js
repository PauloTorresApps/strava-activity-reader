const ITimeConverter = require('../interfaces/ITimeConverter');

/**
 * Serviço para conversões de tempo
 * Aplica SRP - responsável apenas por conversões de tempo
 */
class TimeService extends ITimeConverter {
    /**
     * Parse do tempo de criação considerando timezone
     * @param {string} timeString 
     * @param {string} timezone 
     * @param {number} utcOffset 
     * @returns {Date}
     */
    parseTime(timeString, timezone, utcOffset) {
        const hasTimezone = timeString.endsWith('Z') || /[\+\-]\d{2}:?\d{2}$/.test(timeString);
        
        if (hasTimezone) {
            return new Date(timeString);
        } else {
            const cleanTimeStr = timeString.replace(' ', 'T');
            return new Date(cleanTimeStr.endsWith('Z') ? cleanTimeStr : cleanTimeStr + 'Z');
        }
    }

    /**
     * Converte tempo UTC para local
     * @param {Date} time 
     * @param {number} utcOffset - offset em segundos
     * @returns {Date}
     */
    convertToLocal(time, utcOffset) {
        return new Date(time.getTime() + (utcOffset * 1000));
    }

    /**
     * Converte tempo local para UTC
     * @param {Date} localTime 
     * @param {number} utcOffset - offset em segundos
     * @returns {Date}
     */
    convertToUTC(localTime, utcOffset) {
        return new Date(localTime.getTime() - (utcOffset * 1000));
    }
}

module.exports = TimeService;