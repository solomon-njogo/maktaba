import { backfillMissingMetadataFromOpenLibrary } from '@/backend/db/backfill-metadata';
import { initLocalDb } from '@/backend/db/init';

export async function initAppDatabase() {
  await initLocalDb();
}

export function runStartupMetadataBackfill(opts?: { signal?: AbortSignal }) {
  return backfillMissingMetadataFromOpenLibrary(opts);
}
