// Almacenamiento en este navegador (localStorage). Si el navegador lo bloquea
// (ventana privada, datos bloqueados), cae a memoria y la página lo avisa.
const PREFIJO = 'herramientas-clientes:';

function almacen() {
  try {
    const k = PREFIJO + '__prueba';
    localStorage.setItem(k, '1'); localStorage.removeItem(k);
    return {
      real: true,
      leer: (p) => { const v = localStorage.getItem(PREFIJO + p); return v == null ? null : JSON.parse(v); },
      escribir: (p, d) => localStorage.setItem(PREFIJO + p, JSON.stringify(d)),
      borrar: (p) => localStorage.removeItem(PREFIJO + p),
      claves: () => Object.keys(localStorage).filter((k) => k.startsWith(PREFIJO)).map((k) => k.slice(PREFIJO.length)),
    };
  } catch {
    const m = new Map();
    return { real: false, leer: (p) => (m.has(p) ? structuredClone(m.get(p)) : null), escribir: (p, d) => m.set(p, structuredClone(d)),
      borrar: (p) => m.delete(p), claves: () => [...m.keys()] };
  }
}

export async function abrirDb() {
  const a = almacen();
  const oyentes = new Map(); // colección -> Set<fn>
  const col = (path) => path.split('/').slice(0, -1).join('/');
  const listarSync = (c) => a.claves().filter((p) => col(p) === c).map((p) => ({ id: p.split('/').pop(), ...a.leer(p) }));
  const avisar = (c) => (oyentes.get(c) || []).forEach((fn) => fn(listarSync(c)));
  const escribir = (path, data) => {
    try { a.escribir(path, data); } catch { throw new Error('el navegador no tiene más espacio. Exportá el JSON y borrá tarjetas viejas'); }
    avisar(col(path));
  };
  // Otra pestaña del mismo navegador cambió algo: refrescar.
  addEventListener('storage', (e) => { if (e.key?.startsWith(PREFIJO)) avisar(col(e.key.slice(PREFIJO.length))); });
  return {
    real: a.real,
    async get(path) { return a.leer(path); },
    async set(path, data) { escribir(path, data); },
    async update(path, data) {
      const actual = a.leer(path);
      if (!actual) throw new Error('El documento no existe: ' + path);
      escribir(path, { ...actual, ...data });
    },
    async delete(path) { a.borrar(path); avisar(col(path)); },
    async listar(c) { return listarSync(c); },
    escuchar(c, fn) {
      if (!oyentes.has(c)) oyentes.set(c, new Set());
      oyentes.get(c).add(fn); fn(listarSync(c));
      return () => oyentes.get(c).delete(fn);
    },
  };
}

// Descarga de archivos con un enlace temporal (en GitHub Pages sí funciona).
const descargas = {
  async save({ filename, data }) {
    const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export async function usar(nombre) {
  return nombre === 'downloads' ? descargas : null;
}
