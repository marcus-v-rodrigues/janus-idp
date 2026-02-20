#!/usr/bin/env ts-node
/**
 * Script para gerar par de chaves RSA para assinatura RS256
 * Uso: npm run generate-keys
 */

import { generateRSAKeyPair } from '../src/utils/keys';
import * as fs from 'fs';
import * as path from 'path';

console.log('🔐 Gerando par de chaves RSA para assinatura RS256...\n');

const { privateKey, publicKey } = generateRSAKeyPair();

// Cria diretório de chaves
const keysDir = path.join(process.cwd(), 'keys');
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

// Salva chaves
const privateKeyPath = path.join(keysDir, 'private.pem');
const publicKeyPath = path.join(keysDir, 'public.pem');

fs.writeFileSync(privateKeyPath, privateKey);
fs.writeFileSync(publicKeyPath, publicKey);

console.log('✅ Chaves RSA geradas com sucesso!');
console.log(`\n📁 Chaves salvas em:`);
console.log(`   - Chave privada: ${privateKeyPath}`);
console.log(`   - Chave pública:  ${publicKeyPath}`);
console.log(`\n⚠️  IMPORTANTE:`);
console.log(`   - Nunca faça commit dessas chaves no controle de versão`);
console.log(`   - Em produção, defina as variáveis de ambiente RSA_PRIVATE_KEY e RSA_PUBLIC_KEY`);
console.log(`   - Mantenha a chave privada segura e confidencial\n`);

// Exibe chave pública para referência
console.log('📋 Chave Pública (para referência):');
console.log(publicKey);

// Exibe versões em Base64 para copiar para .env
const privateKeyBase64 = Buffer.from(privateKey).toString('base64');
const publicKeyBase64 = Buffer.from(publicKey).toString('base64');

console.log('\n📋 Chaves codificadas em Base64 (para .env):');
console.log('\n# RSA_PRIVATE_KEY (copie para .env):');
console.log(`RSA_PRIVATE_KEY="${privateKeyBase64}"`);
console.log('\n# RSA_PUBLIC_KEY (copie para .env):');
console.log(`RSA_PUBLIC_KEY="${publicKeyBase64}"`);
