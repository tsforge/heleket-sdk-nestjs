# Heleket SDK for NestJS

**English** | [Русский](./README.ru.md)

![npm version](https://img.shields.io/npm/v/@tsforge7/heleket-sdk-nestjs)
![Downloads](https://img.shields.io/npm/dt/@tsforge7/heleket-sdk-nestjs)
![License](https://img.shields.io/npm/l/@tsforge7/heleket-sdk-nestjs)
![Build Status](https://img.shields.io/github/actions/workflow/status/tsforge/heleket-sdk-nestjs/deploy-lib.yml)
![Types](https://img.shields.io/npm/types/@tsforge7/heleket-sdk-nestjs)
![Node](https://img.shields.io/node/v/@tsforge7/heleket-sdk-nestjs)
![npm unpacked size](https://img.shields.io/npm/unpacked-size/@tsforge7/heleket-sdk-nestjs)
![Last Update](https://img.shields.io/npm/last-update/@tsforge7/heleket-sdk-nestjs)

NestJS module for the [Heleket](https://heleket.com) crypto payment API: accept crypto payments, create static wallets, check statuses, pay out and verify webhooks.

This is a wrapper around [@tsforge7/heleket-sdk](https://github.com/tsforge/heleket-sdk) — it registers a ready-to-use `HeleketClient` instance in the NestJS DI container and provides the `@InjectHeleket()` decorator for injecting it into your services.

📖 [SDK documentation](https://github.com/tsforge/heleket-sdk)

---

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Configuration](#configuration)
    - [Synchronous — `forRoot()`](#synchronous--forroot)
    - [Asynchronous — `forRootAsync()`](#asynchronous--forrootasync)
- [Multiple instances](#multiple-instances)
- [What the SDK can do](#what-the-sdk-can-do)
- [Examples](#examples)
    - [Service](#service)
    - [CQRS handler](#cqrs-handler)
    - [Webhooks](#webhooks)
- [Error handling](#error-handling)
- [Module API](#module-api)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [License](#license)

---

## Installation

```bash
npm install @tsforge7/heleket-sdk-nestjs @tsforge7/heleket-sdk
```

## Quick start

**1. Import the module** — it is global, a single import in `AppModule` is enough:

```typescript
import { Module } from '@nestjs/common';
import { HeleketNestjsModule } from '@tsforge7/heleket-sdk-nestjs';

@Module({
    imports: [
        HeleketNestjsModule.forRoot({
            merchantUuid: process.env.HELEKET_MERCHANT_UUID!,
            paymentKey: process.env.HELEKET_PAYMENT_KEY,
            payoutKey: process.env.HELEKET_PAYOUT_KEY,
        }),
    ],
})
export class AppModule {}
```

**2. Inject the SDK and create a payment:**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectHeleket } from '@tsforge7/heleket-sdk-nestjs';
import { HeleketClient } from '@tsforge7/heleket-sdk';

@Injectable()
export class PaymentService {
    constructor(@InjectHeleket() private readonly heleket: HeleketClient) {}

    public async createInvoice(amount: string, orderId: string) {
        const res = await this.heleket.payment.create({
            amount,
            currency: 'USDT',
            orderId,
            urlCallback: 'https://myshop.com/heleket/webhook',
        });

        // res.isSuccess, res.data.url — redirect the customer here
        return res;
    }
}
```

**3. Next:** the customer pays → Heleket sends a [webhook](#webhooks) → you credit the order.

## Configuration

| Parameter      | Required                        | Description                                              |
| -------------- | ------------------------------- | -------------------------------------------------------- |
| `merchantUuid` | yes                             | Your merchant UUID from the dashboard                    |
| `paymentKey`   | one of `paymentKey`/`payoutKey` | API key used to sign/verify payment requests             |
| `payoutKey`    | one of `paymentKey`/`payoutKey` | API key used to sign/verify payout requests              |
| `baseUrl`      | no                              | API URL, defaults to `https://api.heleket.com`           |
| `timeoutMs`    | no                              | Per-request timeout, defaults to the SDK's 30s           |
| `retry`        | no                              | Retry overrides (`retries`, `baseDelayMs`, `maxDelayMs`) |

At least one of `paymentKey` / `payoutKey` must be provided. The config is validated at application startup: a missing `merchantUuid` or both keys missing fails immediately with a clear error, not on the first request.

> ⚠️ **Never commit keys to git.** Keep them in environment variables — anyone who knows your keys can make requests on your behalf.

### Synchronous — `forRoot()`

Use it when the keys are available at module load time:

```typescript
HeleketNestjsModule.forRoot({
    merchantUuid: process.env.HELEKET_MERCHANT_UUID!,
    paymentKey: process.env.HELEKET_PAYMENT_KEY,
    payoutKey: process.env.HELEKET_PAYOUT_KEY,
});
```

### Asynchronous — `forRootAsync()`

Use it when the keys come from `ConfigService` or another provider:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HeleketNestjsModule, IHeleketModuleOptions } from '@tsforge7/heleket-sdk-nestjs';

@Module({
    imports: [
        HeleketNestjsModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService): IHeleketModuleOptions => ({
                merchantUuid: config.getOrThrow<string>('HELEKET_MERCHANT_UUID'),
                paymentKey: config.get<string>('HELEKET_PAYMENT_KEY'),
                payoutKey: config.get<string>('HELEKET_PAYOUT_KEY'),
            }),
            inject: [ConfigService],
        }),
    ],
})
export class AppModule {}
```

## Multiple instances

Need two `HeleketClient`s side by side — e.g. two merchant accounts? Pass a `name` to `forRoot`/`forRootAsync` and the same `name` to `@InjectHeleket()`. Without a `name`, both resolve to the single default instance:

```typescript
@Module({
    imports: [
        HeleketNestjsModule.forRoot({
            merchantUuid: process.env.HELEKET_MERCHANT_UUID!,
            paymentKey: process.env.HELEKET_PAYMENT_KEY,
        }),
        HeleketNestjsModule.forRoot({
            name: 'secondary',
            merchantUuid: process.env.HELEKET_SECONDARY_MERCHANT_UUID!,
            paymentKey: process.env.HELEKET_SECONDARY_PAYMENT_KEY,
        }),
    ],
})
export class AppModule {}
```

```typescript
@Injectable()
export class PaymentService {
    constructor(
        @InjectHeleket() private readonly heleket: HeleketClient,
        @InjectHeleket('secondary') private readonly heleketSecondary: HeleketClient,
    ) {}
}
```

Each named instance gets its own DI token (`HELEKET_SDK_NESTJS_<name>` under the hood). Calling `forRoot`/`forRootAsync` twice with the **same** name (or twice without a name) throws immediately — `HeleketNestjsModule: an instance is already registered for token "..."` — so pick a distinct name per instance. In tests, close the app (`await app.close()`) between test cases that register the same name; that runs the module's teardown and frees the name for reuse.

## What the SDK can do

The injected `HeleketClient` instance gives access to all SDK modules:

| What you need to do                     | Method                            |
| --------------------------------------- | --------------------------------- |
| Create a crypto invoice                 | `heleket.payment.create()`        |
| Invoice status by `uuid`/`orderId`      | `heleket.payment.info()`          |
| Networks/currencies/limits for payments | `heleket.payment.services()`      |
| Page of invoices (cursor pagination)    | `heleket.payment.list()`          |
| Walk all invoices                       | `heleket.payment.historyAll()`    |
| Force webhook re-delivery               | `heleket.payment.resend()`        |
| Create a static deposit wallet          | `heleket.payment.wallet()`        |
| Merchant + user balances                | `heleket.payment.balance()`       |
| Create a payout                         | `heleket.payout.create()`         |
| Payout status                           | `heleket.payout.info()`           |
| Networks/currencies/limits for payouts  | `heleket.payout.services()`       |
| Page of payouts (cursor pagination)     | `heleket.payout.list()`           |
| Verify a payment webhook signature      | `heleket.paymentWebhook.verify()` |
| Verify a payout webhook signature       | `heleket.payoutWebhook.verify()`  |

Constants (`Currency`, `Network`, `PAYMENT_STATUS`, `PAYOUT_STATUS`...), zod schemas and all request/response types are exported from the root of `@tsforge7/heleket-sdk` — no deep imports needed. Full reference — in the [SDK documentation](https://github.com/tsforge/heleket-sdk).

## Examples

### Service

```typescript
import { Injectable } from '@nestjs/common';
import { InjectHeleket } from '@tsforge7/heleket-sdk-nestjs';
import { HeleketClient } from '@tsforge7/heleket-sdk';

@Injectable()
export class PaymentService {
    constructor(@InjectHeleket() private readonly heleket: HeleketClient) {}

    public async createInvoice(amount: string, orderId: string) {
        return this.heleket.payment.create({
            amount,
            currency: 'USDT',
            orderId,
            network: 'TRON',
            urlCallback: 'https://myshop.com/heleket/webhook',
            lifetime: 7200,
        });
    }

    public async getStatus(orderId: string) {
        const res = await this.heleket.payment.info({ orderId });
        return res.isSuccess ? res.data?.status : undefined;
    }
}
```

### CQRS handler

Example for projects using `@nestjs/cqrs`:

```typescript
// create-invoice.command.ts
export class CreateInvoiceCommand {
    constructor(
        public readonly amount: string,
        public readonly orderId: string,
    ) {}
}
```

```typescript
// create-invoice.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { HeleketClient } from '@tsforge7/heleket-sdk';
import { InjectHeleket } from '@tsforge7/heleket-sdk-nestjs';
import { CreateInvoiceCommand } from './create-invoice.command';
import { ICommandResponse } from '@common/types/command-response.type';
import { ERRORS } from '@libs/contracts/constants';

@CommandHandler(CreateInvoiceCommand)
export class CreateInvoiceHandler implements ICommandHandler<CreateInvoiceCommand> {
    public readonly logger = new Logger(CreateInvoiceHandler.name);

    constructor(@InjectHeleket() private readonly heleket: HeleketClient) {}

    public async execute(command: CreateInvoiceCommand): Promise<ICommandResponse> {
        const { amount, orderId } = command;

        const res = await this.heleket.payment.create({
            amount,
            currency: 'USDT',
            orderId,
            urlCallback: 'https://myshop.com/heleket/webhook',
        });

        if (!res.isSuccess) {
            this.logger.error(`[CreateInvoiceHandler] Heleket error: ${res.message}`);
            return { isSuccess: false, ...ERRORS.CREATE_INVOICE_FAILED };
        }

        return { isSuccess: true, data: res.data };
    }
}
```

### Webhooks

When an invoice status changes, Heleket sends a **POST** to `urlCallback`. The body carries a `sign` field (MD5 of the payload) that `paymentWebhook`/`payoutWebhook` verify in constant time.

Verify the **raw** body, not the parsed one: `JSON.parse` + `JSON.stringify` can change key order and break the signature. Enable raw body capture in `main.ts`:

```typescript
const app = await NestFactory.create(AppModule, { rawBody: true });
```

```typescript
import { Controller, Post, Req, Res, HttpStatus, RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectHeleket } from '@tsforge7/heleket-sdk-nestjs';
import { HeleketClient } from '@tsforge7/heleket-sdk';

@Controller('heleket')
export class HeleketWebhookController {
    constructor(@InjectHeleket() private readonly heleket: HeleketClient) {}

    @Post('webhook')
    public async handleWebhook(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
        // 1. Is the signature valid? Verify the raw string, not the parsed object.
        if (!req.rawBody || !this.heleket.paymentWebhook.verify(req.rawBody.toString('utf8'))) {
            return res.status(HttpStatus.UNAUTHORIZED).end();
        }

        // 2. Don't take the webhook at its word — re-check the status via the API
        const invoice = await this.heleket.payment.info({ orderId: req.body.order_id });

        if (invoice.isSuccess && ['paid', 'paid_over'].includes(invoice.data?.status ?? '')) {
            // 3. Verify the amount/currency against the order and credit it (idempotently —
            //    Heleket may retry the webhook, the order must not be credited twice)
        }

        // 4. Respond with 200, otherwise Heleket will retry
        return res.status(HttpStatus.OK).end();
    }
}
```

## Error handling

The SDK never throws on API errors — every public method resolves to `ICommandResponse<T>`:

```typescript
const res = await this.heleket.payment.create({/* ... */});

if (res.isSuccess) {
    console.log(res.data);
} else {
    // Validation error or Heleket API error — stable error code + message
    console.log(res.code, res.message, res.errors);
}
```

Throws are reserved for misconfiguration — e.g. calling `heleket.payout` when only `paymentKey` was provided.

## Module API

| Export                                   | Description                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `HeleketNestjsModule.forRoot(options)`   | Synchronous configuration (`name?` for [multiple instances](#multiple-instances))           |
| `HeleketNestjsModule.forRootAsync(opts)` | Asynchronous configuration (`useFactory` / `imports` / `inject` / `name?`)                  |
| `@InjectHeleket(name?)`                  | Decorator that injects the `HeleketClient` instance (default or named)                      |
| `IHeleketModuleOptions`                  | Module options type (`merchantUuid`, `paymentKey?`, `payoutKey?`, `baseUrl?`, `name?`, ...) |

The module is marked `@Global()` — import it once in the root module, after that `@InjectHeleket()` works anywhere in the application without re-imports.

## Requirements

- Node.js 18+ (the SDK uses the built-in `fetch`)
- NestJS 10+
- TypeScript 5.0+

## Contributing

**Found a bug?** Open an [Issue](https://github.com/tsforge/heleket-sdk-nestjs/issues/new) — describe what you did, what you expected and what you got (error code, module, SDK and Node versions). Please never include your real API keys or transaction data in an issue.

**Want to propose a change?** Direct pushes to the repository are not allowed — changes are accepted via a Merge Request from a fork:

1. **Fork** the repository — the "Fork" button on the [tsforge/heleket-sdk-nestjs](https://github.com/tsforge/heleket-sdk-nestjs) page.
2. **Clone your fork** and create a branch:

    ```bash
    git clone git@github.com:<your-login>/heleket-sdk-nestjs.git
    cd heleket-sdk-nestjs
    npm install
    git checkout -b fix/my-fix
    ```

3. **Make your changes** and make sure everything is green:

    ```bash
    npm run lint      # linter
    npm run build     # build
    npm run format    # prettier
    ```

    Keep code comments in English.

4. **Push the branch to your fork** and open a Merge Request into `main` of the upstream repository. Describe what you changed and why; if the MR closes an issue, reference it (`Closes #N`).

## License

ISC © [tsforge](https://github.com/tsforge)
