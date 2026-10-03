import { OnModuleDestroy } from '@nestjs/common';

const registeredTokens = new Set<string>();

export class HeleketTokenRegistration implements OnModuleDestroy {
    private readonly token: string;

    constructor(token: string) {
        if (registeredTokens.has(token)) {
            throw new Error(
                `HeleketNestjsModule: a client is already registered for token "${token}". ` +
                    'Pass a distinct "name" to forRoot()/forRootAsync() for each client.',
            );
        }
        registeredTokens.add(token);
        this.token = token;
    }

    public onModuleDestroy(): void {
        registeredTokens.delete(this.token);
    }
}
