import { describe, expect, it } from "vitest";
import { isValidBearerToken } from "./security.js";

describe("isValidBearerToken", () => {
  const token = "a-long-random-secret";

  it("accepts the exact bearer token", () => {
    expect(isValidBearerToken(`Bearer ${token}`, token)).toBe(true);
  });

  it("rejects a different token", () => {
    expect(isValidBearerToken("Bearer wrong-token", token)).toBe(false);
  });

  it("rejects a missing authorization header", () => {
    expect(isValidBearerToken(undefined, token)).toBe(false);
  });

  it("rejects a non-bearer authorization scheme", () => {
    expect(isValidBearerToken(`Basic ${token}`, token)).toBe(false);
  });

  it("rejects an empty configured token", () => {
    expect(isValidBearerToken("Bearer ", "")).toBe(false);
  });
});
