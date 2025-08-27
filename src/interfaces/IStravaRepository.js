/**
 * Interface para repositórios do Strava
 * @interface IStravaRepository
 */
class IStravaRepository {
    /**
     * @param {string} activityId 
     * @returns {Promise<Object>} activity data
     */
    async getActivity(activityId) {
        throw new Error('Method getActivity must be implemented');
    }

    /**
     * @param {string} activityId 
     * @returns {Promise<Object>} streams data
     */
    async getActivityStreams(activityId) {
        throw new Error('Method getActivityStreams must be implemented');
    }

    /**
     * @param {number} perPage 
     * @returns {Promise<Array>} activities
     */
    async getAthleteActivities(perPage = 30) {
        throw new Error('Method getAthleteActivities must be implemented');
    }
}

module.exports = IStravaRepository;