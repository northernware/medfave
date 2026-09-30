import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

/**
 * This machine's own addresses on the network.
 *
 * In development Next serves dev-only assets — the client chunks among them —
 * only to the origin the server was started on, and answers 403 to anything
 * else. Opening the app on this machine's LAN address, which is how it gets
 * looked at from a phone or from another desk, therefore returned the page's
 * HTML but refused every script: the markup rendered, nothing hydrated, and
 * every control on it was inert. A date picker that never runs its change
 * handler looks exactly like a broken slot list.
 *
 * Reading the addresses rather than listing them keeps this correct when the
 * machine moves between networks. The option applies to development only.
 */
function localNetworkOrigins() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((iface) => iface?.family === "IPv4" && !iface.internal)
    .map((iface) => iface!.address);
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: localNetworkOrigins(),

  /*
   * The mobile API answers any origin. It is authenticated by a bearer token the
   * app sends, never by cookies, so a page on another site gains nothing it
   * could not already do with a token it holds — and without this the app's
   * web build (Expo web, on its own port) could not call it at all. The native
   * apps ignore CORS either way. Applies to /api/v1 only; the web pages and
   * their cookie sessions are untouched.
   */
  async headers() {
    return [
      {
        source: "/api/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
