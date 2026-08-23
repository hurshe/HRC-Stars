import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/auth'

// В Next 16 middleware переименован в proxy и работает только на nodejs-рантайме.
// Здесь только грубая отсечка неавторизованных: настоящая проверка прав
// живёт в сервисном слое, потому что proxy не знает, какое право нужно странице.

const PUBLIC_PATHS = ['/login', '/pin', '/activate', '/api/auth']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const session = await auth()
  if (session?.user?.id) return NextResponse.next()

  // Запомним, куда человек шёл, чтобы после входа вернуть его туда же
  const loginUrl = new URL('/login', request.url)
  if (pathname !== '/') loginUrl.searchParams.set('from', `${pathname}${search}`)

  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    // Всё, кроме статики, картинок и favicon
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
