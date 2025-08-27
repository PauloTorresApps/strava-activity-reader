const GpsService = require('../../src/services/GpsService');

describe('GpsService', () => {
    let gpsService;

    beforeEach(() => {
        gpsService = new GpsService();
    });

    describe('findClosestTrackpoint', () => {
        test('should find closest trackpoint by time', () => {
            const trackpoints = [
                {
                    latlng: [-10.1, -48.2],
                    time: new Date('2025-08-16T20:15:00.000Z')
                },
                {
                    latlng: [-10.2, -48.3],
                    time: new Date('2025-08-16T20:18:15.000Z')
                },
                {
                    latlng: [-10.3, -48.4],
                    time: new Date('2025-08-16T20:20:00.000Z')
                }
            ];

            const targetTime = new Date('2025-08-16T20:18:10.000Z');
            const result = gpsService.findClosestTrackpoint(trackpoints, targetTime);

            expect(result).not.toBeNull();
            expect(result.latlng).toEqual([-10.2, -48.3]);
            expect(result.time.toISOString()).toBe('2025-08-16T20:18:15.000Z');
        });

        test('should return null for empty trackpoints', () => {
            const result = gpsService.findClosestTrackpoint([], new Date());
            expect(result).toBeNull();
        });

        test('should ignore trackpoints without latlng or time', () => {
            const trackpoints = [
                { latlng: null, time: new Date('2025-08-16T20:15:00.000Z') },
                { latlng: [-10.2, -48.3], time: null },
                { latlng: [-10.3, -48.4], time: new Date('2025-08-16T20:20:00.000Z') }
            ];

            const targetTime = new Date('2025-08-16T20:18:10.000Z');
            const result = gpsService.findClosestTrackpoint(trackpoints, targetTime);

            expect(result).not.toBeNull();
            expect(result.latlng).toEqual([-10.3, -48.4]);
        });
    });

    describe('calculateBounds', () => {
        test('should calculate bounds correctly', () => {
            const coordinates = [
                [-10.1, -48.2],
                [-10.3, -48.4],
                [-10.0, -48.1]
            ];

            const bounds = gpsService.calculateBounds(coordinates);

            expect(bounds).toEqual({
                north: -10.0,
                south: -10.3,
                east: -48.1,
                west: -48.4
            });
        });

        test('should return null for empty coordinates', () => {
            const bounds = gpsService.calculateBounds([]);
            expect(bounds).toBeNull();
        });
    });
});