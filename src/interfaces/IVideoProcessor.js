/**
 * Interface para processamento de vídeos
 * @interface IVideoProcessor
 */
class IVideoProcessor {
    /**
     * @param {string} videoPath 
     * @returns {Promise<Object>} metadata
     */
    async extractMetadata(videoPath) {
        throw new Error('Method extractMetadata must be implemented');
    }

    /**
     * @param {string} videoPath 
     * @returns {Promise<boolean>} validation result
     */
    async validateVideoFile(videoPath) {
        throw new Error('Method validateVideoFile must be implemented');
    }
}

module.exports = IVideoProcessor;