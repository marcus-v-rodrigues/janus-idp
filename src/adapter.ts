import 'dotenv/config';
import { Adapter, AdapterPayload } from 'oidc-provider';
import { db, schema } from './db';
import { eq, and, isNull, lt } from 'drizzle-orm';

const { oidcPayloads } = schema;

/**
 * DrizzleAdapter implementa a interface Adapter do oidc-provider
 * para persistir dados do provedor OIDC usando PostgreSQL e Drizzle ORM.
 *
 * Este adaptador armazena todos os dados do provedor OIDC (sessões, tokens de acesso,
 * tokens de atualização, códigos de autorização, etc.) no modelo OidcPayload.
 */
export class DrizzleAdapter implements Adapter {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Cria ou atualiza um payload com o id fornecido.
   * Se o payload já existir, ele será atualizado.
   *
   * @param id - O identificador único para o payload
   * @param payload - Os dados do payload a serem armazenados
   * @param expiresIn - Tempo de vida em segundos (opcional)
   */
  async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    const existing = await db.select().from(oidcPayloads).where(eq(oidcPayloads.id, id)).limit(1);

    if (existing.length > 0) {
      await db
        .update(oidcPayloads)
        .set({
          payload: payload as Record<string, any>,
          expiresAt,
          grantId: payload.grantId,
          userCode: payload.userCode,
          uid: payload.uid,
          updatedAt: new Date(),
        })
        .where(eq(oidcPayloads.id, id));
    } else {
      await db.insert(oidcPayloads).values({
        id,
        type: this.name,
        payload: payload as Record<string, any>,
        grantId: payload.grantId,
        userCode: payload.userCode,
        uid: payload.uid,
        expiresAt,
      });
    }
  }

  /**
   * Busca um payload pelo seu id.
   * Retorna undefined se o payload não existir ou tiver expirado.
   *
   * @param id - O identificador único para o payload
   * @returns Os dados do payload ou undefined se não encontrado/expirado
   */
  async find(id: string): Promise<AdapterPayload | undefined> {
    const docs = await db.select().from(oidcPayloads).where(eq(oidcPayloads.id, id)).limit(1);
    const doc = docs[0];

    if (!doc) {
      return undefined;
    }

    // Verifica se o payload expirou
    if (doc.expiresAt && doc.expiresAt < new Date()) {
      // Remove o payload expirado
      await this.destroy(id);
      return undefined;
    }

    return doc.payload as AdapterPayload;
  }

  /**
   * Busca um payload pelo seu user code.
   * Usado para o Fluxo de Autorização de Dispositivo.
   *
   * @param userCode - O user code a ser buscado
   * @returns Os dados do payload ou undefined se não encontrado/expirado
   */
  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const docs = await db
      .select()
      .from(oidcPayloads)
      .where(eq(oidcPayloads.userCode, userCode))
      .limit(1);
    const doc = docs[0];

    if (!doc) {
      return undefined;
    }

    // Verifica se o payload expirou
    if (doc.expiresAt && doc.expiresAt < new Date()) {
      // Remove o payload expirado
      await this.destroy(doc.id);
      return undefined;
    }

    return doc.payload as AdapterPayload;
  }

  /**
   * Busca um payload pelo seu uid.
   * Usado para gerenciamento de sessões.
   *
   * @param uid - O uid a ser buscado
   * @returns Os dados do payload ou undefined se não encontrado/expirado
   */
  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const docs = await db
      .select()
      .from(oidcPayloads)
      .where(eq(oidcPayloads.uid, uid))
      .limit(1);
    const doc = docs[0];

    if (!doc) {
      return undefined;
    }

    // Verifica se o payload expirou
    if (doc.expiresAt && doc.expiresAt < new Date()) {
      // Remove o payload expirado
      await this.destroy(doc.id);
      return undefined;
    }

    return doc.payload as AdapterPayload;
  }

  /**
   * Remove um payload pelo seu id.
   * Esta operação é idempotente - não lançará erro se o payload não existir.
   *
   * @param id - O identificador único para o payload a ser removido
   */
  async destroy(id: string): Promise<void> {
    try {
      await db.delete(oidcPayloads).where(eq(oidcPayloads.id, id));
    } catch (err) {
      // Idempotência - ignora se o registro não existir
      // Este é o comportamento esperado quando o payload já foi removido
    }
  }

  /**
   * Revoga todos os payloads associados a um grant id.
   * Usado quando um grant é revogado (ex: revogação de token).
   *
   * @param grantId - O grant id a ser revogado
   */
  async revokeByGrantId(grantId: string): Promise<void> {
    await db.delete(oidcPayloads).where(eq(oidcPayloads.grantId, grantId));
  }

  /**
   * Marca um payload como consumido.
   * Usado para códigos de autorização que só podem ser usados uma vez.
   *
   * @param id - O identificador único para o payload a ser consumido
   */
  async consume(id: string): Promise<void> {
    const docs = await db.select().from(oidcPayloads).where(eq(oidcPayloads.id, id)).limit(1);
    const doc = docs[0];

    if (!doc) {
      return;
    }

    const payload = doc.payload as AdapterPayload;
    payload.consumed = Math.floor(Date.now() / 1000);

    await db
      .update(oidcPayloads)
      .set({
        payload: payload as Record<string, any>,
        consumedAt: new Date(),
      })
      .where(eq(oidcPayloads.id, id));
  }
}

/**
 * Função factory para criar instâncias de adaptador para diferentes modelos do oidc-provider.
 *
 * Uso:
 * ```ts
 * import { Provider } from 'oidc-provider';
 * import { DrizzleAdapter } from './adapter';
 *
 * const configuration = {
 *   adapter: {
 *     name: 'Session',
 *     constructor: DrizzleAdapter,
 *   },
 *   // ... outras configurações
 * };
 *
 * const oidc = new Provider('https://example.com', configuration);
 * ```
 *
 * @param name - O nome do modelo (ex: 'Session', 'AccessToken', 'AuthorizationCode', etc.)
 * @returns Uma nova instância de DrizzleAdapter
 */
export function createAdapter(name: string): DrizzleAdapter {
  return new DrizzleAdapter(name);
}

// Re-export db for convenience
export { db };
