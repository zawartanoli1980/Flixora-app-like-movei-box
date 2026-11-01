import { promisify } from 'node:util';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';

const scrypt = promisify(scryptCallback);
const keyLength = 64;
const parameters = { N: 16_384, r: 8, p: 1 };

export async function hashPin(pin) {
  const salt = randomBytes(16);
  const derived = await scrypt(pin, salt, keyLength, parameters);
  return `scrypt$${parameters.N}$${parameters.r}$${parameters.p}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPin(pin, encoded) {
  const [algorithm, n, r, p, saltValue, hashValue] = String(encoded).split('$');
  const parsed = { N: Number(n), r: Number(r), p: Number(p) };
  if (algorithm !== 'scrypt' || parsed.N !== parameters.N
    || parsed.r !== parameters.r || parsed.p !== parameters.p
    || !saltValue || !hashValue) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(saltValue, 'base64url');
    expected = Buffer.from(hashValue, 'base64url');
  } catch {
    return false;
  }
  if (salt.length !== 16 || expected.length !== keyLength) return false;
  const actual = await scrypt(pin, salt, keyLength, parsed);
  return timingSafeEqual(actual, expected);
}

export function createProfilePinService(config) {
  if (!config.profileUnlockSecret) return null;
  const secret = new TextEncoder().encode(config.profileUnlockSecret);
  return {
    hashPin,
    verifyPin,
    async issueUnlock({ profileId, authSubject }) {
      const expiresInSeconds = 900;
      const token = await new SignJWT({ profileId, owner: authSubject, purpose: 'profile-unlock' })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer('flixora-api')
        .setAudience('flixora-profile-unlock')
        .setSubject(profileId)
        .setIssuedAt()
        .setExpirationTime(`${expiresInSeconds}s`)
        .sign(secret);
      return { token, expiresInSeconds };
    },
    async verifyUnlock(token, { profileId, authSubject }) {
      const { payload } = await jwtVerify(token, secret, {
        issuer: 'flixora-api',
        audience: 'flixora-profile-unlock',
        algorithms: ['HS256'],
        subject: profileId,
      });
      return payload.purpose === 'profile-unlock'
        && payload.profileId === profileId
        && payload.owner === authSubject;
    },
  };
}
