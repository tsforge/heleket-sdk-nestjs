import { IHeleketConfig } from '../common/utils/create-heleket-sdk-factory/interfaces';

export interface IHeleketModuleOptions extends IHeleketConfig {
    /** Client name, required to register more than one client. */
    name?: string;
}
