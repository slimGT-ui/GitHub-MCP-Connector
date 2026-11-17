import { timingSafeEqual } from "node:crypto";

export function isValidBearerToken(header: string | undefined, expectedToken: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length &&
    supplied.length > 0 &&
    timingSafeEqual(supplied, expected);
}
