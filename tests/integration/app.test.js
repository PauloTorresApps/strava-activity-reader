const request = require('supertest');
const App = require('../../src/app');

describe('App Integration Tests', () => {
    let app;
    let server;

    beforeAll(() => {
        const appInstance = new App();
        app = appInstance.getExpressApp();
    });

    describe('GET /', () => {
        test('should render index page', async () => {
            const response = await request(app).get('/');
            
            expect(response.status).toBe(200);
            expect(response.text).toContain('Welcome');
        });
    });

    describe('GET /authorize', () => {
        test('should redirect to Strava OAuth', async () => {
            const response = await request(app).get('/authorize');
            
            expect(response.status).toBe(302);
            expect(response.headers.location).toContain('strava.com/oauth/authorize');
        });
    });

    describe('Protected routes', () => {
        test('should redirect unauthenticated requests', async () => {
            const response = await request(app).get('/activities');
            
            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/');
        });
    });

    describe('404 handler', () => {
        test('should return 404 for non-existent routes', async () => {
            const response = await request(app).get('/non-existent-route');
            
            expect(response.status).toBe(404);
        });
    });
});
