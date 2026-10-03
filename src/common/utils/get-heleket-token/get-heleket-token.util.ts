import { MODULE_NAME } from '../../constants';

export function getHeleketToken(name?: string): string {
    return name ? `${MODULE_NAME}_${name}` : MODULE_NAME;
}
