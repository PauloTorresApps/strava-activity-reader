const Logger = require('../utils/Logger');

/**
 * Serviço para processamento de vídeos
 * Aplica SRP - responsável apenas pela lógica de negócio de vídeos
 */
class VideoService {
    /**
     * @param {IVideoProcessor} videoProcessor
     * @param {ITimeConverter} timeConverter
     */
    constructor(videoProcessor, timeConverter) {
        this.videoProcessor = videoProcessor;
        this.timeConverter = timeConverter;
        this.logger = new Logger('VideoService');
    }

    /**
     * Processa upload de vídeo e sincroniza com atividade
     * @param {string} videoPath
     * @param {Object} activity
     * @param {string} language
     * @returns {Promise<Object>}
     */
    async processVideoUpload(videoPath, activity, language) {
        try {
            // Valida arquivo de vídeo
            const isValid = await this.videoProcessor.validateVideoFile(videoPath);
            if (!isValid) {
                throw new Error('Invalid video file format');
            }

            // Extrai metadados
            const metadata = await this.videoProcessor.extractMetadata(videoPath);
            const videoCreationTime = this.timeConverter.parseTime(
                metadata.creationTime,
                activity.timezone,
                activity.utc_offset
            );

            // Valida intervalo de tempo
            this._validateTimeInterval(videoCreationTime, activity);

            // Formata data para exibição
            console.log('Raw video creation time:', videoCreationTime);
            const formattedVideoDate = this._formatVideoDate(videoCreationTime, language);
            console.log('Formatted video date:', formattedVideoDate);

            this.logger.info('Video processed successfully', {
                videoCreationTime: videoCreationTime.toISOString(),
                activityId: activity.id
            });

            return {
                videoCreationTime,
                formattedVideoDate,
                metadata
            };
        } catch (error) {
            this.logger.error('Video processing failed:', error);
            throw error;
        }
    }

    /**
     * Valida se vídeo está dentro do intervalo da atividade
     * @private
     */
    _validateTimeInterval(videoTime, activity) {
        const activityStart = this.timeConverter.convertToLocal(
            new Date(activity.start_date),
            activity.utc_offset
        );
        const activityEnd = new Date(activityStart.getTime() + (activity.elapsed_time * 1000));

        if (videoTime < activityStart || videoTime > activityEnd) {
            throw new Error('Video creation time is outside activity time range');
        }
    }

    /**
     * Formata data do vídeo para exibição
     * @private
     */
    _formatVideoDate(videoTime, language) {
    // Usar timezone do sistema/browser
        return new Intl.DateTimeFormat(language, {
            dateStyle: 'long',
            timeStyle: 'medium',
            timeZone: 'UTC'
        }).format(videoTime);
    }
}

module.exports = VideoService;
