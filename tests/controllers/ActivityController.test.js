const ActivityController = require('../../src/controllers/ActivityController');
const StravaService = require('../../src/services/StravaService');
const GpsService = require('../../src/services/GpsService');

// Mocks
jest.mock('../../src/services/StravaService');
jest.mock('../../src/services/GpsService');

describe('ActivityController', () => {
    let controller;
    let mockStravaService;
    let mockGpsService;
    let req;
    let res;

    beforeEach(() => {
        mockStravaService = new StravaService();
        mockGpsService = new GpsService();
        controller = new ActivityController(mockStravaService, mockGpsService);

        req = {
            query: {},
            params: {},
            language: 'en',
            t: {}
        };

        res = {
            render: jest.fn(),
            status: jest.fn().mockReturnThis(),
            redirect: jest.fn()
        };
    });

    describe('listActivities', () => {
        test('should render activities successfully', async () => {
            const mockActivities = [
                { id: 1, name: 'Morning Run', type: 'Run' },
                { id: 2, name: 'Evening Ride', type: 'Ride' }
            ];

            mockStravaService.getAthleteActivities.mockResolvedValue(mockActivities);

            await controller.listActivities(req, res);

            expect(mockStravaService.getAthleteActivities).toHaveBeenCalledWith({
                perPage: 30,
                filter: 'gps',
                translations: req.t
            });

            expect(res.render).toHaveBeenCalledWith('activities', {
                activities: mockActivities,
                t: req.t,
                lang: req.language,
                currentFilter: 'gps'
            });
        });

        test('should handle service error', async () => {
            const error = new Error('Service failed');
            mockStravaService.getAthleteActivities.mockRejectedValue(error);

            await controller.listActivities(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.render).toHaveBeenCalledWith('error', expect.any(Object));
        });
    });

    describe('showActivity', () => {
        test('should render activity details successfully', async () => {
            const mockActivity = {
                id: 1,
                name: 'Morning Run',
                start_date: '2025-08-16T20:18:15.000Z'
            };
            const mockTrackpoints = [];

            req.params.id = '1';
            mockStravaService.getActivityWithStreams.mockResolvedValue({
                activity: mockActivity,
                trackpoints: mockTrackpoints
            });

            await controller.showActivity(req, res);

            expect(mockStravaService.getActivityWithStreams).toHaveBeenCalledWith('1');
            expect(res.render).toHaveBeenCalledWith('activity_detail', expect.objectContaining({
                activity: mockActivity,
                trackpoints: mockTrackpoints
            }));
        });
    });
});
