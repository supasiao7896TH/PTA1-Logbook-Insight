/**
 * ③ STORAGE_ENGINE — Promise-based IndexedDB + Web Crypto AES-GCM 256-bit for API Keys
 */

import { AppConfig } from './app-config.js';

let _dbPromise = null;

function _openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(AppConfig.DB_NAME, AppConfig.DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('custom_months')) {
        db.createObjectStore('custom_months', { keyPath: 'monthKey' });
      }
      if (!db.objectStoreNames.contains('ips_drafts')) {
        db.createObjectStore('ips_drafts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

async function _getCryptoKey() {
  const rawMaterial = new TextEncoder().encode('Supasit.A-Studio-PTA1-AES-256-GCM');
  const hash = await crypto.subtle.digest('SHA-256', rawMaterial);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export const StorageEngine = {
  async saveSetting(key, value) {
    const db = await _openDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ key, value, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getSetting(key, fallback = null) {
    const db = await _openDb();
    if (!db) return fallback;
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
      req.onerror = () => resolve(fallback);
    });
  },

  async saveCustomMonth(monthPayload) {
    const db = await _openDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('custom_months', 'readwrite');
      tx.objectStore('custom_months').put(monthPayload);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getAllCustomMonths() {
    const db = await _openDb();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction('custom_months', 'readonly');
      const req = tx.objectStore('custom_months').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  },

  async saveIpsDraft(draft) {
    const db = await _openDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('ips_drafts', 'readwrite');
      tx.objectStore('ips_drafts').put({ ...draft, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getAllIpsDrafts() {
    const db = await _openDb();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction('ips_drafts', 'readonly');
      const req = tx.objectStore('ips_drafts').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  },

  async saveEncryptedApiKey(plainKey) {
    if (!plainKey) {
      await this.saveSetting('gemini_key_enc', null);
      return;
    }
    const key = await _getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainKey.trim());
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    await this.saveSetting('gemini_key_enc', {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(cipherBuf))
    });
  },

  async getDecryptedApiKey() {
    const payload = await this.getSetting('gemini_key_enc', null);
    if (!payload || !payload.iv || !payload.data) return '';
    try {
      const key = await _getCryptoKey();
      const decBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(payload.iv) },
        key,
        new Uint8Array(payload.data)
      );
      return new TextDecoder().decode(decBuf);
    } catch {
      return '';
    }
  },

  async exportAllData() {
    const customMonths = await this.getAllCustomMonths();
    const ipsDrafts = await this.getAllIpsDrafts();
    const theme = await this.getSetting('theme', 'light');

    return JSON.stringify({
      appName: 'PTA1 Logbook Insight',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      theme,
      customMonths,
      ipsDrafts
    }, null, 2);
  },

  async importAllData(jsonStr) {
    if (!jsonStr) throw new Error('ไฟล์ข้อมูลว่างเปล่าค่ะ');
    const payload = JSON.parse(jsonStr);

    let draftsImported = 0;
    if (Array.isArray(payload.ipsDrafts)) {
      for (const d of payload.ipsDrafts) {
        if (d && d.id) {
          await this.saveIpsDraft(d);
          draftsImported++;
        }
      }
    }

    let monthsImported = 0;
    if (Array.isArray(payload.customMonths)) {
      for (const m of payload.customMonths) {
        if (m && m.monthKey) {
          await this.saveCustomMonth(m);
          monthsImported++;
        }
      }
    }

    if (payload.theme) {
      await this.saveSetting('theme', payload.theme);
    }

    return { draftsImported, monthsImported };
  }
};
