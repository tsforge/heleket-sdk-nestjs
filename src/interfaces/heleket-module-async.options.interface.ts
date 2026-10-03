import { FactoryProvider, InjectionToken, ModuleMetadata } from '@nestjs/common';
import { IHeleketConfig } from '../common/utils/create-heleket-sdk-factory/interfaces';

export interface IHeleketModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    /** Client name, required to register more than one client. */
    name?: string;
    inject?: InjectionToken[];
    /** Same signature as Nest's own factory providers, so injected deps can be typed: `(config: ConfigService) => ...`. */
    useFactory: FactoryProvider<Promise<IHeleketConfig> | IHeleketConfig>['useFactory'];
}
