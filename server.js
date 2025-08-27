/**
 * Entry point da aplicação
 * Aplica SRP - responsável apenas por inicializar a aplicação
 */
const App = require('./src/app');
const Logger = require('./src/utils/Logger');

const logger = new Logger('Server');

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Inicializa aplicação
try {
    const app = new App();
    app.start();
} catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
}