const express = require('express');
const axios = require('axios');
const path = require('path');

// Config
const Environment = require('./config/Environment');
const UploadConfig = require('./config/Upload');
const TokenManager = require('./config/TokenManager');

// Middlewares
const LanguageMiddleware = require('./middlewares/LanguageMiddleware');
const AuthMiddleware = require('./middlewares/AuthMiddleware');
const ErrorMiddleware = require('./middlewares/ErrorMiddleware');
const RequestLoggerMiddleware = require('./middlewares/RequestLoggerMiddleware');

// Services
const StravaService = require('./services/StravaService');
const VideoService = require('./services/VideoService');
const GpsService = require('./services/GpsService');
const TimeService = require('./services/TimeService');

// Repositories
const StravaRepository = require('./repositories/StravaRepository');
const VideoProcessor = require('./repositories/VideoProcessor');

// Controllers
const ActivityController = require('./controllers/ActivityController');
const VideoController = require('./controllers/VideoController');

// Utils
const Logger = require('./utils/Logger');

/**
 * Classe principal da aplicação
 * Aplica DIP - depende de abstrações através de injeção de dependência
 */
class App {
    constructor() {
        this.app = express();
        this.logger = new Logger('App');

        // Inicializa dependências
        this._initializeDependencies();

        // Configura Express
        this._configureExpress();

        // Configura middlewares
        this._configureMiddlewares();

        // Configura rotas
        this._configureRoutes();

        // Configura tratamento de erros
        this._configureErrorHandling();
    }

    _initializeDependencies() {
        // Managers
        this.tokenManager = new TokenManager();
        this.uploadConfig = new UploadConfig();

        // Middlewares
        this.languageMiddleware = new LanguageMiddleware();
        this.authMiddleware = new AuthMiddleware(this.tokenManager);
        this.errorMiddleware = new ErrorMiddleware();
        this.requestLoggerMiddleware = new RequestLoggerMiddleware();

        // Repositories & Processors
        this.videoProcessor = new VideoProcessor();

        // Services
        this.timeService = new TimeService();
        this.gpsService = new GpsService();

        this.logger.info('Dependencies initialized successfully');
    }

    _configureExpress() {
        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(__dirname, '../views'));
        this.app.use(express.static(path.join(__dirname, '../public')));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    _configureMiddlewares() {
        // Request logging (apenas em desenvolvimento)
        if (Environment.isDevelopment()) {
            this.app.use(this.requestLoggerMiddleware.log());
        }

        // Language middleware
        this.app.use(this.languageMiddleware.configure());
    }

    _configureRoutes() {
        // Rota inicial
        this.app.get('/', (req, res) => {
            res.render('index', { t: req.t, lang: req.language });
        });

        // Rotas de autenticação
        this._configureAuthRoutes();

        // Rotas protegidas
        this._configureProtectedRoutes();
    }

    _configureAuthRoutes() {
        // Autorização OAuth
        this.app.get('/authorize', (req, res) => {
            const authUrl = `https://www.strava.com/oauth/authorize?client_id=${Environment.STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${Environment.REDIRECT_URI}&approval_prompt=force&scope=read,activity:read_all`;
            res.redirect(authUrl);
        });

        // Callback OAuth
        this.app.get('/callback', async (req, res) => {
            try {
                const response = await axios.post('https://www.strava.com/oauth/token', {
                    client_id: Environment.STRAVA_CLIENT_ID,
                    client_secret: Environment.STRAVA_CLIENT_SECRET,
                    code: req.query.code,
                    grant_type: 'authorization_code'
                });

                this.tokenManager.setTokens(response.data);
                res.redirect('/activities');
            } catch (error) {
                this.logger.error('OAuth callback failed:', error);
                res.status(500).render('error', {
                    message: 'Authentication failed',
                    t: req.t,
                    lang: req.language
                });
            }
        });
    }

    _configureProtectedRoutes() {
        const authRequired = this.authMiddleware.requireAuth();

        // Middleware para inicializar controllers em rotas protegidas
        const initControllers = (req, res, next) => {
            // Cria instâncias dinâmicas com token atual
            const stravaRepository = new StravaRepository(this.tokenManager.getAccessToken());
            const stravaService = new StravaService(stravaRepository, this.timeService);
            const videoService = new VideoService(this.videoProcessor, this.timeService);

            // Controllers
            req.activityController = new ActivityController(stravaService, this.gpsService);
            req.videoController = new VideoController(stravaService, videoService, this.gpsService);

            next();
        };

        // Rotas de atividades
        this.app.get('/activities', authRequired, initControllers, (req, res) => {
            req.activityController.listActivities(req, res);
        });

        this.app.get('/activity/:id', authRequired, initControllers, (req, res) => {
            req.activityController.showActivity(req, res);
        });

        // Upload de vídeo
        this.app.post('/activity/:id/upload',
            authRequired,
            this.uploadConfig.getMulterConfig().single('videoFile'),
            initControllers,
            (req, res) => {
                req.videoController.uploadAndSync(req, res);
            }
        );
    }

    _configureErrorHandling() {
        // 404 handler
        this.app.use(this.errorMiddleware.notFoundHandler());

        // Global error handler
        this.app.use(this.errorMiddleware.globalErrorHandler());
    }

    start() {
        const port = Environment.PORT;

        this.app.listen(port, () => {
            this.logger.info('Server started successfully', {
                port: port,
                environment: Environment.NODE_ENV,
                redirectUri: Environment.REDIRECT_URI
            });
        });
    }

    getExpressApp() {
        return this.app;
    }
}

module.exports = App;