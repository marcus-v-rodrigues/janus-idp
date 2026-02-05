import "dotenv/config";
import { Adapter, AdapterPayload } from 'oidc-provider';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

export class PrismaAdapter implements Adapter {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    await prisma.oidcPayload.upsert({
      where: { id },
      update: {
        payload: payload as any,
        expiresAt,
        grantId: payload.grantId,
        userCode: payload.userCode,
        uid: payload.uid,
        updatedAt: new Date(),
      },
      create: {
        id,
        type: this.name,
        payload: payload as any,
        grantId: payload.grantId,
        userCode: payload.userCode,
        uid: payload.uid,
        expiresAt,
      },
    });
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    const doc = await prisma.oidcPayload.findUnique({ where: { id } });

    if (!doc || (doc.expiresAt && doc.expiresAt < new Date())) {
      return undefined;
    }
    return doc.payload as AdapterPayload;
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const doc = await prisma.oidcPayload.findUnique({ where: { userCode } });

    if (!doc || (doc.expiresAt && doc.expiresAt < new Date())) {
      return undefined;
    }
    return doc.payload as AdapterPayload;
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const doc = await prisma.oidcPayload.findUnique({ where: { uid } });

    if (!doc || (doc.expiresAt && doc.expiresAt < new Date())) {
      return undefined;
    }
    return doc.payload as AdapterPayload;
  }

  async destroy(id: string): Promise<void> {
    try {
      await prisma.oidcPayload.delete({ where: { id } });
    } catch (err) {
      // Idempotência
    }
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    await prisma.oidcPayload.deleteMany({ where: { grantId } });
  }

  async consume(id: string): Promise<void> {
    const doc = await prisma.oidcPayload.findUnique({ where: { id } });
    if (!doc) return;

    const payload = doc.payload as AdapterPayload;
    payload.consumed = Math.floor(Date.now() / 1000);
    await prisma.oidcPayload.update({
      where: { id },
      data: {
        payload: payload as any,
        consumedAt: new Date()
      },
    });
  }
}