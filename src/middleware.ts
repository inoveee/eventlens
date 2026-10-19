// @TheTechMargin 2026
// Маршрутизация + ранняя проверка сессии админки.
//
// Middleware работает на Edge и НЕ ходит в БД. Здесь — только быстрая
// проверка подписи/срока JWT- cookie: неаутентифицированный посетитель
// /admin/* сразу уводится на /admin/login (UX), а API-роуты отдают 401.
// Авторитетная кросс-проверка роли/лицензии с БД — в adminAuth.ts,
// которую вызывает КАЖДЫЙ роут: middleware не заменяет её, а дополняет.

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const ADMIN_LOGIN_PATH = "/admin/login";
const ADMIN_API_LOGIN_PATH = "/api/admin/auth/login";

export async function middleware(request: NextRequest) {
  // Базовый security-header, как раньше.
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", "frame-ancestors 'self'");

  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (!isAdminPage && !isAdminApi) return response;

  // Страница входа и сам роут входа доступны без сессии.
  if (pathname === ADMIN_LOGIN_PATH || pathname === ADMIN_API_LOGIN_PATH) {
    return response;
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (isAdminApi) {
    // API не редиректим — просто отсекаем заведомо битый/просроченный токен
    // раньше дорогих обработок. Наличие живой сессии (и её права) роут
    // проверяет сам через requireRole/requireProjectAccess.
    if (!session) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    return response;
  }

  // Страницы /admin/*: без сессии — на страницу входа.
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = ADMIN_LOGIN_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
