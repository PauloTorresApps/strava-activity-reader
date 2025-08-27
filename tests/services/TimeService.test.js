const TimeService = require('../../src/services/TimeService');

describe('TimeService', () => {
    let timeService;

    beforeEach(() => {
        timeService = new TimeService();
    });

    describe('parseTime', () => {
        test('should parse time with Z timezone correctly', () => {
            const timeString = '2025-08-16T20:18:15.000Z';
            const result = timeService.parseTime(timeString, 'UTC-3', -10800);
            
            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toBe('2025-08-16T20:18:15.000Z');
        });

        test('should parse time without timezone correctly', () => {
            const timeString = '2025-08-16T20:18:15.000';
            const result = timeService.parseTime(timeString, 'UTC-3', -10800);
            
            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toBe('2025-08-16T20:18:15.000Z');
        });

        test('should handle time with offset timezone', () => {
            const timeString = '2025-08-16T20:18:15.000-03:00';
            const result = timeService.parseTime(timeString, 'UTC-3', -10800);
            
            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toBe('2025-08-16T23:18:15.000Z');
        });
    });

    describe('convertToLocal', () => {
        test('should convert UTC to local time correctly', () => {
            const utcTime = new Date('2025-08-16T20:18:15.000Z');
            const utcOffset = -10800; // UTC-3
            
            const result = timeService.convertToLocal(utcTime, utcOffset);
            
            expect(result.toISOString()).toBe('2025-08-16T17:18:15.000Z');
        });

        test('should handle positive UTC offset', () => {
            const utcTime = new Date('2025-08-16T20:18:15.000Z');
            const utcOffset = 7200; // UTC+2
            
            const result = timeService.convertToLocal(utcTime, utcOffset);
            
            expect(result.toISOString()).toBe('2025-08-16T22:18:15.000Z');
        });
    });

    describe('convertToUTC', () => {
        test('should convert local time to UTC correctly', () => {
            const localTime = new Date('2025-08-16T17:18:15.000Z');
            const utcOffset = -10800; // UTC-3
            
            const result = timeService.convertToUTC(localTime, utcOffset);
            
            expect(result.toISOString()).toBe('2025-08-16T20:18:15.000Z');
        });
    });
});