/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // yt-dlp/ffmpeg run as child processes from the custom server, not bundled.
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
