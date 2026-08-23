# HRC STARS

Внутренняя система Hard Rock Cafe: документы, обучение и тестирование персонала, операционные чек-листы, признание сотрудников.

План проекта и все принятые решения — в [PLAN.md](PLAN.md).
Разбор таблицы Excel, которую система заменяет, — в [docs/legacy-excel-model.md](docs/legacy-excel-model.md).

## Стек

Next.js 16 (App Router) · React 19 · TypeScript · PostgreSQL 16 · Prisma 7 · Auth.js v5 · Tailwind 4 · next-intl (pl / en)

## Что нужно на машине

- **Node.js 22+** — Prisma 7 требует 20.19+ / 22.12+ / 24+
- **Docker** — база, файловое хранилище и перехватчик почты поднимаются в контейнерах

## Запуск с нуля

```bash
cp .env.example .env
```

Затем сгенерируйте два секрета и впишите их в `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

- `AUTH_SECRET` — подпись сессий
- `PII_ENCRYPTION_KEY` — шифрование персональных данных. **Потеря ключа = потеря доступа к зашифрованным полям**, хранить отдельно от базы

Дальше:

```bash
npm install
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Приложение — http://localhost:3000
Почта (перехватываются письма-приглашения) — http://localhost:8025
Консоль MinIO — http://localhost:9101

Первый вход: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` из `.env`. Пароль потребуется сменить при первом входе.

## Порты

Нестандартные — на машине разработки стандартные уже заняты другими проектами. Все вынесены в `.env`.

| Сервис | Порт | Почему не по умолчанию |
|---|---|---|
| PostgreSQL | **5442** | 5432 занят нативным PostgreSQL 18 |
| MinIO API | **9100** | 9000 занят другим проектом |
| MinIO консоль | **9101** | 9001 занят другим проектом |
| Mailpit SMTP | 1025 | — |
| Mailpit UI | 8025 | — |

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | Дев-сервер |
| `npm run build` | Продакшен-сборка |
| `npm run typecheck` | Проверка типов без сборки |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Создать и применить миграцию |
| `npm run db:deploy` | Применить миграции (продакшен) |
| `npm run db:seed` | Справочники: роли, права, департаменты, позиции, настройки |
| `npm run db:studio` | Просмотр базы в браузере |
| `npm run db:reset` | Снести базу и накатить заново |

## Структура

```
prisma/
  schema.prisma      модели базы
  seed.ts            справочники и первый администратор
  migrations/
prisma.config.ts     конфиг Prisma 7 (строка подключения живёт здесь, а не в схеме)
src/
  app/               маршруты App Router
  lib/db.ts          клиент Prisma через драйвер-адаптер
docker-compose.yml   postgres + minio + mailpit
```

## Особенности версий

Проект собран на свежих мажорных версиях, у которых поведение отличается от предыдущих:

- **Next 16**: `middleware.ts` переименован в `proxy.ts` и работает только на nodejs-рантайме; `cookies()`, `headers()`, `params`, `searchParams` — только асинхронные; Turbopack по умолчанию; команда `next lint` удалена; типы маршрутов генерируются через `npx next typegen`
- **Prisma 7**: `url` в `datasource` больше не поддерживается — строка подключения в `prisma.config.ts`, а клиент подключается через драйвер-адаптер `@prisma/adapter-pg`; `.env` автоматически не загружается, нужен явный `dotenv`
