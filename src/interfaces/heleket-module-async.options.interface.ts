import { InjectionToken, ModuleMetadata } from '@nestjs/common';
import { IHeleketConfig } from '../common/utils/create-heleket-sdk-factory/interfaces';

export interface IHeleketModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    /** Client name, required to register more than one client. */
    name?: string;
    inject?: InjectionToken[];
    useFactory: (...args: unknown[]) => Promise<IHeleketConfig> | IHeleketConfig;
}
