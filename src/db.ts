import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

function getDatabaseUrl(): string {
  if (process.env.VERCEL) {
    const tmpDb = path.join('/tmp', 'dev.db');
    const bundledDb = path.join(process.cwd(), 'prisma', 'dev.db');
    if (!fs.existsSync(tmpDb)) {
      if (fs.existsSync(bundledDb)) {
        try {
          fs.copyFileSync(bundledDb, tmpDb);
        } catch (e) {
          console.warn('[DB] Could not copy dev.db to /tmp:', e);
        }
      }
    }
    return `file:${tmpDb}`;
  }
  return process.env.DATABASE_URL || 'file:./dev.db';
}

const dbUrl = getDatabaseUrl();
process.env.DATABASE_URL = dbUrl;

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});
