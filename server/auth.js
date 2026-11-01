import { createRemoteJWKSet, jwtVerify } from 'jose';

export function createJwtVerifier(config) {
  if (!config.authIssuer || !config.authAudience) return null;
  const jwksUrl = config.authJwksUrl
    ?? `${config.authIssuer.replace(/\/$/, '')}/.well-known/jwks.json`;
  const jwks = createRemoteJWKSet(new URL(jwksUrl));

  return async (token) => {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.authIssuer,
      audience: config.authAudience,
      algorithms: ['RS256', 'ES256'],
    });
    if (!payload.sub) throw new Error('JWT subject is required');
    return payload;
  };
}
