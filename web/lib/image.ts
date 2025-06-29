import { openDB } from 'idb';

async function db() {
  return openDB('wizzy-images', 1, {
    upgrade(db) {
      db.createObjectStore('images');
    },
  });
}

export async function storeImageBlob(blob: Blob) {
  const key = crypto.randomUUID();
  const d = await db();
  await d.put('images', blob, key);
  return key;
}

export async function getImageBlob(key: string) {
  const d = await db();
  return d.get('images', key);
}

export async function hasImage(key: string) {
  const d = await db();
  const val = await d.get('images', key);
  return !!val;
}
