import type { MetadataRoute } from 'next';
import { homeDescription } from '@/lib/seo';
/* Served at /manifest.webmanifest. Makes the site installable from the browser menu
   ("მთავარ ეკრანზე დამატება") and opens it without browser chrome afterwards. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'JOBX — ვაკანსიები',
    short_name: 'JOBX',
    description: homeDescription,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    lang: 'ka',
    dir: 'ltr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
