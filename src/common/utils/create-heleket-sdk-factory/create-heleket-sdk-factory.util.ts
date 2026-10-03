import { HeleketClient } from '@tsforge7/heleket-sdk';
import { Logger } from '@nestjs/common';
import { IHeleketConfig } from './interfaces';

const logger = new Logger('heleket-sdk-nestjs');

export function createHeleketSdkFactory(moduleOptions: IHeleketConfig): HeleketClient {
    const heleketApi = new HeleketClient(moduleOptions);
    logger.log('HeleketClient initialized');
    return heleketApi;
}
