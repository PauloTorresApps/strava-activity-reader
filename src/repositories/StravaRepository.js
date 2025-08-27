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
            const response = await axios.get(`${this.baseURL}/activities/${activityId}/streams`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` },
                params: { keys, key_by_type: true }
            });
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to fetch streams for ${activityId}:`, error);
            throw new Error(`Strava API error: ${error.response?.status || 'Unknown'}`);
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