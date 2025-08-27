const Logger = require('../utils/Logger');

/**
 * Controlador para atividades
 * Aplica SRP - responsável apenas pelo controle de fluxo HTTP
 */
class ActivityController {
    constructor(stravaService, gpsService) {
        this.stravaService = stravaService;
        this.gpsService = gpsService;
        this.logger = new Logger('ActivityController');
    }

    /**
     * Lista atividades do atleta
     */
    async listActivities(req, res) {
        try {
            const currentFilter = req.query.filter || 'gps';

            const activities = await this.stravaService.getAthleteActivities({
                perPage: 30,
                filter: currentFilter,
                translations: req.t
            });

            res.render('activities', {
                activities,
                t: req.t,
                lang: req.language,
                currentFilter
            });

        } catch (error) {
            this.logger.error('Failed to list activities:', error);
            res.status(500).render('error', {
                message: 'Failed to fetch activities',
                t: req.t,
                lang: req.language
            });
        }
    }

    /**
     * Mostra detalhes de uma atividade
     */
    async showActivity(req, res) {
        try {
            const { activity, trackpoints } = await this.stravaService.getActivityWithStreams(req.params.id);

            const formattedDate = new Date(activity.start_date).toLocaleDateString(req.language, {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            res.render('activity_detail', {
                activity,
                trackpoints,
                t: req.t,
                lang: req.language,
                videoStartPoint: null,
                errorMessage: null,
                formattedDate,
                formattedVideoDate: null
            });

        } catch (error) {
            this.logger.error(`Failed to show activity ${req.params.id}:`, error);
            res.status(500).render('error', {
                message: 'Failed to load activity details',
                t: req.t,
                lang: req.language
            });
        }
    }
}

module.exports = ActivityController;
