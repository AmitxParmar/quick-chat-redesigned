import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require authentication
const publicRoutes = ['/login', '/register'];

// Routes that require authentication
const protectedRoutes = ['/'];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const accessToken = request.cookies.get('access_token')?.value;
    console.log("accessToken", accessToken)
    // Check if this is a public route
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    // Check if this is a protected route
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route)) || pathname === '/';

    // If user is not authenticated and trying to access protected route
    if (!accessToken && isProtectedRoute) {
        const loginUrl = new URL('/login', request.url);
        // Add redirect parameter so user can be redirected back after login
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // If user is authenticated and trying to access public route (login/register)
    if (accessToken && isPublicRoute) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // Add cache control headers to prevent browser from caching protected pages
    const response = NextResponse.next();
    if (isProtectedRoute) {
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon)
         * - public folder files
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
