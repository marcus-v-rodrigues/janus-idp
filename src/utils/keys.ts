import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Gera par de chaves RSA para assinatura RS256
 */
export function generateRSAKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { privateKey, publicKey };
}

/**
 * Converte chave PEM para formato JWKS
 */
export function pemToJwks(pemKey: string, isPrivate: boolean = false) {
  const key = isPrivate ? createPrivateKey(pemKey) : createPublicKey(pemKey);
  const keyObject = key.export({ format: 'jwk' }) as any;

  return {
    ...keyObject,
    alg: 'RS256',
    use: 'sig',
    kid: keyObject.kid || generateKeyId(keyObject),
  };
}

/**
 * Gera um ID de chave a partir do JWK
 */
function generateKeyId(jwk: any): string {
  const { n, e } = jwk;
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(n + e).digest('hex').substring(0, 16);
}

/**
 * Carrega ou gera chaves no formato JWK para o oidc-provider
 *
 * - getPemKeys(): Retorna chave privada completa no formato JWK (incluindo parâmetros como 'd')
 *
 * O oidc-provider PRECISA da chave privada com todos os parâmetros para assinar tokens RS256.
 * Por isso, esta função converte a chave privada PEM para JWK completo.
 */
export function getPemKeys() {
  // Verifica se as chaves são fornecidas via variáveis de ambiente
  const privateKeyPem = process.env.RSA_PRIVATE_KEY;
  const publicKeyPem = process.env.RSA_PUBLIC_KEY;

  if (privateKeyPem && publicKeyPem) {
    // Converte chave privada para JWK completo
    return pemToJwks(privateKeyPem, true);
  }

  // Verifica se as chaves existem em arquivos
  const keysDir = path.join(process.cwd(), 'keys');
  const privateKeyPath = path.join(keysDir, 'private.pem');
  const publicKeyPath = path.join(keysDir, 'public.pem');

  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf-8');
    // Converte chave privada para JWK completo
    return pemToJwks(privateKeyPem, true);
  }

  // Gera novas chaves
  console.log('⚠️  Nenhuma chave RSA encontrada. Gerando novas chaves para desenvolvimento...');
  const { privateKey, publicKey } = generateRSAKeyPair();

  // Tenta salvar chaves
  try {
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }
    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(publicKeyPath, publicKey);
    console.log('✅ Chaves RSA geradas e salvas no diretório ./keys/');
  } catch (error) {
    console.log('⚠️  Não foi possível salvar as chaves em arquivo (sem permissão ou ambiente Docker)');
    console.log('   - As chaves serão geradas apenas na memória');
  }

  console.log('   ⚠️  Em produção, defina as variáveis de ambiente RSA_PRIVATE_KEY e RSA_PUBLIC_KEY');

  // Converte chave privada para JWK completo
  return pemToJwks(privateKey, true);
}
