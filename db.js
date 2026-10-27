// Adaptador de la db del artifact. Si claude.use("db") no está (local, sin sesión),
// cae a un store en memoria para que la página siga funcionando.

function memoria() {
  const docs = new Map();
  const oyentes = new Map(); // col -> Set<fn>
  const col = (path) => path.split('/').slice(0, -1).join('/');
  const avisar = (c) => (oyentes.get(c) || []).forEach((fn) => fn(listarSync(c)));
  const listarSync = (c) =>
    [...docs.entries()].filter(([p]) => col(p) === c).map(([p, d]) => ({ id: p.split('/').pop(), ...structuredClone(d) }));
  return {
    real: false,
    async get(path) { return docs.has(path) ? structuredClone(docs.get(path)) : null; },
    async set(path, data) { docs.set(path, structuredClone(data)); avisar(col(path)); },
    async update(path, data) {
      if (!docs.has(path)) throw new Error('El documento no existe: ' + path);
      docs.set(path, { ...docs.get(path), ...structuredClone(data) }); avisar(col(path));
    },
    async delete(path) { docs.delete(path); avisar(col(path)); },
    async listar(c) { return listarSync(c); },
    escuchar(c, fn) {
      if (!oyentes.has(c)) oyentes.set(c, new Set());
      oyentes.get(c).add(fn); fn(listarSync(c));
      return () => oyentes.get(c).delete(fn);
    },
  };
}

function real(db) {
  return {
    real: true,
    async get(path) { const s = await db.doc(path).get(); return s.exists ? s.data() : null; },
    set: (path, data) => db.doc(path).set(data),
    update: (path, data) => db.doc(path).update(data),
    delete: (path) => db.doc(path).delete(),
    async listar(c) { const s = await db.collection(c).get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); },
    escuchar(c, fn, onError) {
      return db.collection(c).onSnapshot((s) => fn(s.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
    },
  };
}

export async function abrirDb() {
  try {
    const db = await window.claude?.use?.('db');
    if (db) return real(db);
  } catch { /* sin bridge: memoria */ }
  return memoria();
}

export async function usar(nombre) {
  try { return (await window.claude?.use?.(nombre)) ?? null; } catch { return null; }
}
