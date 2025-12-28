import type { NextConfig } from "next";
import withFlowbiteReact from "flowbite-react/plugin/nextjs";

const nextConfig: NextConfig = {
  basePath: '/intervous',
  assetPrefix: '/intervous',
  trailingSlash: true
};

export default withFlowbiteReact(nextConfig);