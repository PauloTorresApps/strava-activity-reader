// Configuração global para testes

// Mock do console para testes mais limpos
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Mock de variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.STRAVA_CLIENT_ID = 'test_client_id';
process.env.STRAVA_CLIENT_SECRET = 'test_client_secret';
process.env.PORT = '3001';

// Timeout para testes mais longos (upload de arquivos, etc.)
jest.setTimeout(30000);

// Cleanup após cada teste
afterEach(() => {
    jest.clearAllMocks();
});

// Mock do ffmpeg para testes
jest.mock('fluent-ffmpeg', () => ({
    ffprobe: jest.fn()
}));