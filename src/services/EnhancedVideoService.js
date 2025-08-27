// src/services/EnhancedVideoService.js
const Logger = require('../utils/Logger');
const OverlayService = require('./OverlayService');
const VideoOverlayService = require('./VideoOverlayService');

/**
 * Serviço integrado para processamento completo de vídeo com overlays
 * Aplica SRP - orquestra a criação e aplicação de overlays
 */
class EnhancedVideoService {
    constructor(videoProcessor, timeService) {
        this.videoProcessor = videoProcessor;
        this.timeService = timeService;
        this.overlayService = new OverlayService();
        this.videoOverlayService = new VideoOverlayService();
        this.logger = new Logger('EnhancedVideoService');
    }

    /**
     * Processa vídeo completo com overlays dinâmicos
     * @param {string} videoPath - Caminho do vídeo
     * @param {Object} activity - Dados da atividade
     * @param {Array} trackpoints - Pontos GPS
     * @param {Date} videoStartTime - Tempo de início do vídeo
     * @param {string} language - Idioma
     * @returns {Promise<Object>} Resultado do processamento
     */
    async processVideoWithOverlays(videoPath, activity, trackpoints, videoStartTime, language = 'en') {
        try {
            this.logger.info('Starting enhanced video processing', {
                activityId: activity.id,
                trackpoints: trackpoints.length,
                videoStart: videoStartTime.toISOString()
            });

            // 1. Validação inicial
            await this._validateInputs(videoPath, activity, trackpoints);

            // 2. Extrai informações do vídeo
            const videoInfo = await this.videoOverlayService.getVideoInfo(videoPath);
            this.logger.info('Video info extracted', videoInfo);

            // 3. Prepara trackpoints sincronizados com o vídeo
            const syncedTrackpoints = this._synchronizeTrackpoints(trackpoints, videoStartTime, videoInfo.duration);

            // 4. Gera overlays dinâmicos
            this.logger.info('Generating dynamic overlays...');
            const overlayInfo = await this.overlayService.generateOverlaySequence(syncedTrackpoints, activity);

            // 5. Decide qual método de processamento usar
            const processingMethod = this._determineProcessingMethod(overlayInfo, videoInfo);

            let outputPath;
            if (processingMethod === 'complex') {
                // 6a. Aplica overlays dinâmicos (método complexo)
                this.logger.info('Applying dynamic overlays using complex filters...');
                outputPath = await this.videoOverlayService.applyOverlaysToVideo(
                    videoPath, overlayInfo, syncedTrackpoints, videoStartTime
                );
            } else {
                // 6b. Aplica overlay estático (método simples)
                this.logger.info('Applying static overlay (fallback method)...');
                outputPath = await this.videoOverlayService.applySimpleOverlay(
                    videoPath, overlayInfo, syncedTrackpoints, videoStartTime
                );
            }

            // 7. Cleanup arquivos temporários
            await this.overlayService.cleanupOverlays(activity.id);

            // 8. Resultado final
            const result = {
                success: true,
                outputPath: outputPath,
                originalVideoPath: videoPath,
                processingMethod: processingMethod,
                statistics: {
                    totalTrackpoints: trackpoints.length,
                    syncedTrackpoints: syncedTrackpoints.length,
                    overlaysGenerated: overlayInfo.totalFrames,
                    maxSpeed: overlayInfo.maxSpeed,
                    videoDuration: videoInfo.duration,
                    processingTime: Date.now() - Date.now() // Will be calculated properly
                }
            };

            this.logger.info('Enhanced video processing completed successfully', result.statistics);

            return result;

        } catch (error) {
            this.logger.error('Enhanced video processing failed:', error);

            // Cleanup em caso de erro
            try {
                await this.overlayService.cleanupOverlays(activity.id);
            } catch (cleanupError) {
                this.logger.warn('Cleanup after error failed:', cleanupError);
            }

            throw new Error(`Video processing failed: ${error.message}`);
        }
    }

    /**
     * Gera preview do vídeo com overlays
     */
    async generatePreview(videoPath, activity, trackpoints, videoStartTime) {
        try {
            this.logger.info('Generating video preview with overlays');

            // Gera apenas alguns overlays para preview
            const previewTrackpoints = trackpoints.filter((_, index) => index % 10 === 0); // A cada 10 pontos

            const overlayInfo = await this.overlayService.generateOverlaySequence(previewTrackpoints, activity);

            const previewPath = await this.videoOverlayService.generatePreview(
                videoPath, overlayInfo, previewTrackpoints, videoStartTime
            );

            await this.overlayService.cleanupOverlays(activity.id);

            return {
                success: true,
                previewPath: previewPath,
                overlaysCount: overlayInfo.totalFrames
            };

        } catch (error) {
            this.logger.error('Preview generation failed:', error);
            throw error;
        }
    }

    /**
     * Valida entradas do processamento
     * @private
     */
    async _validateInputs(videoPath, activity, trackpoints) {
        // Valida arquivo de vídeo
        const isValidVideo = await this.videoProcessor.validateVideoFile(videoPath);
        if (!isValidVideo) {
            throw new Error('Invalid video file');
        }

        // Valida trackpoints
        if (!trackpoints || trackpoints.length < 2) {
            throw new Error('Insufficient GPS trackpoints for overlay generation');
        }

        const validTrackpoints = trackpoints.filter(tp => tp.latlng && tp.time);
        if (validTrackpoints.length < trackpoints.length * 0.8) {
            this.logger.warn('Many trackpoints missing GPS data', {
                total: trackpoints.length,
                valid: validTrackpoints.length
            });
        }

        // Valida atividade
        if (!activity || !activity.id) {
            throw new Error('Invalid activity data');
        }
    }

    /**
     * Sincroniza trackpoints com tempo do vídeo
     * @private
     */
    _synchronizeTrackpoints(trackpoints, videoStartTime, videoDuration) {
        const videoEndTime = new Date(videoStartTime.getTime() + (videoDuration * 1000));

        // Filtra trackpoints que estão dentro do tempo do vídeo
        const syncedTrackpoints = trackpoints.filter(tp => {
            if (!tp.time) return false;
            return tp.time >= videoStartTime && tp.time <= videoEndTime;
        });

        this.logger.info('Trackpoints synchronized', {
            originalCount: trackpoints.length,
            syncedCount: syncedTrackpoints.length,
            videoStart: videoStartTime.toISOString(),
            videoDurationSec: videoDuration
        });

        return syncedTrackpoints;
    }

    /**
     * Determina método de processamento baseado na complexidade
     * @private
     */
    _determineProcessingMethod(overlayInfo, videoInfo) {
        const maxOverlaysForComplex = 1000; // Limite para método complexo
        const maxDurationForComplex = 600; // 10 minutos

        if (overlayInfo.totalFrames > maxOverlaysForComplex) {
            this.logger.info('Too many overlays, using simple method', {
                overlays: overlayInfo.totalFrames,
                limit: maxOverlaysForComplex
            });
            return 'simple';
        }

        if (videoInfo.duration > maxDurationForComplex) {
            this.logger.info('Video too long, using simple method', {
                duration: videoInfo.duration,
                limit: maxDurationForComplex
            });
            return 'simple';
        }

        return 'complex';
    }

    /**
     * Calcula estatísticas da atividade para overlays
     */
    calculateActivityStats(trackpoints) {
        let totalDistance = 0;
        let maxSpeed = 0;
        let totalElevationGain = 0;
        let maxGForce = 0;

        let previousPoint = null;

        for (const point of trackpoints) {
            if (!point.latlng || !previousPoint) {
                previousPoint = point;
                continue;
            }

            // Distância
            const distance = this._calculateDistance(
                previousPoint.latlng[0], previousPoint.latlng[1],
                point.latlng[0], point.latlng[1]
            );
            totalDistance += distance;

            // Velocidade
            const timeDiff = (point.time - previousPoint.time) / 1000;
            if (timeDiff > 0) {
                const speed = (distance / timeDiff) * 3.6; // km/h
                maxSpeed = Math.max(maxSpeed, speed);

                // Força G (aproximada)
                const prevSpeed = previousPoint.speed || 0;
                const acceleration = Math.abs((speed - prevSpeed) / timeDiff);
                const gForce = acceleration / 9.81;
                maxGForce = Math.max(maxGForce, gForce);
            }

            // Elevação
            if (point.elevation && previousPoint.elevation) {
                const elevDiff = point.elevation - previousPoint.elevation;
                if (elevDiff > 0) {
                    totalElevationGain += elevDiff;
                }
            }

            point.speed = speed;
            previousPoint = point;
        }

        return {
            totalDistance: Math.round(totalDistance),
            maxSpeed: Math.round(maxSpeed * 10) / 10,
            totalElevationGain: Math.round(totalElevationGain),
            maxGForce: Math.round(maxGForce * 100) / 100,
            duration: trackpoints.length > 0 ?
                (trackpoints[trackpoints.length - 1].time - trackpoints[0].time) / 1000 : 0
        };
    }

    /**
     * Calcula distância entre dois pontos (Haversine)
     * @private
     */
    _calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Raio da Terra em metros
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}

module.exports = EnhancedVideoService;