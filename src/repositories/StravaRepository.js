const axios = require('axios');
const IStravaRepository = require('../interfaces/IStravaRepository');
const Logger = require('../utils/Logger');

/**
 * Repositório para API do Strava
 * Aplica SRP - responsável apenas pelo acesso aos dados do Strava
 */
class StravaRepository extends IStravaRepository {
    constructor(accessToken) {
        super();
        this.accessToken = accessToken;
        this.baseURL = 'https://www.strava.com/api/v3';
        this.logger = new Logger('StravaRepository');
    }

    async getActivity(activityId) {
        try {
            const response = await axios.get(`${this.baseURL}/activities/${activityId}`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to fetch activity ${activityId}:`, error);
            throw new Error(`Strava API error: ${error.response?.status || 'Unknown'}`);
        }
    }

    async getActivityStreams(activityId, keys = 'latlng,time,distance') {
        try {
            console.log('DEBUG - Fetching streams:', { activityId, keys, tokenExists: !!this.accessToken });

            const response = await axios.get(`${this.baseURL}/activities/${activityId}/streams`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` },
                params: { keys, key_by_type: true },
                timeout: 30000
            });

            console.log('DEBUG - Strava response:', {
                status: response.status,
                dataKeys: Object.keys(response.data || {}),
                dataStructure: response.data
            });

            return response.data;
        } catch (error) {
            console.log('DEBUG - Strava API error:', error.response?.data);
            throw error;
        }
    }

    async getAthleteActivities(perPage = 30) {
        try {
            const response = await axios.get(`${this.baseURL}/athlete/activities`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` },
                params: { per_page: perPage }
            });
            return response.data;
        } catch (error) {
            this.logger.error('Failed to fetch athlete activities:', error);
            throw new Error(`Strava API error: ${error.response?.status || 'Unknown'}`);
        }
    }
}

module.exports = StravaRepository;