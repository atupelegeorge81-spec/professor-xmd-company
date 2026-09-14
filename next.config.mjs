/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ambia Next.js usi-bundle hizi, zishikiliwe na Node.js moja kwa moja
  serverExternalPackages: ["@xenova/transformers", "onnxruntime-web", "sharp"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'sharp': false, // Zuia kabisa webpack kujaribu kuitafuta
        'onnxruntime-node': 'onnxruntime-web',
      };
    }
    return config;
  },
};

export default nextConfig;
