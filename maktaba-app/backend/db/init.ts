import { getDb } from './index';

export async function initLocalDb() {
  await getDb();
}
