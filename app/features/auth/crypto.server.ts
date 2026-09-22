import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
export const createCode = () =>
  String(randomInt(0, 1_000_000)).padStart(6, "0");
export const createToken = () => randomBytes(32).toString("hex");
export const hashSecret = (value: string, secret: string) =>
  createHmac("sha256", secret).update(value).digest("hex");
export function secureEqual(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export function validCode(
  record: {
    codeHash: string;
    expiresAt: Date;
    attempts: number;
    maxAttempts: number;
    consumedAt?: Date | null;
    purpose: string;
  },
  hash: string,
  now = new Date(),
) {
  return (
    !record.consumedAt &&
    record.purpose === "sign_in" &&
    record.expiresAt > now &&
    record.attempts < record.maxAttempts &&
    secureEqual(record.codeHash, hash)
  );
}
export function validSession(
  record: { tokenHash: string; expiresAt: Date },
  hash: string,
  now = new Date(),
) {
  return record.expiresAt > now && secureEqual(record.tokenHash, hash);
}
