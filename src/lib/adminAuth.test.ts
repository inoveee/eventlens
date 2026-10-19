// @TheTechMargin 2026
// Тесты авторизации: роли, изоляция проектов, истёкшая лицензия,
// rate limit входа, хеширование паролей и JWT-сессии.
//
// Покрывают чистые функции решения (evaluateLicense, resolveProjectScope,
// evaluateRateLimit) и крипто-хелперы — без БД и сети.

import { describe, it, expect, jest } from "@jest/globals";
import * as mockCrypto from "crypto";
import { evaluateLicense, resolveProjectScope } from "./adminAuth";
import { evaluateRateLimit, hashIp } from "./loginRateLimit";
import { hashPassword, verifyPassword } from "./password";
import { createSession, verifySession, SESSION_TTL_SECONDS } from "./session";

// jose@6 — ESM-only, а Jest здесь CJS (ts-jest). Заменяем jose лёгким
// HMAC-SHA256-эквивалентом на node:crypto: реальная криптография (подпись,
// проверка подписи, срок) остаётся настоящей, тестируется моя логика
// session.ts, а не сама библиотека jose. Импорт с префиксом mock — чтобы
// ссылка на него была разрешена в фабрике jest.mock (hoisting).
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
    setSubject(sub: string): this {
      this.payload.sub = sub;
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

const NOW = Date.parse("2026-06-15T12:00:00Z");
const iso = (offsetDays: number) =>
  new Date(NOW + offsetDays * 86400_000).toISOString();

describe("evaluateLicense (роль/лицензия/срок)", () => {
  it("нет строки лицензии → missing", () => {
    expect(evaluateLicense(null, NOW)).toBe("missing");
  });

  it("действующая лицензия → active", () => {
    expect(
      evaluateLicense(
        { project_key: "event-a", starts_at: iso(-1), expires_at: iso(1), is_revoked: false },
        NOW,
      ),
    ).toBe("active");
  });

  it("истёкшая лицензия → expired", () => {
    expect(
      evaluateLicense(
        { project_key: "event-a", starts_at: iso(-30), expires_at: iso(-1), is_revoked: false },
        NOW,
      ),
    ).toBe("expired");
  });

  it("срок ещё не начался → not_started", () => {
    expect(
      evaluateLicense(
        { project_key: "event-a", starts_at: iso(1), expires_at: iso(10), is_revoked: false },
        NOW,
      ),
    ).toBe("not_started");
  });

  it("отозванная лицензия → revoked, даже если срок валиден", () => {
    expect(
      evaluateLicense(
        { project_key: "event-a", starts_at: iso(-1), expires_at: iso(1), is_revoked: true },
        NOW,
      ),
    ).toBe("revoked");
  });

  it("граница: истекает ровно сейчас → expired (не active)", () => {
    expect(
      evaluateLicense(
        { project_key: "event-a", starts_at: iso(-1), expires_at: new Date(NOW).toISOString(), is_revoked: false },
        NOW,
      ),
    ).toBe("expired");
  });

  it("граница: начинается ровно сейчас → active", () => {
    expect(
      evaluateLicense(
        { project_key: "event-a", starts_at: new Date(NOW).toISOString(), expires_at: iso(1), is_revoked: false },
        NOW,
      ),
    ).toBe("active");
  });
});

describe("resolveProjectScope (изоляция проектов)", () => {
  it("super_admin получает запрошенный проект", () => {
    const d = resolveProjectScope("super_admin", null, "event-a");
    expect(d.allowed).toBe(true);
    expect(d.projectKey).toBe("event-a");
  });

  it("super_admin без запроса → projectKey null (все проекты)", () => {
    const d = resolveProjectScope("super_admin", null, null);
    expect(d.allowed).toBe(true);
    expect(d.projectKey).toBeNull();
  });

  it("admin получает проект из своей лицензии", () => {
    const d = resolveProjectScope("admin", "event-a", undefined);
    expect(d.allowed).toBe(true);
    expect(d.projectKey).toBe("event-a");
  });

  it("admin НЕ может запросить чужой проект", () => {
    const d = resolveProjectScope("admin", "event-a", "event-b");
    expect(d.allowed).toBe(false);
    expect(d.projectKey).toBeNull();
    expect(d.reason).toMatch(/нет доступа/i);
  });

  it("admin без лицензии → отказ", () => {
    const d = resolveProjectScope("admin", null, "event-a");
    expect(d.allowed).toBe(false);
  });

  it("admin со своим проектом → разрешено", () => {
    const d = resolveProjectScope("admin", "event-a", "event-a");
    expect(d.allowed).toBe(true);
    expect(d.projectKey).toBe("event-a");
  });
});

describe("evaluateRateLimit (защита входа)", () => {
  const limits = { maxPerLogin: 5, maxPerIp: 20, windowSeconds: 900 };
  const fail = (login: string, ipHash: string, agoSec: number) => ({
    login_key: login,
    ip_hash: ipHash,
    created_at: new Date(NOW - agoSec * 1000).toISOString(),
  });

  it("нет неудач → разрешено", () => {
    expect(evaluateRateLimit([], "u@x.com", "ip1", NOW, limits).allowed).toBe(true);
  });

  it("ниже лимита по логину → разрешено", () => {
    const rows = Array.from({ length: 4 }, () => fail("u@x.com", "ip1", 60));
    expect(evaluateRateLimit(rows, "u@x.com", "ip1", NOW, limits).allowed).toBe(true);
  });

  it("5 неудач по одному логину → блокировка", () => {
    const rows = Array.from({ length: 5 }, () => fail("u@x.com", "ip1", 60));
    const d = evaluateRateLimit(rows, "u@x.com", "ip1", NOW, limits);
    expect(d.allowed).toBe(false);
    expect(d.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("неудачи по ДРУГОМУ логину не блокируют текущий", () => {
    const rows = Array.from({ length: 5 }, () => fail("other@x.com", "ip1", 60));
    expect(evaluateRateLimit(rows, "u@x.com", "ip1", NOW, limits).allowed).toBe(true);
  });

  it("20 неудач с одного IP по разным логинам → блокировка по IP", () => {
    const rows = Array.from({ length: 20 }, (_, i) => fail(`u${i}@x.com`, "ip1", 60));
    const d = evaluateRateLimit(rows, "fresh@x.com", "ip1", NOW, limits);
    expect(d.allowed).toBe(false);
  });

  it("неудачи с другого IP не блокируют текущий", () => {
    const rows = Array.from({ length: 20 }, (_, i) => fail(`u${i}@x.com`, "other-ip", 60));
    expect(evaluateRateLimit(rows, "u@x.com", "ip1", NOW, limits).allowed).toBe(true);
  });

  it("retryAfter считается от самой старой неудачи в окне", () => {
    // старая неудача 100 сек назад; окно 900 → примерно 800 сек до снятия
    const rows = [fail("u@x.com", "ip1", 100), ...Array.from({ length: 4 }, () => fail("u@x.com", "ip1", 30))];
    const d = evaluateRateLimit(rows, "u@x.com", "ip1", NOW, limits);
    expect(d.allowed).toBe(false);
    expect(d.retryAfterSeconds).toBeLessThanOrEqual(800);
    expect(d.retryAfterSeconds).toBeGreaterThan(790);
  });
});

describe("hashIp (приватность IP)", () => {
  it("хеш стабилен для одного адреса", () => {
    expect(hashIp("1.2.3.4")).toBe(hashIp("1.2.3.4"));
  });

  it("хеш не содержит сырой адрес", () => {
    expect(hashIp("1.2.3.4")).not.toContain("1.2.3.4");
  });

  it("разные адреса → разные хеши", () => {
    expect(hashIp("1.2.3.4")).not.toBe(hashIp("5.6.7.8"));
  });
});

describe("password (argon2id)", () => {
  it("хеш не равен паролю и начинается с $argon2id$", async () => {
    const h = await hashPassword("correct horse battery staple");
    expect(h).not.toContain("correct horse");
    expect(h.startsWith("$argon2id$")).toBe(true);
  });

  it("verify подтверждает верный пароль", async () => {
    const h = await hashPassword("s3cret-password");
    expect(await verifyPassword(h, "s3cret-password")).toBe(true);
  });

  it("verify отвергает неверный пароль", async () => {
    const h = await hashPassword("s3cret-password");
    expect(await verifyPassword(h, "wrong-password")).toBe(false);
  });

  it("одинаковые пароли дают разные хеши (соль)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });

  it("повреждённый хеш → false, не ошибка", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
    expect(await verifyPassword("", "anything")).toBe(false);
  });

  it("пустой пароль → false", async () => {
    const h = await hashPassword("x");
    expect(await verifyPassword(h, "")).toBe(false);
  });
});

describe("session (JWT)", () => {
  it("подписанная сессия верифицируется", async () => {
    const token = await createSession({ sub: "u1", email: "a@b.com", role: "admin" });
    const s = await verifySession(token);
    expect(s).not.toBeNull();
    expect(s?.sub).toBe("u1");
    expect(s?.email).toBe("a@b.com");
    expect(s?.role).toBe("admin");
  });

  it("подделанный токен отклоняется", async () => {
    const token = await createSession({ sub: "u1", email: "a@b.com", role: "admin" });
    const tampered = token.slice(0, -4) + "AAAA";
    expect(await verifySession(tampered)).toBeNull();
  });

  it("чужой токен (не наша подпись) отклоняется", async () => {
    expect(await verifySession("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.signature")).toBeNull();
  });

  it("роль вне белого списка отклоняется", async () => {
    // Подписываем вручную с ролью, которой нет в enum.
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(
      process.env.SESSION_SECRET || process.env.ADMIN_API_SECRET || "eventlens-dev-session-secret",
    );
    const token = await new SignJWT({ email: "a@b.com", role: "hacker" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(secret);
    expect(await verifySession(token)).toBeNull();
  });

  it("сессия несёт разумный срок жизни", () => {
    expect(SESSION_TTL_SECONDS).toBeGreaterThan(0);
    expect(SESSION_TTL_SECONDS).toBeLessThanOrEqual(24 * 3600);
  });
});
