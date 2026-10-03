import { Inject } from '@nestjs/common';
import { getHeleketToken } from '../../common/utils';

export function InjectHeleket(name?: string): ParameterDecorator {
    return Inject(getHeleketToken(name));
}
