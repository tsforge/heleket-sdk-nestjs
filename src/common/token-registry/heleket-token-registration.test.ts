import { describe, expect, it } from 'vitest';
import { HeleketTokenRegistration } from './heleket-token-registration';

describe('HeleketTokenRegistration', () => {
    it('registers a token without throwing', () => {
        expect(() => new HeleketTokenRegistration('TEST_TOKEN_A')).not.toThrow();
    });

    it('throws when the same token is registered twice', () => {
        new HeleketTokenRegistration('TEST_TOKEN_B');

        expect(() => new HeleketTokenRegistration('TEST_TOKEN_B')).toThrow(
            /already registered for token "TEST_TOKEN_B"/,
        );
    });

    it('frees the token on onModuleDestroy, allowing re-registration', () => {
        const registration = new HeleketTokenRegistration('TEST_TOKEN_C');

        registration.onModuleDestroy();

        expect(() => new HeleketTokenRegistration('TEST_TOKEN_C')).not.toThrow();
    });

    it('treats distinct tokens independently', () => {
        new HeleketTokenRegistration('TEST_TOKEN_D1');

        expect(() => new HeleketTokenRegistration('TEST_TOKEN_D2')).not.toThrow();
    });
});
