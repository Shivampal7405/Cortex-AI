import browser from 'webextension-polyfill';

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    const res = await browser.storage.local.get(key);
    return res[key] !== undefined ? (res[key] as T) : null;
  },
  
  async set(key: string, value: unknown): Promise<void> {
    await browser.storage.local.set({ [key]: value });
  },

  async remove(key: string): Promise<void> {
    await browser.storage.local.remove(key);
  }
};
