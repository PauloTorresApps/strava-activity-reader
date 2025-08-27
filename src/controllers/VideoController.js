const fs = require('fs');
const Logger = require('../utils/Logger');

/**
 * Controlador para upload e sincronização de vídeos
 * Aplica SRP - responsável apenas pelo controle de fluxo HTTP de vídeos
 */
class VideoController {
    constructor(stravaService, videoService, gpsService) {
        this.stravaService = stravaService;
        this.videoService = videoService;
        this.gpsService = gpsService;
        this.logger = new Logger('VideoController');
    }

    /**
     * Processa upload de vídeo e sincroniza com atividade
     */
    async uploadAndSync(req, res) {
        const videoPath = req.file?.path;

        try {
            if (!req.file) {
                throw new Error('No video file uploaded');
            }

            // Busca dados da atividade
            const { activity, trackpoints } = await this.stravaService.getActivityWithStreams(req.params.id);

            // Processa vídeo
            const videoData = await this.videoService.processVideoUpload(
                videoPath,
                activity,
                req.language
            );

            // Encontra ponto GPS mais próximo
            const closestPoint = this.gpsService.findClosestTrackpoint(
                trackpoints,
                videoData.videoCreationTime
            );

            if (!closestPoint) {
                throw new Error('Unable to find corresponding GPS point for video timestamp');
            }

            // Log de sucesso
            this.logger.info('Video sync successful', {
                activityId: req.params.id,
                videoTime: videoData.videoCreationTime.toISOString(),
                gpsTime: closestPoint.time.toISOString(),
                coordinates: closestPoint.latlng,
                timeDifference: Math.abs(closestPoint.time.getTime() - videoData.videoCreationTime.getTime()) / 1000
            });

            // Formata data da atividade
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
                videoStartPoint: closestPoint,
                errorMessage: null,
                formattedDate,
                formattedVideoDate: videoData.formattedVideoDate
            });

        } catch (error) {
            this.logger.error('Video upload failed:', error);

            try {
                // Busca dados para re-renderizar em caso de erro
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
                    errorMessage: error.message,
                    formattedDate,
                    formattedVideoDate: null
                });

            } catch (renderError) {
                this.logger.error('Failed to render error page:', renderError);
                res.status(500).send('Internal server error');
            }

        } finally {
            // Limpa arquivo temporário
            if (videoPath && fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
            }
        }
    }
}

module.exports = VideoController;