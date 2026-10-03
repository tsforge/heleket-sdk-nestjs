import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { createHeleketSdkFactory, getHeleketToken } from './common/utils';
import { HeleketTokenRegistration } from './common/token-registry';
import { HeleketClient } from '@tsforge7/heleket-sdk';
import { IHeleketModuleAsyncOptions, IHeleketModuleOptions } from './interfaces';

@Global()
@Module({})
export class HeleketNestjsModule {
    public static forRoot(options: IHeleketModuleOptions): DynamicModule {
        const { name, ...heleketOptions } = options;
        const token = getHeleketToken(name);
        const registration = new HeleketTokenRegistration(token);

        const heleketProvider: Provider = {
            provide: token,
            useFactory: (): HeleketClient => createHeleketSdkFactory(heleketOptions),
        };

        return {
            module: HeleketNestjsModule,
            providers: [
                heleketProvider,
                { provide: HeleketTokenRegistration, useValue: registration },
            ],
            exports: [heleketProvider],
        };
    }

    public static forRootAsync(options: IHeleketModuleAsyncOptions): DynamicModule {
        const token = getHeleketToken(options.name);
        const registration = new HeleketTokenRegistration(token);

        const heleketProvider: Provider = {
            provide: token,
            useFactory: async (...args: unknown[]): Promise<HeleketClient> => {
                const heleketOptions = await options.useFactory(...args);
                return createHeleketSdkFactory(heleketOptions);
            },
            inject: options.inject ?? [],
        };

        return {
            module: HeleketNestjsModule,
            imports: options.imports ?? [],
            providers: [
                heleketProvider,
                { provide: HeleketTokenRegistration, useValue: registration },
            ],
            exports: [heleketProvider],
        };
    }
}
