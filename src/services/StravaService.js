const IStravaRepository = require('../interfaces/IStravaRepository');
const ITimeConverter = require('../interfaces/ITimeConverter');
const Logger = require('../utils/Logger');

/**
 * Serviço para operações do Strava
 * Aplica SRP - responsável apenas pela lógica de negócio do Strava
 */
class StravaService {
    /**
     * @param {IStravaRepository} stravaRepository 
     * @param {ITimeConverter} timeConverter 
     */
    constructor(stravaRepository, timeConverter) {
        this.stravaRepository = stravaRepository;
        this.timeConverter = timeConverter;
        this.logger = new Logger('StravaService');
    }

    /**
     * Busca dados completos de uma atividade
     * @param {string} activityId 
     * @returns {Promise<Object>}
     */
    async getActivityWithStreams(activityId) {
        try {
            const [activity, streams] = await Promise.all([
                this.stravaRepository.getActivity(activityId),
                this.stravaRepository.getActivityStreams(activityId)
            ]);

            const trackpoints = this._buildTrackpoints(activity, streams);
            
            this.logger.info(`Activity ${activityId} fetched successfully with ${trackpoints.length} trackpoints`);
            
            return { activity, trackpoints };
        } catch (error) {
            this.logger.error(`Failed to fetch activity ${activityId}:`, error);
            throw new Error(`Unable to fetch activity data: ${error.message}`);
        }
    }

    /**
     * Busca atividades do atleta com filtros
     * @param {Object} options 
     * @returns {Promise<Array>}
     */
    async getAthleteActivities(options = {}) {
        const { perPage = 30, filter = 'all', translations = {} } = options;

        try {
            let activities = await this.stravaRepository.getAthleteActivities(perPage);

            if (filter === 'gps') {
                activities = this._filterGpsActivities(activities);
            }

            return this._translateActivityTypes(activities, translations);
        } catch (error) {
            this.logger.error('Failed to fetch athlete activities:', error);
            throw new Error(`Unable to fetch activities: ${error.message}`);
        }
    }

    /**
     * Constrói trackpoints com timestamps corretos
     * @private
     */
    _buildTrackpoints(activity, streams) {
        const activityStartLocal = this.timeConverter.convertToLocal(
            new Date(activity.start_date), 
            activity.utc_offset
        );

        return (streams.time?.data || []).map((time, i) => ({
            latlng: streams.latlng?.data[i] || null,
            time: new Date(activityStartLocal.getTime() + time * 1000),
        }));
    }

    /**
     * Filtra apenas atividades com GPS
     * @private
     */
    _filterGpsActivities(activities) {
        return activities.filter(activity => 
            activity.map && 
            activity.map.summary_polyline && 
            activity.map.summary_polyline.length > 0
        );
    }

    /**
     * Adiciona traduções dos tipos de atividade
     * @private
     */
    _translateActivityTypes(activities, translations) {
        return activities.map(activity => ({
            ...activity,
            translated_type: translations[activity.type] || activity.type
        }));
    }
}

module.exports = StravaService;