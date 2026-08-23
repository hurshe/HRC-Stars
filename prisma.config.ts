// Конфигурация Prisma 7.
// В седьмой версии строка подключения больше не живёт в schema.prisma,
// и .env автоматически не подхватывается — поэтому dotenv импортируется явно.
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
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
