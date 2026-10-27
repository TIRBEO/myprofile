import { describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

import { SESSION_COOKIE_NAME } from "./config";
import { createIdentityResolver, verifySessionJwt } from "./session";

const SECRET = "unit-test-secret-not-a-real-one";

function sign(
  claims: Record<string, unknown>,
  secret = SECRET,
  expiresIn = "15m",
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

/* A session id is a row's primary key, not a secret, so a cookie that merely
   names one must never be enough to be read as someone's session. */
describe("verifySessionJwt", () => {
  it("accepts the account service's own token", async () => {
    process.env.JWT_SECRET = SECRET;
    const token = await sign({ sub: "user-1", sid: "session-1" });
    expect(await verifySessionJwt(token)).toEqual({ sub: "user-1", sid: "session-1" });
  });

  it("rejects a cookie signed with another secret, however well it parses", async () => {
    process.env.JWT_SECRET = SECRET;
    const forged = await sign({ sub: "user-1", sid: "session-1" }, "someone-elses-secret");
    expect(await verifySessionJwt(forged)).toBeNull();
  });

  it("rejects a cookie that has been edited after signing", async () => {
    process.env.JWT_SECRET = SECRET;
    const token = await sign({ sub: "user-1", sid: "session-1" });
    const [header, , signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ sub: "user-2", sid: "session-1" }),
    ).toString("base64url");
    expect(await verifySessionJwt(`${header}.${tamperedPayload}.${signature}`)).toBeNull();
  });

  it("rejects a token that names no session — the 2FA step token, for one", async () => {
    process.env.JWT_SECRET = SECRET;
    expect(await verifySessionJwt(await sign({ sub: "user-1" }))).toBeNull();
  });

  it("rejects a token whose moment has passed", async () => {
    process.env.JWT_SECRET = SECRET;
    const stale = await sign({ sub: "user-1", sid: "session-1" }, SECRET, "-1s");
    expect(await verifySessionJwt(stale)).toBeNull();
  });

  it("answers nothing when it has no secret to check with", async () => {
    const had = process.env.JWT_SECRET;
    process.env.JWT_SECRET = SECRET;
    const token = await sign({ sub: "user-1", sid: "session-1" });
    delete process.env.JWT_SECRET;
    expect(await verifySessionJwt(token)).toBeNull();
    if (had !== undefined) process.env.JWT_SECRET = had;
  });
});

/* A bearer token here is the session JWT, so it carries a `sid` somebody can
   sign out. Checking only the signature would keep honouring it after that. */
describe("createIdentityResolver", () => {
  function headers(init: Record<string, string>) {
    return new Headers(init);
  }

  it("refuses a bearer whose session no longer exists", async () => {
    process.env.JWT_SECRET = SECRET;
    const revoked = await sign({ sub: "user-1", sid: "sid-revoked" });
    const resolve = createIdentityResolver(vi.fn(async () => null));
    expect(await resolve(headers({ authorization: `Bearer ${revoked}` }))).toBeNull();
  });

  it("names the subject a live bearer resolves to", async () => {
    process.env.JWT_SECRET = SECRET;
    const token = await sign({ sub: "user-2", sid: "sid-live" });
    const resolve = createIdentityResolver(vi.fn(async () => "user-2"));
    expect(await resolve(headers({ authorization: `Bearer ${token}` }))).toEqual({
      userId: "user-2",
      via: "jwt",
    });
  });

  it("does not spend a lookup on a token that fails the signature", async () => {
    process.env.JWT_SECRET = SECRET;
    const lookup = vi.fn(async () => "someone");
    const resolve = createIdentityResolver(lookup);
    const forged = await sign({ sub: "user-3", sid: "sid-forged" }, "not-the-secret");
    expect(await resolve(headers({ authorization: `Bearer ${forged}` }))).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("resolves the same credential through the cookie header", async () => {
    process.env.JWT_SECRET = SECRET;
    const token = await sign({ sub: "user-4", sid: "sid-cookie" });
    const resolve = createIdentityResolver(vi.fn(async () => "user-4"));
    expect(
      await resolve(headers({ cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` })),
    ).toEqual({ userId: "user-4", via: "cookie" });
  });

  it("ignores a header the browser claims about who it is", async () => {
    process.env.JWT_SECRET = SECRET;
    const resolve = createIdentityResolver(vi.fn(async () => null));
    expect(await resolve(headers({ "x-user-id": "user-5" }))).toBeNull();
  });
});
