import { BlockList, isIP } from "node:net";

/**
 * Destinations the importer must never reach (OWASP SSRF): private, loopback,
 * link-local (incl. the 169.254.169.254 metadata endpoint), unique-local,
 * CGNAT, multicast, reserved and unspecified ranges, plus NAT64 forms that
 * could tunnel to them. IPv4-mapped IPv6 is checked as IPv4; never add
 * `::ffff:0:0/96` here, since BlockList treats it as matching every IPv4 address.
 */
const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

const IPV4_MAPPED_PATTERN = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

export function isBlockedAddress(address: string): boolean {
  const mapped = address.match(IPV4_MAPPED_PATTERN)?.[1];
  if (mapped) {
    return isBlockedAddress(mapped);
  }
  const family = isIP(address);
  if (family === 4) {
    return blocked.check(address, "ipv4");
  }
  if (family === 6) {
    return blocked.check(address, "ipv6");
  }
  // Not an IP at all: refuse rather than guess.
  return true;
}
