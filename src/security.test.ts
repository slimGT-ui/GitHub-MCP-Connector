import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidBearerToken } from "./security.js";

describe("isValidBearerToken", () => {
  const token = "a-long-random-secret";

  it("accepts the exact bearer token", () => {
    assert.equal(isValidBearerToken(`Bearer ${token}`, token), true);
  });

  it("rejects a different token", () => {
    assert.equal(isValidBearerToken("Bearer wrong-token", token), false);
  });

  it("rejects a missing authorization header", () => {
    assert.equal(isValidBearerToken(undefined, token), false);
  });

  it("rejects a non-bearer authorization scheme", () => {
    assert.equal(isValidBearerToken(`Basic ${token}`, token), false);
  });

  it("rejects an empty configured token", () => {
    assert.equal(isValidBearerToken("Bearer ", ""), false);
  });
});
