import crypto from "crypto";

const SECRET = process.env.JWT_SECRET || "qt-pdf-editor-secret-key-12345-super-secret-key-for-pdf-editor";

/**
 * Signs a payload and returns a signed HS256 JWT string.
 * @param payload Data to encode in the token.
 * @param expiresInSeconds Expiration time (default 24 hours).
 */
export function sign(payload: any, expiresInSeconds: number = 86400): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
    
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verifies a JWT token signature and returns the decoded payload if valid and not expired.
 * @param token The JWT string to verify.
 */
export function verify(token: string): any {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  
  const [encodedHeader, encodedPayload, signature] = parts;
  
  try {
    const expectedSignature = crypto
      .createHmac("sha256", SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64url");
      
    if (signature !== expectedSignature) {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString());
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp && now > payload.exp) {
      return null; // Token has expired
    }
    
    return payload;
  } catch (err) {
    return null;
  }
}
