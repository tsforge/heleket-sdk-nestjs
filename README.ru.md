# Heleket SDK для NestJS

[English](./README.md) | **Русский**

![npm version](https://img.shields.io/npm/v/@tsforge7/heleket-sdk-nestjs)
![Downloads](https://img.shields.io/npm/dt/@tsforge7/heleket-sdk-nestjs)
![License](https://img.shields.io/npm/l/@tsforge7/heleket-sdk-nestjs)
![Build Status](https://img.shields.io/github/actions/workflow/status/tsforge/heleket-sdk-nestjs/deploy-lib.yml)
![Types](https://img.shields.io/npm/types/@tsforge7/heleket-sdk-nestjs)
![Node](https://img.shields.io/node/v/@tsforge7/heleket-sdk-nestjs)
![npm unpacked size](https://img.shields.io/npm/unpacked-size/@tsforge7/heleket-sdk-nestjs)
![Last Update](https://img.shields.io/npm/last-update/@tsforge7/heleket-sdk-nestjs)

NestJS-модуль для крипто-платёжной системы [Heleket](https://heleket.com): приём платежей в криптовалюте, статические кошельки, проверка статусов, выплаты и проверка вебхуков.

Это обёртка над [@tsforge7/heleket-sdk](https://github.com/tsforge/heleket-sdk) — она регистрирует готовый экземпляр `HeleketClient` в DI-контейнере NestJS и даёт декоратор `@InjectHeleket()` для внедрения в сервисы.

📖 [Документация SDK](https://github.com/tsforge/heleket-sdk)

---

## Оглавление

- [Установка](#установка)
- [Быстрый старт](#быстрый-старт)
- [Конфигурация](#конфигурация)
    - [Синхронная — `forRoot()`](#синхронная--forroot)
    - [Асинхронная — `forRootAsync()`](#асинхронная--forrootasync)
- [Несколько инстансов](#несколько-инстансов)
- [Что умеет SDK](#что-умеет-sdk)
- [Примеры](#примеры)
    - [Сервис](#сервис)
    - [CQRS-хендлер](#cqrs-хендлер)
    - [Вебхуки](#вебхуки)
- [Обработка ошибок](#обработка-ошибок)
- [API модуля](#api-модуля)
- [Требования](#требования)
- [Как внести изменения](#как-внести-изменения)
- [Лицензия](#лицензия)

---

## Установка

```bash
npm install @tsforge7/heleket-sdk-nestjs @tsforge7/heleket-sdk
```

## Быстрый старт

**1. Подключите модуль** — он глобальный, достаточно одного импорта в `AppModule`:

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

**2. Внедрите SDK и создайте платёж:**

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

        // res.isSuccess, res.data.url — сюда редиректим покупателя
        return res;
    }
}
```

**3. Далее:** покупатель оплачивает → Heleket отправляет [вебхук](#вебхуки) → вы засчитываете заказ.

## Конфигурация

| Параметр       | Обязателен                       | Описание                                                   |
| -------------- | -------------------------------- | ---------------------------------------------------------- |
| `merchantUuid` | да                               | UUID вашего мерчанта из личного кабинета                   |
| `paymentKey`   | один из `paymentKey`/`payoutKey` | Ключ API для подписи/проверки платёжных запросов           |
| `payoutKey`    | один из `paymentKey`/`payoutKey` | Ключ API для подписи/проверки выплатных запросов           |
| `baseUrl`      | нет                              | URL API, по умолчанию `https://api.heleket.com`            |
| `timeoutMs`    | нет                              | Таймаут запроса, по умолчанию 30с (значение из SDK)        |
| `retry`        | нет                              | Настройки ретраев (`retries`, `baseDelayMs`, `maxDelayMs`) |

Должен быть указан хотя бы один из `paymentKey` / `payoutKey`. Конфиг проверяется при старте приложения: отсутствие `merchantUuid` или обоих ключей сразу даёт понятную ошибку, а не падение на первом запросе.

> ⚠️ **Никогда не коммитьте ключи в git.** Храните их в переменных окружения — зная ваши ключи, любой может делать запросы от вашего имени.

### Синхронная — `forRoot()`

Используйте, когда ключи доступны на этапе загрузки модуля:

```typescript
HeleketNestjsModule.forRoot({
    merchantUuid: process.env.HELEKET_MERCHANT_UUID!,
    paymentKey: process.env.HELEKET_PAYMENT_KEY,
    payoutKey: process.env.HELEKET_PAYOUT_KEY,
});
```

### Асинхронная — `forRootAsync()`

Используйте, когда ключи приходят из `ConfigService` или другого провайдера:

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

## Несколько инстансов

Нужны два `HeleketClient` одновременно — например, два мерчант-аккаунта? Передайте `name` в `forRoot`/`forRootAsync` и тот же `name` в `@InjectHeleket()`. Без `name` оба резолвятся в единственный инстанс по умолчанию:

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

У каждого именованного инстанса свой DI-токен (под капотом `HELEKET_SDK_NESTJS_<name>`). Вызов `forRoot`/`forRootAsync` два раза с **одинаковым** именем (или два раза без имени) сразу бросает ошибку — `HeleketNestjsModule: an instance is already registered for token "..."` — поэтому для каждого инстанса выбирайте уникальное имя. В тестах закрывайте приложение (`await app.close()`) между кейсами, которые регистрируют одно и то же имя — это запускает teardown модуля и освобождает имя для повторного использования.

## Что умеет SDK

Внедрённый экземпляр `HeleketClient` даёт доступ ко всем модулям SDK:

| Что нужно сделать                          | Метод                             |
| ------------------------------------------ | --------------------------------- |
| Создать криптосчёт (инвойс)                | `heleket.payment.create()`        |
| Статус инвойса по `uuid`/`orderId`         | `heleket.payment.info()`          |
| Сети/валюты/лимиты для платежей            | `heleket.payment.services()`      |
| Страница инвойсов (курсорная пагинация)    | `heleket.payment.list()`          |
| Обойти все инвойсы                         | `heleket.payment.historyAll()`    |
| Повторная отправка вебхука                 | `heleket.payment.resend()`        |
| Создать статический кошелёк для пополнений | `heleket.payment.wallet()`        |
| Балансы мерчанта и пользователя            | `heleket.payment.balance()`       |
| Создать выплату                            | `heleket.payout.create()`         |
| Статус выплаты                             | `heleket.payout.info()`           |
| Сети/валюты/лимиты для выплат              | `heleket.payout.services()`       |
| Страница выплат (курсорная пагинация)      | `heleket.payout.list()`           |
| Проверить подпись платёжного вебхука       | `heleket.paymentWebhook.verify()` |
| Проверить подпись выплатного вебхука       | `heleket.payoutWebhook.verify()`  |

Константы (`Currency`, `Network`, `PAYMENT_STATUS`, `PAYOUT_STATUS`...), zod-схемы и все типы запросов/ответов экспортируются из корня `@tsforge7/heleket-sdk` — без глубоких импортов. Полный справочник — в [документации SDK](https://github.com/tsforge/heleket-sdk).

## Примеры

### Сервис

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

### CQRS-хендлер

Пример для проектов с `@nestjs/cqrs`:

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
            this.logger.error(`[CreateInvoiceHandler] Ошибка Heleket: ${res.message}`);
            return { isSuccess: false, ...ERRORS.CREATE_INVOICE_FAILED };
        }

        return { isSuccess: true, data: res.data };
    }
}
```

### Вебхуки

При изменении статуса инвойса Heleket отправляет **POST** на `urlCallback`. В теле запроса есть поле `sign` (MD5 от payload), которое `paymentWebhook`/`payoutWebhook` проверяют за постоянное время.

Проверяйте **сырое** тело, а не распарсенное: `JSON.parse` + `JSON.stringify` может поменять порядок ключей и сломать подпись. Включите сохранение сырого тела в `main.ts`:

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
        // 1. Подпись валидна? Проверяем сырую строку, а не распарсенный объект.
        if (!req.rawBody || !this.heleket.paymentWebhook.verify(req.rawBody.toString('utf8'))) {
            return res.status(HttpStatus.UNAUTHORIZED).end();
        }

        // 2. Не верим вебхуку на слово — перепроверяем статус через API
        const invoice = await this.heleket.payment.info({ orderId: req.body.order_id });

        if (invoice.isSuccess && ['paid', 'paid_over'].includes(invoice.data?.status ?? '')) {
            // 3. Проверяем сумму/валюту против заказа и засчитываем его (идемпотентно —
            //    Heleket может повторить вебхук, заказ не должен быть засчитан дважды)
        }

        // 4. Отвечаем 200, иначе Heleket повторит запрос
        return res.status(HttpStatus.OK).end();
    }
}
```

## Обработка ошибок

SDK никогда не бросает исключения на ошибках API — каждый публичный метод возвращает `ICommandResponse<T>`:

```typescript
const res = await this.heleket.payment.create({/* ... */});

if (res.isSuccess) {
    console.log(res.data);
} else {
    // Ошибка валидации или ошибка API Heleket — стабильный код + сообщение
    console.log(res.code, res.message, res.errors);
}
```

Исключения выбрасываются только при неверной конфигурации — например, при обращении к `heleket.payout`, если передан только `paymentKey`.

## API модуля

| Экспорт                                  | Описание                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `HeleketNestjsModule.forRoot(options)`   | Синхронная конфигурация (`name?` для [нескольких инстансов](#несколько-инстансов))       |
| `HeleketNestjsModule.forRootAsync(opts)` | Асинхронная конфигурация (`useFactory` / `imports` / `inject` / `name?`)                 |
| `@InjectHeleket(name?)`                  | Декоратор для внедрения экземпляра `HeleketClient` (дефолтного или именованного)         |
| `IHeleketModuleOptions`                  | Тип опций модуля (`merchantUuid`, `paymentKey?`, `payoutKey?`, `baseUrl?`, `name?`, ...) |

Модуль помечен `@Global()` — импортируйте его один раз в корневом модуле, после этого `@InjectHeleket()` работает в любом месте приложения без повторных импортов.

## Требования

- Node.js 18+ (SDK использует встроенный `fetch`)
- NestJS 10+
- TypeScript 5.0+

## Как внести изменения

**Нашли баг?** Откройте [Issue](https://github.com/tsforge/heleket-sdk-nestjs/issues/new) — опишите, что вы делали, что ожидали и что получили (код ошибки, модуль, версии SDK и Node). Пожалуйста, никогда не указывайте в issue реальные API-ключи или данные транзакций.

**Хотите предложить изменение?** Прямые пуши в репозиторий запрещены — изменения принимаются через Merge Request из форка:

1. **Форкните** репозиторий — кнопка "Fork" на странице [tsforge/heleket-sdk-nestjs](https://github.com/tsforge/heleket-sdk-nestjs).
2. **Клонируйте свой форк** и создайте ветку:

    ```bash
    git clone git@github.com:<ваш-логин>/heleket-sdk-nestjs.git
    cd heleket-sdk-nestjs
    npm install
    git checkout -b fix/my-fix
    ```

3. **Внесите изменения** и убедитесь, что всё зелёное:

    ```bash
    npm run lint      # линтер
    npm run build     # сборка
    npm run format    # prettier
    ```

    Комментарии в коде оставляйте на английском.

4. **Запушьте ветку в свой форк** и откройте Merge Request в `main` основного репозитория. Опишите, что и почему изменили; если MR закрывает issue, укажите это (`Closes #N`).

## Лицензия

ISC © [tsforge](https://github.com/tsforge)
