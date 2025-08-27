const IGpsService = require('../interfaces/IGpsService');
const Logger = require('../utils/Logger');

/**
 * Serviço para operações GPS
 * Aplica SRP - responsável apenas pela lógica GPS
 */
class GpsService extends IGpsService {
    constructor() {
        super();
        this.logger = new Logger('GpsService');
    }

    /**
     * Encontra o ponto GPS mais próximo ao tempo alvo
     * @param {Array} trackpoints 
     * @param {Date} targetTime 
     * @returns {Object|null}
     */
    findClosestTrackpoint(trackpoints, targetTime) {
        if (!trackpoints || trackpoints.length === 0) {
            this.logger.warn('No trackpoints provided');
            return null;
        }

        let closestPoint = null;
        let smallestDiff = Infinity;

        trackpoints.forEach(point => {
            if (point.latlng && point.time) {
                const diff = Math.abs(point.time.getTime() - targetTime.getTime());
                if (diff < smallestDiff) {
                    smallestDiff = diff;
                    closestPoint = point;
                }
            }
        });

        if (closestPoint) {
            this.logger.info('Closest trackpoint found', {
                coordinates: closestPoint.latlng,
                timeDifference: smallestDiff,
                pointTime: closestPoint.time.toISOString()
            });
        }

        return closestPoint;
    }

    /**
     * Calcula bounds para conjunto de coordenadas
     * @param {Array} coordinates 
     * @returns {Object}
     */
    calculateBounds(coordinates) {
        if (!coordinates || coordinates.length === 0) {
            return null;
        }

        const lats = coordinates.map(coord => coord[0]);
        const lngs = coordinates.map(coord => coord[1]);

        return {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs)
        };
    }
}

module.exports = GpsService;