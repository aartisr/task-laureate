import { createECDH } from 'node:crypto';

const pair = createECDH('prime256v1');
pair.generateKeys();
process.stdout.write(`${JSON.stringify({ publicKey: pair.getPublicKey().toString('base64url'), privateKey: pair.getPrivateKey().toString('base64url') }, null, 2)}\n`);
