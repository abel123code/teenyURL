import sql from "./db";
import { CODE_LENGTH, DEFAULT_TTL_DAYS } from "./config";
import { randomBase62 } from "./codegen";

export type LinkRow = {
  id: number;
  code: string;
  long_url: string;
  created_at: string;
  expires_at: string;
  clicks: number;
};

function computeExpiryISO(now = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + DEFAULT_TTL_DAYS);
  return d.toISOString();
}

// Detect Postgres unique-violation error (SQLSTATE 23505)
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as any).code === "23505";
}

export async function createShortLink(longUrl: string) {
  const createdAt = new Date().toISOString();
  const expiresAt = computeExpiryISO();

  const MAX_RETRIES = 8;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = randomBase62(CODE_LENGTH);

    try {
      const rows = await sql<LinkRow[]>`
        INSERT INTO links (code, long_url, created_at, expires_at)
        VALUES (${code}, ${longUrl}, ${createdAt}, ${expiresAt})
        RETURNING id, code, long_url, created_at, expires_at, clicks
      `;
      return rows[0];
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Collision: try a different code
        continue;
      }
      throw err;
    }
  }

  throw new Error("Failed to generate a unique short code after retries.");
}

export async function getLinkByCode(code: string): Promise<LinkRow | null> {
  const rows = await sql<LinkRow[]>`
    SELECT id, code, long_url, created_at, expires_at, clicks
    FROM links
    WHERE code = ${code}
    LIMIT 1
  `;
  return rows[0] ?? null;
}
