import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The blueprint list lives on each detail page, so the bare path opens the first featured case.
  redirects: async () => [
    { source: '/blueprint-edits', destination: '/blueprint-edits/20', permanent: false },
  ],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
