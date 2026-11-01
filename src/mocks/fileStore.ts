/** 模擬 GridFS：上傳的檔案存在 IndexedDB（localStorage 容量不夠放 PDF 與截圖） */
const DB_NAME = 'srs-guard-frontend-test-mock-files'
const STORE = 'files'

let opening: Promise<IDBDatabase> | null = null

function open() {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return opening
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T> | void) {
  const db = await open()
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = action(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req ? req.result : undefined)
    tx.onerror = () => reject(tx.error)
  })
}

export function putFile(id: string, blob: Blob) {
  return run('readwrite', (store) => store.put(blob, id))
}

export async function getFile(id: string) {
  return (await run<Blob>('readonly', (store) => store.get(id))) as Blob | undefined
}

export function deleteFiles(ids: string[]) {
  return run('readwrite', (store) => {
    for (const id of ids) store.delete(id)
  })
}

export function clearFiles() {
  return run('readwrite', (store) => store.clear())
}
