import type { OrderCheckpoint } from './types';

const STORAGE_KEY = 'orderCheckpoints';

type CheckpointMap = Record<string, OrderCheckpoint>;

async function readMap(): Promise<CheckpointMap> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const map = result[STORAGE_KEY];
  return map && typeof map === 'object' ? (map as CheckpointMap) : {};
}

async function writeMap(map: CheckpointMap): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: map });
}

export async function saveCheckpoint(checkpoint: OrderCheckpoint): Promise<void> {
  const map = await readMap();
  map[checkpoint.orderId] = checkpoint;
  await writeMap(map);
}

export async function loadCheckpoint(orderId: string): Promise<OrderCheckpoint | null> {
  const map = await readMap();
  return map[orderId] ?? null;
}

export async function removeCheckpoint(orderId: string): Promise<void> {
  const map = await readMap();
  if (!map[orderId]) return;
  delete map[orderId];
  await writeMap(map);
}
