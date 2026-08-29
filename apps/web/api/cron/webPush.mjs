import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from 'node:crypto';

const encoder = new TextEncoder();
const base64Url = (value) => Buffer.from(value).toString('base64url');
const decodeBase64Url = (value) => Buffer.from(value, 'base64url');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();

function expand(prk, info, length) {
  let output = Buffer.alloc(0); let previous = Buffer.alloc(0);
  for (let index = 1; output.length < length; index += 1) { previous = hmac(prk, Buffer.concat([previous, info, Buffer.from([index])])); output = Buffer.concat([output, previous]); }
  return output.subarray(0, length);
}

function vapidToken(endpoint, subject, publicKey, privateKey) {
  const publicBytes = decodeBase64Url(publicKey); const privateBytes = decodeBase64Url(privateKey);
  if (publicBytes.length !== 65 || privateBytes.length !== 32) throw new Error('VAPID keys must be URL-safe base64 P-256 keys.');
  const header = base64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = base64Url(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject }));
  const key = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: base64Url(privateBytes), x: base64Url(publicBytes.subarray(1, 33)), y: base64Url(publicBytes.subarray(33, 65)) }, format: 'jwk' });
  return `${header}.${payload}.${base64Url(sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' }))}`;
}

function encryptedBody(subscription, payload) {
  const clientPublicKey = decodeBase64Url(subscription.keys.p256dh); const authSecret = decodeBase64Url(subscription.keys.auth);
  if (clientPublicKey.length !== 65 || !authSecret.length) throw new Error('Browser subscription contains invalid encryption keys.');
  const server = createECDH('prime256v1'); server.generateKeys();
  const serverPublicKey = server.getPublicKey(); const sharedSecret = server.computeSecret(clientPublicKey);
  const inputKeyingMaterial = expand(hmac(authSecret, sharedSecret), Buffer.concat([encoder.encode('WebPush: info\0'), clientPublicKey, serverPublicKey]), 32);
  const salt = randomBytes(16); const prk = hmac(salt, inputKeyingMaterial);
  const contentEncryptionKey = expand(prk, encoder.encode('Content-Encoding: aes128gcm\0'), 16); const nonce = expand(prk, encoder.encode('Content-Encoding: nonce\0'), 12);
  const cipher = createCipheriv('aes-128-gcm', contentEncryptionKey, nonce);
  const encrypted = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4); recordSize.writeUInt32BE(4096);
  return Buffer.concat([salt, recordSize, Buffer.from([serverPublicKey.length]), serverPublicKey, encrypted]);
}

/** Standards-based Web Push sender with no runtime dependency beyond Node 20. */
export async function sendWebPush(subscription, payload, vapid) {
  const authorization = vapidToken(subscription.endpoint, vapid.subject, vapid.publicKey, vapid.privateKey);
  const response = await fetch(subscription.endpoint, { method: 'POST', headers: { Authorization: `vapid t=${authorization}, k=${vapid.publicKey}`, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal' }, body: encryptedBody(subscription, payload) });
  if (!response.ok) { const error = new Error(`Web Push service rejected the notification (${response.status}).`); error.statusCode = response.status; throw error; }
}
