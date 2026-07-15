const VERCEL_FORWARDED_FOR = "x-vercel-forwarded-for";
const STANDARD_FORWARDED_FOR = "x-forwarded-for";
const REAL_IP = "x-real-ip";
const FORWARDED = "forwarded";

export function getClientIp(request: Request) {
  return (
    firstIpFromHeader(request.headers.get(VERCEL_FORWARDED_FOR)) ||
    firstIpFromHeader(request.headers.get(STANDARD_FORWARDED_FOR)) ||
    normalizeIp(request.headers.get(REAL_IP)) ||
    firstIpFromForwardedHeader(request.headers.get(FORWARDED))
  );
}

export function firstIpFromHeader(value: string | null) {
  if (!value) return null;
  return normalizeIp(value.split(",")[0]);
}

export function firstIpFromForwardedHeader(value: string | null) {
  if (!value) return null;

  const firstForwardedEntry = value.split(",")[0];
  const forPair = firstForwardedEntry
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith("for="));

  if (!forPair) return null;

  return normalizeIp(forPair.slice(4));
}

export function normalizeIp(value: string | null) {
  if (!value) return null;

  let ip = value.trim();
  if (!ip || ip.toLowerCase() === "unknown") return null;

  if (ip.startsWith('"') && ip.endsWith('"')) {
    ip = ip.slice(1, -1).trim();
  }

  if (ip.startsWith("[")) {
    const closingBracketIndex = ip.indexOf("]");
    if (closingBracketIndex > 0) {
      ip = ip.slice(1, closingBracketIndex);
    }
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(":"));
  }

  return ip.toLowerCase() || null;
}
