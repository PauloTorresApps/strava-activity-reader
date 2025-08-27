const Validator = require('../../src/utils/Validator');

describe('Validator', () => {
    describe('validateActivityId', () => {
        test('should validate correct activity ID', () => {
            expect(() => Validator.validateActivityId('12345678')).not.toThrow();
        });

        test('should reject null or undefined ID', () => {
            expect(() => Validator.validateActivityId(null)).toThrow('Activity ID must be a non-empty string');
            expect(() => Validator.validateActivityId(undefined)).toThrow('Activity ID must be a non-empty string');
        });

        test('should reject non-numeric ID', () => {
            expect(() => Validator.validateActivityId('abc123')).toThrow('Activity ID must contain only numbers');
        });

        test('should reject empty string', () => {
            expect(() => Validator.validateActivityId('')).toThrow('Activity ID must be a non-empty string');
        });
    });

    describe('validateVideoFile', () => {
        test('should validate correct video file', () => {
            const mockFile = {
                mimetype: 'video/mp4',
                size: 100 * 1024 * 1024 // 100MB
            };

            expect(() => Validator.validateVideoFile(mockFile)).not.toThrow();
        });

        test('should reject file too large', () => {
            const mockFile = {
                mimetype: 'video/mp4',
                size: 600 * 1024 * 1024 // 600MB
            };

            expect(() => Validator.validateVideoFile(mockFile)).toThrow('File too large');
        });

        test('should reject invalid mime type', () => {
            const mockFile = {
                mimetype: 'image/jpeg',
                size: 100 * 1024 * 1024
            };

            expect(() => Validator.validateVideoFile(mockFile)).toThrow('Invalid file type');
        });

        test('should reject null file', () => {
            expect(() => Validator.validateVideoFile(null)).toThrow('No file provided');
        });
    });

    describe('validateLanguage', () => {
        test('should return valid supported language', () => {
            expect(Validator.validateLanguage('pt')).toBe('pt');
            expect(Validator.validateLanguage('en')).toBe('en');
            expect(Validator.validateLanguage('es')).toBe('es');
        });

        test('should return default language for unsupported language', () => {
            expect(Validator.validateLanguage('fr')).toBe('en');
            expect(Validator.validateLanguage('de')).toBe('en');
            expect(Validator.validateLanguage('')).toBe('en');
        });
    });

    describe('validatePagination', () => {
        test('should return valid number within range', () => {
            expect(Validator.validatePagination('25')).toBe(25);
            expect(Validator.validatePagination(50)).toBe(50);
        });

        test('should return default for invalid input', () => {
            expect(Validator.validatePagination('abc')).toBe(30);
            expect(Validator.validatePagination(-5)).toBe(30);
            expect(Validator.validatePagination(300)).toBe(30);
        });
    });
});