import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match only internationalized pathnames, skip api/static/images
  matcher: ['/', '/(si|ta|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)']
};
