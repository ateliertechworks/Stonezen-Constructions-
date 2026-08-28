/**
 * Node 25 injects its own experimental `localStorage` global, which is
 * non-functional without `--localstorage-file` and shadows the jsdom one.
 * Replace it with a plain in-memory implementation for the test run.
 */
class MemoryStorage {
  #map = new Map()
  get length() { return this.#map.size }
  key(i) { return [...this.#map.keys()][i] ?? null }
  getItem(k) { return this.#map.has(String(k)) ? this.#map.get(String(k)) : null }
  setItem(k, v) { this.#map.set(String(k), String(v)) }
  removeItem(k) { this.#map.delete(String(k)) }
  clear() { this.#map.clear() }
}

const storage = new MemoryStorage()
for (const target of [globalThis, globalThis.window].filter(Boolean)) {
  Object.defineProperty(target, 'localStorage', {
    value: storage, configurable: true, writable: true,
  })
}
