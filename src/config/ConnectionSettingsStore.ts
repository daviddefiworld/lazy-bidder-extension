export const DEFAULT_BACKEND_URL = 'http://localhost:5005';

const KEY_URL = 'lazybidderBackendUrl';
const KEY_API = 'lazybidderApiKey';

/** Keys passed to `chrome.storage.onChanged` listeners. */
export const CONNECTION_STORAGE_KEYS = {
  backendUrl: KEY_URL,
  apiKey: KEY_API
} as const;

export type ConnectionSettings = {
  backendUrl: string;
  apiKey: string;
};

/** Side panel backend URL + API key in `chrome.storage.local`. */
export class ConnectionSettingsStore {
  read(): Promise<ConnectionSettings> {
    return new Promise((resolve) => {
      chrome.storage.local.get([KEY_URL, KEY_API], (result) => {
        const rawUrl = result[KEY_URL];
        const backendUrl =
          typeof rawUrl === 'string' && rawUrl.trim() !== '' ? rawUrl.trim() : DEFAULT_BACKEND_URL;
        const rawKey = result[KEY_API];
        const apiKey = typeof rawKey === 'string' ? rawKey : '';
        resolve({ backendUrl, apiKey });
      });
    });
  }

  save(backendUrl: string, apiKey: string): Promise<void> {
    const url = (backendUrl.trim() || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [KEY_URL]: url, [KEY_API]: apiKey.trim() }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
}

export const connectionSettings = new ConnectionSettingsStore();
