/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/intervous',
  async redirects() {
    // basePath is applied automatically: these match /intervous and /intervous/dashboard.
    return [
      { source: '/', destination: '/today', permanent: false },
      { source: '/dashboard', destination: '/today', permanent: false },
    ];
  },
};

export default nextConfig;
