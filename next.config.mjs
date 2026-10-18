/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/intervous',
  async redirects() {
    // basePath is applied automatically: these match /intervous, /intervous/today, ...
    // Home replaced Today and Insights; the old addresses keep working.
    return [
      { source: '/', destination: '/home', permanent: false },
      { source: '/dashboard', destination: '/home', permanent: false },
      { source: '/today', destination: '/home', permanent: false },
      { source: '/insights', destination: '/home', permanent: false },
    ];
  },
};

export default nextConfig;
