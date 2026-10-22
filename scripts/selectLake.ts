/**
 * Import FIRST in a vite-node script to run it on the lake given by
 * `--lake=<id>` (default Huổi Vanh): the data modules read the active lake from
 * localStorage when they load, as in the browser (see banMongLake.test.ts).
 */
const lake = process.argv.find((a) => a.startsWith('--lake='))?.slice('--lake='.length);
if (lake) {
  const store = new Map<string, string>([['mooring_active_lake', lake]]);
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: () => null,
    length: 0
  } as Storage;
}
export {};
