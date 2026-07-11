import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Route protette (genitore + transizione)
  const protectedRoutes = [
    "/dashboard",
    "/children",
    "/library",
    "/stories",
    "/child-select",
    "/profile",
  ];

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!user && isProtected) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Se è una route protetta, imponi no-store no-cache per impedire al pulsante "Indietro"
  // di mostrare pagine genitore memorizzate nella cache locale
  if (isProtected) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }

  // Se la sessione è in modalità bambino, reindirizza le pagine genitore verso /read
  const isChildMode = user?.app_metadata?.is_child_mode === true;
  const parentOnlyRoutes = [
    "/dashboard",
    "/children",
    "/library",
    "/stories",
    "/profile",
  ];
  const isParentOnly = parentOnlyRoutes.some((route) =>
    pathname.startsWith(route)
  );
  if (isChildMode && isParentOnly) {
    const readUrl = new URL("/read", request.url);
    return NextResponse.redirect(readUrl);
  }

  // Se utente già loggato va su /login o /register reindirizza a /dashboard
  if (user && (pathname === "/login" || pathname === "/register")) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/children/:path*",
    "/library/:path*",
    "/stories/:path*",
    "/child-select/:path*",
    "/profile/:path*",
    "/login",
    "/register",
  ],
};
