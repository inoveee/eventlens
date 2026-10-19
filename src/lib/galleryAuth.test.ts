// @TheTechMargin 2026
// Тесты guest-доступа к пароль-защищённым галереям:
// подписанный токен со списком разблокированных проектов.
// jose@6 — ESM-only, Jest здесь CJS: подменяем jose HMAC-SHA256 на
// node:crypto (реальная подпись/проверка/срок), тестируется моя логика.

import { describe, it, expect, jest } from "@jest/globals";
import * as mockCrypto from "crypto";
import {
  signGalleryAccess,
  verifyGalleryAccess,
  isProjectUnlocked,
  GALLERY_ACCESS_TTL_SECONDS,
} from "./galleryAuth";

jest.mock("jose", () => {
  const crypto = mockCrypto;
  const b64url = (input: object | string): string =>
    Buffer.from(typeof input === "string" ? input : JSON.stringify(input)).toString(
      "base64url",
    );
  const fromB64url = (s: string): Record<string, unknown> =>
    JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
  const hmac = (data: string, secret: Uint8Array): string =>
    crypto.createHmac("sha256", Buffer.from(secret)).update(data).digest("base64url");

  class SignJWT {
    private payload: Record<string, unknown>;
    constructor(payload?: Record<string, unknown>) {
      this.payload = { ...(payload ?? {}) };
    }
    setProtectedHeader(): this {
      return this;
    }
    setIssuedAt(iat?: number): this {
      this.payload.iat = iat ?? Math.floor(Date.now() / 1000);
      return this;
    }
    setExpirationTime(exp: number | string): this {
      this.payload.exp =
        typeof exp === "number" ? exp : Math.floor(Date.now() / 1000) + 3600;
      return this;
    }
    async sign(secret: Uint8Array): Promise<string> {
      const h = b64url({ alg: "HS256" });
      const p = b64url(this.payload);
      return `${h}.${p}.${hmac(`${h}.${p}`, secret)}`;
    }
  }

  async function jwtVerify(
    token: string,
    secret: Uint8Array,
  ): Promise<{ payload: Record<string, unknown> }> {
    const [h, p, sig] = String(token).split(".");
    if (!h || !p || !sig) throw new Error("malformed token");
    const expected = hmac(`${h}.${p}`, secret);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error("bad signature");
    }
    const payload = fromB64url(p);
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("token expired");
    }
    return { payload };
  }

  return { SignJWT, jwtVerify };
});

describe("galleryAuth (guest-токен галереи)", () => {
  it("подписанный токен верифицирует список проектов", async () => {
    const token = await signGalleryAccess(["wedding", "devfest"]);
    const access = await verifyGalleryAccess(token);
    expect(access).not.toBeNull();
    expect(access?.projects).toEqual(expect.arrayContaining(["wedding", "devfest"]));
  });

  it("дедуплицирует проекты", async () => {
    const token = await signGalleryAccess(["a", "a", "b"]);
    const access = await verifyGalleryAccess(token);
    expect(access?.projects).toEqual(expect.arrayContaining(["a", "b"]));
    expect(access?.projects.filter((p) => p === "a")).toHaveLength(1);
  });

  it("пустой список → пустые проекты", async () => {
    const token = await signGalleryAccess([]);
    const access = await verifyGalleryAccess(token);
    expect(access?.projects).toEqual([]);
  });

  it("подделанный токен отклоняется", async () => {
    const token = await signGalleryAccess(["wedding"]);
    const tampered = token.slice(0, -4) + "AAAA";
    expect(await verifyGalleryAccess(tampered)).toBeNull();
  });

  it("чужая подпись отклоняется", async () => {
    expect(
      await verifyGalleryAccess("eyJhbGciOiJIUzI1NiJ9.eyJwIjpbIngiXX0.signature"),
    ).toBeNull();
  });

  it("пустой токен → null", async () => {
    expect(await verifyGalleryAccess("")).toBeNull();
  });

  it("isProjectUnlocked проверяет конкретный проект", async () => {
    const token = await signGalleryAccess(["wedding"]);
    const access = await verifyGalleryAccess(token);
    expect(isProjectUnlocked(access, "wedding")).toBe(true);
    expect(isProjectUnlocked(access, "devfest")).toBe(false);
  });

  it("isProjectUnlocked(null) → false", () => {
    expect(isProjectUnlocked(null, "wedding")).toBe(false);
  });

  it("срок жизни guest-доступа — 30 дней", () => {
    expect(GALLERY_ACCESS_TTL_SECONDS).toBe(60 * 60 * 24 * 30);
  });
});
