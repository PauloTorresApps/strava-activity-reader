/**
 * Interface para conversão de tempo
 * @interface ITimeConverter
 */
class ITimeConverter {
    /**
     * @param {string} timeString 
     * @param {string} timezone 
     * @param {number} utcOffset 
     * @returns {Date} converted time
     */
    parseTime(timeString, timezone, utcOffset) {
        throw new Error('Method parseTime must be implemented');
    }

    /**
     * @param {Date} time 
     * @param {number} utcOffset 
     * @returns {Date} local time
     */
    convertToLocal(time, utcOffset) {
        throw new Error('Method convertToLocal must be implemented');
    }
}

module.exports = ITimeConverter;