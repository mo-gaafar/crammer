/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output bundles only the files needed to run in production,
  // which is required for the optimised Docker image.
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
