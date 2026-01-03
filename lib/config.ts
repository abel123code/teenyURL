export const CODE_LENGTH = Number(process.env.CODE_LENGTH ?? "7");
export const DEFAULT_TTL_DAYS = Number(process.env.DEFAULT_TTL_DAYS ?? "30");
export const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

export function assertConfig() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL in environment.");
  }
  if (!Number.isFinite(CODE_LENGTH) || CODE_LENGTH < 4 || CODE_LENGTH > 12) {
    throw new Error("CODE_LENGTH must be between 4 and 12.");
  }
  if (!Number.isFinite(DEFAULT_TTL_DAYS) || DEFAULT_TTL_DAYS < 1 || DEFAULT_TTL_DAYS > 3650) {
    throw new Error("DEFAULT_TTL_DAYS must be between 1 and 3650.");
  }
}
