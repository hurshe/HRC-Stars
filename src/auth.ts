import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { verifyPassword, verifyPin } from '@/server/services/authentication'
import { signInSchema, pinSignInSchema } from '@/lib/validation'

/// Обычная сессия — неделя: сотрудник не должен логиниться каждую смену.
const SESSION_MAX_AGE = 7 * 24 * 60 * 60

/// Сессия PIN-входа живёт 8 часов — это общий планшет в зале, а не личное устройство.
/// Проверка срока делается в getCurrentUser(), через который проходит весь код.
export const PIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE },
  pages: { signIn: '/login', error: '/login' },
  trustHost: true,

  providers: [
    Credentials({
      id: 'password',
      name: 'password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      // Точную причину отказа показывает Server Action: он вызывает verifyPassword
      // напрямую и получает код ошибки. Здесь достаточно да/нет — Auth.js всё равно
      // маскирует детали ошибок провайдера.
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials)
        if (!parsed.success) return null

        const result = await verifyPassword(parsed.data.email, parsed.data.password)
        return result.ok ? { id: result.userId } : null
      },
    }),

    Credentials({
      id: 'pin',
      name: 'pin',
      credentials: { pin: { label: 'PIN', type: 'password' } },
      async authorize(credentials) {
        const parsed = pinSignInSchema.safeParse(credentials)
        if (!parsed.success) return null

        const result = await verifyPin(parsed.data.pin)
        return result.ok ? { id: result.userId } : null
      },
    }),
  ],

  callbacks: {
    jwt({ token, user, account }) {
      if (user?.id) {
        token.sub = user.id
        token.viaPin = account?.provider === 'pin'
        token.signedInAt = Date.now()
      }
      return token
    },

    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      session.viaPin = token.viaPin === true
      session.signedInAt = typeof token.signedInAt === 'number' ? token.signedInAt : 0
      return session
    },
  },
})
