const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Constants = require('../utils/Constants');

/**
 * Configuração de upload
 * Aplica SRP - responsável apenas por configurar uploads
 */
class UploadConfig {
    constructor() {
        this.uploadDir = 'uploads';
        this._ensureUploadDirectory();
    }

    getMulterConfig() {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => cb(null, this.uploadDir),
            filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
        });

        return multer({
            storage: storage,
            limits: {
                fileSize: Constants.VIDEO_MAX_SIZE,
            },
            fileFilter: (req, file, cb) => {
                if (Constants.SUPPORTED_VIDEO_TYPES.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('Only video files are allowed.'), false);
                }
            }
        });
    }

    _ensureUploadDirectory() {
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }
}

module.exports = UploadConfig;