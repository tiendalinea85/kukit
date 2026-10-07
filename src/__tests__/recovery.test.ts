import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAuthCallback, shouldForceReset } from "../lib/recoveryGuard.ts";

describe("parseAuthCallback", () => {
  it("reads a PKCE code from the query string", () => {
    const { code, hasRecoveryTokens, hasError } = parseAuthCallback(
      "https://app.example/auth/reset?code=abc123"
    );
    assert.equal(code, "abc123");
    assert.equal(hasRecoveryTokens, false);
    assert.equal(hasError, false);
  });

  it("reads a PKCE code from the hash", () => {
    const { code } = parseAuthCallback("https://app.example/auth/callback#code=xyz");
    assert.equal(code, "xyz");
  });

  it("detects implicit recovery tokens in the hash", () => {
    const { code, hasRecoveryTokens } = parseAuthCallback(
      "https://app.example/auth/reset#access_token=eyJhbGciOiJIUzI1NiJ9&refresh_token=rr&token_type=bearer&type=recovery"
    );
    assert.equal(code, null);
    assert.equal(hasRecoveryTokens, true);
  });

  it("does not treat a non-recovery hash as recovery", () => {
    const { hasRecoveryTokens } = parseAuthCallback(
      "https://app.example/auth/callback#access_token=abc&type=signup"
    );
    assert.equal(hasRecoveryTokens, false);
  });

  it("detects errors returned in query or hash", () => {
    assert.equal(
      parseAuthCallback("https://app.example/auth/reset?error=access_denied").hasError,
      true
    );
    assert.equal(
      parseAuthCallback("https://app.example/auth/reset#error=expired").hasError,
      true
    );
    assert.equal(parseAuthCallback("https://app.example/auth/reset").hasError, false);
  });

  it("returns empty params for a plain URL", () => {
    const { code, hasRecoveryTokens, hasError } = parseAuthCallback(
      "https://app.example/auth/reset"
    );
    assert.equal(code, null);
    assert.equal(hasRecoveryTokens, false);
    assert.equal(hasError, false);
  });
});

describe("shouldForceReset", () => {
  it("does not redirect when there is no pending recovery", () => {
    assert.equal(shouldForceReset("/", false), false);
    assert.equal(shouldForceReset("/dashboard", false), false);
    assert.equal(shouldForceReset("/auth/reset", false), false);
  });

  it("forces /auth/reset for any app route while pending", () => {
    assert.equal(shouldForceReset("/", true), true);
    assert.equal(shouldForceReset("/expenses", true), true);
    assert.equal(shouldForceReset("/settings/profile", true), true);
    assert.equal(shouldForceReset(null, true), true);
  });

  it("allows the reset and auth pages while pending", () => {
    assert.equal(shouldForceReset("/auth/reset", true), false);
    assert.equal(shouldForceReset("/auth", true), false);
    assert.equal(shouldForceReset("/auth/callback", true), false);
  });

  it("does not confuse /authreset with the /auth family", () => {
    // Prefijo vago: "/authreset" no empieza por "/auth/" ni es "/auth".
    assert.equal(shouldForceReset("/authreset", true), true);
  });
});
