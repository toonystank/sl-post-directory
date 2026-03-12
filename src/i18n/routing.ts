import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'si', 'ta'],
  defaultLocale: 'en',
  localePrefix: 'as-needed'
});
