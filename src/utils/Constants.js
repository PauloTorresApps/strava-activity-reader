/**
 * Constantes da aplicação
 * Aplica SRP - centralizando constantes
 */
class Constants {
    static get STRAVA_API_BASE_URL() {
        return 'https://www.strava.com/api/v3';
    }

    static get STRAVA_OAUTH_URL() {
        return 'https://www.strava.com/oauth';
    }

    static get VIDEO_MAX_SIZE() {
        return 500 * 1024 * 1024; // 500MB
    }

    static get SUPPORTED_VIDEO_TYPES() {
        return [
            'video/mp4', 'video/mpeg', 'video/quicktime',
            'video/x-msvideo', 'video/x-ms-wmv'
        ];
    }

    static get SUPPORTED_LANGUAGES() {
        return ['en', 'pt', 'es'];
    }

    static get DEFAULT_ACTIVITIES_PER_PAGE() {
        return 30;
    }

    static get GPS_STREAM_KEYS() {
        return 'latlng,time,distance';
    }
}

module.exports = Constants;