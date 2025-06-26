import { openDB } from 'idb';

async function db() {
  return openDB('wizzy-audio', 1, {
    upgrade(db) {
      db.createObjectStore('audio');
    },
  });
}

export async function storeAudioBlob(blob: Blob) {
  const key = crypto.randomUUID();
  const d = await db();
  await d.put('audio', blob, key);
  return key;
}

export async function getAudioBlob(key: string) {
  const d = await db();
  return d.get('audio', key);
}

export async function hasAudio(key: string) {
  const d = await db();
  const val = await d.get('audio', key);
  return !!val;
}
