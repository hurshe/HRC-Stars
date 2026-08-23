import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user']
    /// Вход был по PIN на общем планшете — такая сессия живёт меньше
    viaPin: boolean
    /// Момент входа, мс. Нужен для отдельного срока жизни PIN-сессии
    signedInAt: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    viaPin?: boolean
    signedInAt?: number
  }
}

export {}
