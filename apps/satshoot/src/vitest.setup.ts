class MemoryStorage {
    #store = new Map<string, string>();

    get length() {
        return this.#store.size;
    }

    clear() {
        this.#store.clear();
    }

    getItem(key: string) {
        return this.#store.has(key) ? this.#store.get(key)! : null;
    }

    key(index: number) {
        return Array.from(this.#store.keys())[index] ?? null;
    }

    removeItem(key: string) {
        this.#store.delete(key);
    }

    setItem(key: string, value: string) {
        this.#store.set(key, String(value));
    }
}

function ensureStorage(name: 'localStorage' | 'sessionStorage') {
    const existing = (globalThis as any)[name];
    if (!existing || typeof existing.getItem !== 'function' || typeof existing.setItem !== 'function') {
        Object.defineProperty(globalThis, name, {
            value: new MemoryStorage(),
            configurable: true,
        });
    }
}

ensureStorage('localStorage');
ensureStorage('sessionStorage');

