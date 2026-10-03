import { describe, expect, it } from 'vitest';
import { Provider, ValueProvider } from '@nestjs/common';
import { HeleketNestjsModule } from './heleket-sdk-nestjs.module';
import { getHeleketToken } from './common/utils';

type DestroyableValueProvider = ValueProvider<{ onModuleDestroy: () => void }>;

function hasOnModuleDestroyValue(provider: Provider): provider is DestroyableValueProvider {
    if (typeof provider !== 'object' || !('useValue' in provider)) {
        return false;
    }
    const value: unknown = provider.useValue;
    return (
        typeof value === 'object' &&
        value !== null &&
        'onModuleDestroy' in value &&
        typeof value.onModuleDestroy === 'function'
    );
}

const baseOptions = { merchantUuid: 'merchant-uuid', paymentKey: 'payment-key' };

describe('HeleketNestjsModule.forRoot', () => {
    it('registers a provider under the token derived from the name', () => {
        const dynamicModule = HeleketNestjsModule.forRoot({ ...baseOptions, name: 'named-case' });

        const provider = dynamicModule.exports?.[0];
        expect(provider).toBeDefined();
        expect(provider).toMatchObject({ provide: getHeleketToken('named-case') });
    });

    it('throws when forRoot is called twice with the same name', () => {
        HeleketNestjsModule.forRoot({ ...baseOptions, name: 'dup-case' });

        expect(() => HeleketNestjsModule.forRoot({ ...baseOptions, name: 'dup-case' })).toThrow(
            /already registered/,
        );
    });

    it('does not throw for two different names', () => {
        HeleketNestjsModule.forRoot({ ...baseOptions, name: 'multi-a' });

        expect(() =>
            HeleketNestjsModule.forRoot({ ...baseOptions, name: 'multi-b' }),
        ).not.toThrow();
    });

    it('frees the name again once the module instance is destroyed', () => {
        const dynamicModule = HeleketNestjsModule.forRoot({ ...baseOptions, name: 'destroy-case' });

        const registration = dynamicModule.providers?.find(hasOnModuleDestroyValue);
        expect(registration).toBeDefined();

        registration?.useValue.onModuleDestroy();

        expect(() =>
            HeleketNestjsModule.forRoot({ ...baseOptions, name: 'destroy-case' }),
        ).not.toThrow();
    });
});

describe('HeleketNestjsModule.forRootAsync', () => {
    it('registers a provider under the token derived from the name and forwards inject', () => {
        const dynamicModule = HeleketNestjsModule.forRootAsync({
            name: 'async-case',
            inject: ['SOME_TOKEN'],
            useFactory: () => baseOptions,
        });

        const provider = dynamicModule.exports?.[0];
        expect(provider).toBeDefined();
        expect(provider).toMatchObject({
            provide: getHeleketToken('async-case'),
            inject: ['SOME_TOKEN'],
        });
    });

    it('throws when forRootAsync is called twice with the same name', () => {
        HeleketNestjsModule.forRootAsync({ name: 'async-dup', useFactory: () => baseOptions });

        expect(() =>
            HeleketNestjsModule.forRootAsync({ name: 'async-dup', useFactory: () => baseOptions }),
        ).toThrow(/already registered/);
    });
});
