// src/services/VideoOverlayService.js
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/Logger');

/**
 * Serviço para aplicação de overlays em vídeos
 * Aplica SRP - responsável apenas pela aplicação de overlays usando FFmpeg
 */
class VideoOverlayService {
    constructor() {
        this.logger = new Logger('VideoOverlayService');
        this.outputDir = 'output';
        this._ensureOutputDirectory();
        this._scheduleCleanup();
    }

    /**
     * Aplica sequence de overlays ao vídeo
     * @param {string} videoPath - Caminho do vídeo original
     * @param {Object} overlayInfo - Informações dos overlays gerados
     * @param {Array} trackpoints - Pontos GPS para sincronização
     * @param {Date} videoStartTime - Tempo de início do vídeo
     * @returns {Promise<string>} Caminho do vídeo final
     */
    async applyOverlaysToVideo(videoPath, overlayInfo, trackpoints, videoStartTime) {
        try {
            const outputFileName = `video_with_overlay_${Date.now()}.mp4`;
            const outputPath = path.join(this.outputDir, outputFileName);

            this.logger.info('Starting video overlay process', {
                inputVideo: videoPath,
                totalOverlays: overlayInfo.files.length,
                outputPath: outputPath
            });

            // Converte SVGs para PNGs primeiro
            const pngOverlays = await this._convertSVGsToPNGs(overlayInfo.files);

            // Cria filtros complexos do FFmpeg
            const filterComplex = this._buildFilterComplex(pngOverlays, trackpoints, videoStartTime);

            // Aplica overlays usando FFmpeg
            await this._processVideoWithFFmpeg(videoPath, outputPath, filterComplex, pngOverlays);

            // Cleanup arquivos temporários
            await this._cleanupTempFiles(pngOverlays);

            this.logger.info('Video overlay process completed successfully', {
                outputPath: outputPath
            });

            return outputPath;

        } catch (error) {
            this.logger.error('Video overlay process failed:', error);
            throw new Error(`Video overlay failed: ${error.message}`);
        }
    }

    /**
     * Converte SVGs para PNGs usando FFmpeg
     * @private
     */
    async _convertSVGsToPNGs(svgFiles) {
        const pngFiles = [];

        this.logger.info(`Converting ${svgFiles.length} SVG files to PNG...`);

        for (let i = 0; i < svgFiles.length; i++) {
            const svgFile = svgFiles[i];
            const pngFileName = svgFile.file.replace('.svg', '.png');

            await this._convertSingleSVGToPNG(svgFile.file, pngFileName);

            pngFiles.push({
                ...svgFile,
                file: pngFileName,
                originalSVG: svgFile.file
            });

            // Log progress a cada 50 conversões
            if ((i + 1) % 50 === 0) {
                this.logger.info(`Converted ${i + 1}/${svgFiles.length} overlays`);
            }
        }

        return pngFiles;
    }

    /**
     * Converte um SVG para PNG
     * @private
     */
    _convertSingleSVGToPNG(svgPath, pngPath) {
        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(svgPath)
                .outputOptions([
                    '-vf', 'scale=400:300',
                    '-y' // Overwrite output file
                ])
                .output(pngPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
    }

    /**
     * Constrói filtros complexos do FFmpeg para overlays dinâmicos
     * @private
     */
    _buildFilterComplex(pngOverlays, trackpoints, videoStartTime) {
        let filterComplex = '';
        let currentInput = '[0:v]';

        // Calcula duração de cada overlay baseada no tempo entre pontos
        for (let i = 0; i < pngOverlays.length; i++) {
            const overlay = pngOverlays[i];

            // Calcula tempo de início do overlay no vídeo
            const overlayStartTime = (overlay.timestamp - videoStartTime) / 1000; // segundos

            // Calcula duração do overlay
            let overlayDuration = 1; // 1 segundo por padrão
            if (i < pngOverlays.length - 1) {
                const nextOverlay = pngOverlays[i + 1];
                overlayDuration = (nextOverlay.timestamp - overlay.timestamp) / 1000;
            }

            // Evita overlays muito longos ou muito curtos
            overlayDuration = Math.max(0.1, Math.min(overlayDuration, 5));

            const outputLabel = `[overlay${i}]`;

            filterComplex += `${currentInput}[${i + 1}:v]overlay=0:0:enable='between(t,${overlayStartTime},${overlayStartTime + overlayDuration})'${outputLabel};`;

            currentInput = outputLabel;
        }

        // Remove último ponto e vírgula
        filterComplex = filterComplex.slice(0, -1);

        this.logger.debug('Filter complex created', { filterLength: filterComplex.length });

        return filterComplex;
    }

    /**
     * Processa vídeo com FFmpeg aplicando filtros complexos
     * @private
     */
    _// src/services/VideoOverlayService.js
    _processVideoWithFFmpeg(inputVideoPath, outputPath, filterComplex, pngOverlays) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                ffmpegCommand.kill('SIGKILL');
                reject(new Error('FFmpeg timeout after 10 minutes'));
            }, 10 * 60 * 1000); // 10 minutos

            let ffmpegCommand = ffmpeg()
                .input(inputVideoPath);

            pngOverlays.forEach(overlay => {
                ffmpegCommand = ffmpegCommand.input(overlay.file);
            });

            ffmpegCommand
                .complexFilter(filterComplex)
                .outputOptions([
                    '-c:v', 'libx264',
                    '-preset', 'medium',
                    '-crf', '23',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-movflags', '+faststart',
                    '-y'
                ])
                .output(outputPath)
                .on('end', () => {
                    clearTimeout(timeout);
                    resolve();
                })
                .on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                })
                .run();
        });
    }

    async _scheduleCleanup() {
        // Cleanup inicial na inicialização
        await this._performCleanup();

        // Agendar limpeza periódica
        setInterval(async () => {
            await this._performCleanup();
        }, 60 * 60 * 1000); // A cada hora
    }

    async _performCleanup() {
        try {
            const now = Date.now();
            const outputFiles = await fs.readdir(this.outputDir);

            for (const file of outputFiles) {
                const filePath = path.join(this.outputDir, file);
                const stats = await fs.stat(filePath);

                // Remove arquivos mais antigos que 24h
                if (now - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
                    await fs.unlink(filePath);
                    this.logger.info(`Cleanup: removed old file ${file}`);
                }
            }
        } catch (error) {
            this.logger.error('Cleanup failed:', error);
        }
    }

    /**
     * Aplica overlays usando método mais simples
     * Para casos onde o método complexo falha
     */
    async applySimpleOverlay(videoPath, overlayInfo, trackpoints, videoStartTime) {
        try {
            const outputFileName = `video_simple_overlay_${Date.now()}.mp4`;
            const outputPath = path.join(this.outputDir, outputFileName);

            // Cria um overlay estático representativo
            const representativeOverlay = await this._createRepresentativeOverlay(overlayInfo.files);

            // Aplica overlay estático
            await this._applyStaticOverlay(videoPath, outputPath, representativeOverlay);

            this.logger.info('Simple overlay applied successfully', { outputPath });

            return outputPath;

        } catch (error) {
            this.logger.error('Simple overlay failed:', error);
            throw error;
        }
    }

    /**
     * Cria overlay representativo (médias dos valores)
     * @private
     */
    async _createRepresentativeOverlay(overlayFiles) {
        // Para simplicidade, usa o overlay do meio da sequência
        const middleIndex = Math.floor(overlayFiles.length / 2);
        const middleOverlay = overlayFiles[middleIndex];

        // Converte para PNG
        const pngPath = middleOverlay.file.replace('.svg', '_static.png');
        await this._convertSingleSVGToPNG(middleOverlay.file, pngPath);

        return pngPath;
    }

    /**
     * Aplica overlay estático ao vídeo
     * @private
     */
    _applyStaticOverlay(inputPath, outputPath, overlayPath) {
        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(inputPath)
                .input(overlayPath)
                .complexFilter([
                    '[1:v]format=rgba,colorchannelmixer=aa=0.8[ovrl]',
                    '[0:v][ovrl]overlay=0:0'
                ])
                .outputOptions([
                    '-c:v', 'libx264',
                    '-preset', 'medium',
                    '-crf', '23',
                    '-c:a', 'copy',
                    '-movflags', '+faststart'
                ])
                .output(outputPath)
                .on('progress', (progress) => {
                    if (progress.percent) {
                        this.logger.info(`Static overlay progress: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
    }

    /**
     * Limpa arquivos temporários
     * @private
     */
    async _cleanupTempFiles(pngOverlays) {
        try {
            await Promise.all(
                pngOverlays.map(overlay => fs.unlink(overlay.file).catch(() => { }))
            );
            this.logger.info(`Cleaned up ${pngOverlays.length} temporary PNG files`);
        } catch (error) {
            this.logger.warn('Failed to cleanup some temporary files:', error);
        }
    }

    /**
     * Extrai informações do vídeo (duração, FPS, etc.)
     */
    async getVideoInfo(videoPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    reject(err);
                    return;
                }

                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                if (!videoStream) {
                    reject(new Error('No video stream found'));
                    return;
                }

                resolve({
                    duration: parseFloat(metadata.format.duration),
                    fps: this._parseFPS(videoStream.r_frame_rate),
                    width: videoStream.width,
                    height: videoStream.height,
                    bitrate: parseInt(metadata.format.bit_rate)
                });
            });
        });
    }

    /**
     * Parse FPS string do FFmpeg
     * @private
     */
    _parseFPS(fpsString) {
        if (!fpsString) return 30;

        const parts = fpsString.split('/');
        if (parts.length === 2) {
            return parseFloat(parts[0]) / parseFloat(parts[1]);
        }
        return parseFloat(fpsString);
    }

    /**
     * Gera vídeo de preview apenas com alguns overlays
     */
    async generatePreview(videoPath, overlayInfo, trackpoints, videoStartTime) {
        try {
            const outputFileName = `preview_${Date.now()}.mp4`;
            const outputPath = path.join(this.outputDir, outputFileName);

            // Usa apenas alguns overlays para o preview (a cada 30 frames)
            const previewOverlays = overlayInfo.files.filter((_, index) => index % 30 === 0);

            this.logger.info('Generating preview with reduced overlays', {
                totalOverlays: overlayInfo.files.length,
                previewOverlays: previewOverlays.length
            });

            const pngOverlays = await this._convertSVGsToPNGs(previewOverlays);
            const filterComplex = this._buildFilterComplex(pngOverlays, trackpoints, videoStartTime);

            // Processa apenas os primeiros 30 segundos para preview
            await this._processPreviewWithFFmpeg(videoPath, outputPath, filterComplex, pngOverlays);

            await this._cleanupTempFiles(pngOverlays);

            return outputPath;

        } catch (error) {
            this.logger.error('Preview generation failed:', error);
            throw error;
        }
    }

    /**
     * Processa preview com duração limitada
     * @private
     */
    _processPreviewWithFFmpeg(inputVideoPath, outputPath, filterComplex, pngOverlays) {
        return new Promise((resolve, reject) => {
            let ffmpegCommand = ffmpeg()
                .input(inputVideoPath)
                .inputOptions(['-t', '30']); // Apenas 30 segundos

            pngOverlays.forEach(overlay => {
                ffmpegCommand = ffmpegCommand.input(overlay.file);
            });

            ffmpegCommand
                .complexFilter(filterComplex)
                .outputOptions([
                    '-c:v', 'libx264',
                    '-preset', 'fast', // Preset mais rápido para preview
                    '-crf', '28', // Qualidade menor para preview
                    '-c:a', 'aac',
                    '-b:a', '96k',
                    '-y'
                ])
                .output(outputPath)
                .on('progress', (progress) => {
                    if (progress.percent) {
                        this.logger.info(`Preview progress: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
    }

    async _ensureOutputDirectory() {
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
        } catch (error) {
            // Directory already exists
        }
    }
}

module.exports = VideoOverlayService;