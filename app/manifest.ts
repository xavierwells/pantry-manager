import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Pantry Manager',
    short_name: 'Pantry Manager',
    description: 'A grocery list and recipe tracker.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f4ec',
    theme_color: '#183126',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
