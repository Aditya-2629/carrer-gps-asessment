/**
 * IndexedDB helper for persisting raw resume File objects across page reloads.
 * Avoids the localStorage JSON serialization trap where File becomes { name, size, type }.
 */

const DB_NAME = 'crafture_resume_store'
const DB_VERSION = 1
const STORE_NAME = 'files'
const RESUME_KEY = 'uploaded_resume'

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return resolve(null)
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch (_e) {
      resolve(null)
    }
  })
}

export async function saveResumeFileToStorage(file) {
  if (!file || !(file instanceof Blob)) return
  try {
    const db = await openDB()
    if (!db) return
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put(file, RESUME_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch (err) {
    console.warn('[ResumeStorage] Failed to save file to IndexedDB:', err)
  }
}

export async function getResumeFileFromStorage() {
  try {
    const db = await openDB()
    if (!db) return null
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(RESUME_KEY)
      req.onsuccess = () => {
        const val = req.result
        if (val instanceof File) {
          resolve(val)
        } else if (val instanceof Blob) {
          // Re-wrap Blob if needed
          const reconstructed = new File([val], val.name || 'resume.pdf', {
            type: val.type || 'application/pdf',
          })
          resolve(reconstructed)
        } else {
          resolve(null)
        }
      }
      req.onerror = () => resolve(null)
    })
  } catch (err) {
    console.warn('[ResumeStorage] Failed to read file from IndexedDB:', err)
    return null
  }
}

export async function clearResumeFileFromStorage() {
  try {
    const db = await openDB()
    if (!db) return
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.delete(RESUME_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch (_e) {}
}
