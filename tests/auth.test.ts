import { describe, expect, it } from "vitest";
import {
  hashSecret,
  secureEqual,
  validCode,
  validSession,
} from "../app/features/auth/crypto.server";
describe("seguridad de códigos y sesiones", () => {
  const secret = "a-secret";
  it("hashea y compara de forma segura", () => {
    const a = hashSecret("token", secret);
    expect(a).toHaveLength(64);
    expect(secureEqual(a, hashSecret("token", secret))).toBe(true);
    expect(secureEqual(a, hashSecret("otro", secret))).toBe(false);
  });
  it("valida expiración, intentos y consumo", () => {
    const now = new Date(),
      record = {
        codeHash: "hash",
        expiresAt: new Date(+now + 1000),
        attempts: 0,
        maxAttempts: 5,
        consumedAt: null,
        purpose: "sign_in",
      };
    expect(validCode(record, "hash", now)).toBe(true);
    expect(validCode({ ...record, attempts: 5 }, "hash", now)).toBe(false);
    expect(
      validCode({ ...record, expiresAt: new Date(+now - 1) }, "hash", now),
    ).toBe(false);
  });
  it("rechaza sesiones vencidas", () => {
    const now = new Date();
    expect(
      validSession(
        { tokenHash: "a", expiresAt: new Date(+now + 1000) },
        "a",
        now,
      ),
    ).toBe(true);
    expect(
      validSession({ tokenHash: "a", expiresAt: new Date(+now - 1) }, "a", now),
    ).toBe(false);
  });
});
