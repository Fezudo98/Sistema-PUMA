let cachedJwtSecret: Uint8Array | null = null;

export function getJwtSecret(): Uint8Array {
  if (cachedJwtSecret) return cachedJwtSecret;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET não está definido. Configure essa variável de ambiente antes de iniciar o sistema."
    );
  }

  cachedJwtSecret = new TextEncoder().encode(secret);
  return cachedJwtSecret;
}
