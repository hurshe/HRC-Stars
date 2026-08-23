import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// В Prisma 7 клиент подключается к базе через драйвер-адаптер,
// а не через строку в schema.prisma.
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL не задан. Скопируйте .env.example в .env')
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

// В dev-режиме Next перезагружает модули при каждом изменении файла.
// Без кэша в globalThis это плодило бы новый пул соединений на каждую перезагрузку,
// пока Postgres не откажет по лимиту подключений.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
