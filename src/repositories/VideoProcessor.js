const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const IVideoProcessor = require('../interfaces/IVideoProcessor');
const Logger = require('../utils/Logger');

/**
 * Processador de vídeos usando FFmpeg
 * Aplica SRP - responsável apenas pelo processamento de vídeos
 */
class VideoProcessor extends IVideoProcessor {
    constructor() {
        super();
        this.logger = new Logger('VideoProcessor');
        this.allowedMimeTypes = [
            'video/mp4', 'video/mpeg', 'video/quicktime', 
            'video/x-msvideo', 'video/x-ms-wmv'
        ];
    }

    async extractMetadata(videoPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    this.logger.error('Failed to extract video metadata:', err);
                    return reject(new Error('Unable to read video metadata'));
                }

                const creationTime = this._findCreationTime(metadata);
                if (!creationTime) {
                    return reject(new Error('Video does not contain valid creation date metadata'));
                }

                resolve({
                    creationTime,
                    duration: metadata.format.duration,
                    size: metadata.format.size,
                    format: metadata.format.format_name
                });
            });
        });
    }

    async validateVideoFile(videoPath) {
        try {
            if (!fs.existsSync(videoPath)) {
                return false;
            }

            const stats = fs.statSync(videoPath);
            const maxSize = 500 * 1024 * 1024; // 500MB

            return stats.size <= maxSize;
        } catch (error) {
            this.logger.error('Video validation failed:', error);
            return false;
        }
    }

    /**
     * Encontra timestamp de criação em diferentes locais dos metadados
     * @private
     */
    _findCreationTime(metadata) {
        // Procura em format tags
        if (metadata.format?.tags) {
            const formatTime = metadata.format.tags.creation_time || 
                             metadata.format.tags.date ||
                             metadata.format.tags.DATE ||
                             metadata.format.tags['creation-time'];
            if (formatTime) return formatTime;
        }

        // Procura nos streams
        if (metadata.streams) {
            for (const stream of metadata.streams) {
                if (stream.tags) {
                    const streamTime = stream.tags.creation_time || 
                                     stream.tags.date ||
                                     stream.tags.DATE ||
                                     stream.tags['creation-time'];
                    if (streamTime) return streamTime;
                }
            }
        }

        return null;
    }
}

module.exports = VideoProcessor;