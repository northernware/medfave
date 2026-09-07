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
};

export default nextConfig;
