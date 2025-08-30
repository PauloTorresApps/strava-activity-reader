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
    parseTime(timeString) {
        const hasTimezone = timeString.endsWith('Z') || /[\+\-]\d{2}:?\d{2}$/.test(timeString);

        let result;
        if (hasTimezone) {
            result = new Date(timeString);
        } else {
            const cleanTimeStr = timeString.replace(' ', 'T');

            // Se termina com Z, remover para tratar como horário local
            if (cleanTimeStr.endsWith('Z')) {
                return new Date(timeString);
            }
            console.log('Horário local detectado:', cleanTimeStr);
            return new Date(cleanTimeStr);
        }

        return result;
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
