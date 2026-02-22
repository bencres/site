import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
};

module.exports = {
  async redirects() {
    return [
      {
        source: '/demo/django-angular',
        destination: 'https://github.com/bencres/demo-django-angular',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
