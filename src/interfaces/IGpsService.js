/**
 * Interface para serviços GPS
 * @interface IGpsService
 */
class IGpsService {
    /**
     * @param {Array} trackpoints 
     * @param {Date} targetTime 
     * @returns {Object|null} closest point
     */
    findClosestTrackpoint(trackpoints, targetTime) {
        throw new Error('Method findClosestTrackpoint must be implemented');
    }

    /**
     * @param {Array} coordinates 
     * @returns {Object} bounds
     */
    calculateBounds(coordinates) {
        throw new Error('Method calculateBounds must be implemented');
    }
}

module.exports = IGpsService;