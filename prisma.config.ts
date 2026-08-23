// Конфигурация Prisma 7.
// В седьмой версии строка подключения больше не живёт в schema.prisma,
// и .env автоматически не подхватывается — поэтому dotenv импортируется явно.
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  // Папка, а не файл: моделей много, держать их в одном файле неудобно
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Используется только CLI: migrate, db push, studio, introspect.
  // Приложение подключается через драйвер-адаптер, см. src/lib/db.ts
  datasource: {
    url: env('DATABASE_URL'),
  },
})
