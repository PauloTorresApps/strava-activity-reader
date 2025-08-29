// src/controllers/EnhancedVideoController.js
const fs = require('fs');
const path = require('path');
const Logger = require('../utils/Logger');

/**
 * Controlador aprimorado para processamento de vídeos com overlays
 * Aplica SRP - responsável apenas pelo controle HTTP do processamento de vídeos
 */
class EnhancedVideoController {
    constructor(stravaService, enhancedVideoService, gpsService) {
        this.stravaService = stravaService;
        this.enhancedVideoService = enhancedVideoService;
        this.gpsService = gpsService;
        this.logger = new Logger('EnhancedVideoController');
    }

    /**
     * Upload e sincronização básica (método existente)
     */
    async uploadAndSync(req, res) {
        const videoPath = req.file?.path;

        try {
            if (!req.file) {
                throw new Error('No video file uploaded');
            }

            // Busca dados da atividade
            const { activity, trackpoints } = await this.stravaService.getActivityWithStreams(req.params.id);

            // Processa vídeo (método básico)
            const videoData = await this.enhancedVideoService.videoService.processVideoUpload(
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

            // Formata data da atividade
            const formattedDate = new Date(activity.start_date).toLocaleDateString(req.language, {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            // Calcula estatísticas para exibir no frontend
            const activityStats = this.enhancedVideoService.calculateActivityStats(trackpoints);

            // Usa template básico com dados aprimorados
            res.render('activity_detail', {
                activity,
                trackpoints,
                t: req.t,
                lang: req.language,
                videoStartPoint: closestPoint,
                errorMessage: null,
                formattedDate,
                formattedVideoDate: videoData.formattedVideoDate,
                // Dados extras para futuro template enhanced
                activityStats,
                videoData,
                showOverlayOptions: true
            });

        } catch (error) {
            this.logger.error('Basic video upload failed:', error);
            await this._renderErrorPage(req, res, error.message);
        } finally {
            if (videoPath && fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
            }
        }
    }

    /**
     * Gera preview do vídeo com overlays
     */
    async generatePreview(req, res) {
        const videoPath = req.file?.path;

        try {
            if (!req.file) {
                throw new Error('No video file uploaded');
            }

            const { activity, trackpoints } = await this.stravaService.getActivityWithStreams(req.params.id);

            // Processa vídeo para obter tempo de início
            const videoData = await this.enhancedVideoService.videoService.processVideoUpload(
                videoPath, activity, req.language
            );

            this.logger.info('Generating preview with overlays', {
                activityId: activity.id,
                videoStartTime: videoData.videoCreationTime.toISOString()
            });

            // Gera preview com overlays
            const previewResult = await this.enhancedVideoService.generatePreview(
                videoPath,
                activity,
                trackpoints,
                videoData.videoCreationTime
            );

            // Resposta JSON para requisições AJAX
            res.json({
                success: true,
                message: 'Preview generated successfully',
                previewPath: previewResult.previewPath,
                overlaysCount: previewResult.overlaysCount,
                downloadUrl: `/download/${path.basename(previewResult.previewPath)}`
            });

        } catch (error) {
            this.logger.error('Preview generation failed:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            if (videoPath && fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
            }
        }
    }

    /**
     * Processa vídeo completo com overlays dinâmicos
     */
    async processWithOverlays(req, res) {
        const videoPath = req.file?.path;

        try {
            if (!req.file) {
                throw new Error('No video file uploaded');
            }

            const { activity, trackpoints } = await this.stravaService.getActivityWithStreams(req.params.id);

            // Processa vídeo para obter tempo de início
            const videoData = await this.enhancedVideoService.videoService.processVideoUpload(
                videoPath, activity, req.language
            );

            this.logger.info('Starting full video processing with overlays', {
                activityId: activity.id,
                trackpointsCount: trackpoints.length,
                videoSize: req.file.size
            });

            // Processa vídeo completo com overlays
            const result = await this.enhancedVideoService.processVideoWithOverlays(
                videoPath,
                activity,
                trackpoints,
                videoData.videoCreationTime,
                req.language
            );

            // Resposta de sucesso
            res.json({
                success: true,
                message: 'Video processed successfully with dynamic overlays',
                outputPath: result.outputPath,
                statistics: result.statistics,
                processingMethod: result.processingMethod,
                downloadUrl: `/download/${path.basename(result.outputPath)}`
            });

        } catch (error) {
            this.logger.error('Full video processing failed:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        } finally {
            if (videoPath && fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
            }
        }
    }

    /**
     * Endpoint para download de vídeos processados
     */
    async downloadVideo(req, res) {
        try {
            const filename = req.params.filename;

            if (!this._isValidFilename(filename)) {
                return res.status(400).json({ error: 'Invalid filename' });
            }

            // Resolve path completo e valida que está dentro do diretório
            const outputDir = path.resolve('output');
            const filePath = path.resolve(outputDir, filename);

            if (!filePath.startsWith(outputDir)) {
                return res.status(400).json({ error: 'Invalid file path' });
            }

            const stat = fs.statSync(filePath);

            res.set({
                'Content-Type': 'video/mp4',
                'Content-Length': stat.size,
                'Content-Disposition': `attachment; filename="${filename}"`
            });

            const stream = fs.createReadStream(filePath);
            stream.pipe(res);

            this.logger.info('File download started', { filename, size: stat.size });

        } catch (error) {
            this.logger.error('Download failed:', error);
            res.status(500).json({ error: 'Download failed' });
        }
    }

    /**
     * Endpoint para verificar status de processamento
     */
    async getProcessingStatus(req, res) {
        try {
            // Implementação simples - pode ser expandida com Redis/database
            const activityId = req.params.id;

            // Verifica se existem arquivos de output recentes
            const outputDir = 'output';
            const files = fs.readdirSync(outputDir)
                .filter(file => file.includes(activityId) || file.includes('overlay'))
                .map(file => ({
                    filename: file,
                    created: fs.statSync(path.join(outputDir, file)).mtime,
                    size: fs.statSync(path.join(outputDir, file)).size
                }))
                .sort((a, b) => b.created - a.created);

            res.json({
                activityId,
                recentFiles: files.slice(0, 5), // 5 mais recentes
                hasProcessedVideos: files.length > 0
            });

        } catch (error) {
            this.logger.error('Status check failed:', error);
            res.status(500).json({ error: 'Status check failed' });
        }
    }

    /**
     * Renderiza página de erro
     * @private
     */
    async _renderErrorPage(req, res, errorMessage) {
        try {
            const { activity, trackpoints } = await this.stravaService.getActivityWithStreams(req.params.id);
            const formattedDate = new Date(activity.start_date).toLocaleDateString(req.language, {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            // Tenta renderizar template enhanced, se falhar usa o básico
            try {
                res.render('activity_detail_enhanced', {
                    activity,
                    trackpoints,
                    t: req.t,
                    lang: req.language,
                    videoStartPoint: null,
                    errorMessage: errorMessage,
                    formattedDate,
                    formattedVideoDate: null,
                    showOverlayOptions: false
                });
            } catch (templateError) {
                // Fallback para template básico
                this.logger.warn('Enhanced template not found, using basic template');
                res.render('activity_detail', {
                    activity,
                    trackpoints,
                    t: req.t,
                    lang: req.language,
                    videoStartPoint: null,
                    errorMessage: errorMessage,
                    formattedDate,
                    formattedVideoDate: null
                });
            }

        } catch (renderError) {
            this.logger.error('Failed to render error page:', renderError);
            res.status(500).render('error', {
                status: 500,
                message: errorMessage || 'An error occurred',
                error: process.env.NODE_ENV === 'development' ? renderError : {},
                t: req.t || {},
                lang: req.language || 'en'
            });
        }
    }

    /**
     * Valida nome de arquivo por segurança
     * @private
     */
    _isValidFilename(filename) {
        // Mais restritivo
        if (typeof filename !== 'string' || filename.length === 0 || filename.length > 100) {
            return false;
        }

        // Apenas caracteres seguros
        const safePattern = /^[a-zA-Z0-9._-]+$/;
        const forbiddenPatterns = ['..', '/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0'];

        return safePattern.test(filename) &&
            !forbiddenPatterns.some(pattern => filename.includes(pattern)) &&
            !filename.startsWith('.') &&
            filename.includes('.'); // Deve ter extensão
    }
}

module.exports = EnhancedVideoController;