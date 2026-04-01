import { getDb } from '@/lib/db';

export async function initLocalDb() {
  await getDb();
}

