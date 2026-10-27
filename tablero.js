export const COLUMNAS = [
  { id: 'prospecto', titulo: 'Prospecto' },
  { id: 'escribi', titulo: 'Le escribí' },
  { id: 'conversacion', titulo: 'En conversación' },
  { id: 'propuesta', titulo: 'Propuesta enviada' },
  { id: 'cliente', titulo: 'Cliente' },
  { id: 'descartado', titulo: 'Descartado' },
];

export const normalizar = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const slug = (s) => normalizar(s).replace(/ /g, '-');

export function crearTarjeta(datos, hoy) {
  const t = { negocio: '', rubro: '', pais: 'CO', ciudad: '', correo: '', telefono: '', instagram: '', web: '', servicio: '',
    valor: null, fuente: '', proximo: null, nota: '', columna: 'prospecto', actualizado: hoy,
    ...Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined)) };
  t.id = datos.id || `${slug(t.negocio)}-${slug(t.ciudad)}`.replace(/^-+|-+$/g, '') || 'tarjeta-' + Date.now().toString(36);
  return t;
}

const limpiaWeb = (w) => String(w ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
const limpiaIg = (i) => String(i ?? '').toLowerCase().replace(/^.*instagram\.com\//, '').replace(/^@/, '').replace(/[/?].*$/, '');

export function esDuplicado(a, b) {
  if (normalizar(a.negocio) === normalizar(b.negocio) && normalizar(a.ciudad) === normalizar(b.ciudad)) return true;
  if (limpiaWeb(a.web) && limpiaWeb(a.web) === limpiaWeb(b.web)) return true;
  return !!limpiaIg(a.instagram) && limpiaIg(a.instagram) === limpiaIg(b.instagram);
}

function clasificarContacto(c) {
  if (!c) return {};
  if (c.startsWith('@') || /instagram\.com\//i.test(c)) return { instagram: c.startsWith('@') ? c : '@' + limpiaIg(c) };
  if (/^\S+@\S+\.\S+$/.test(c)) return { correo: c };
  if (/^[+\d][\d\s()-]{6,}$/.test(c)) return { telefono: c };
  return { web: c };
}

export function parsearLista(texto, hoy) {
  const tarjetas = [], errores = [];
  texto.split(/\r?\n/).forEach((linea, i) => {
    if (!linea.trim()) return;
    const [negocio, rubro = '', pais = '', ciudad = '', contacto = '', fuente = ''] = linea.split('|').map((x) => x.trim());
    if (linea.split('|').length < 2 || !negocio) return errores.push({ linea: i + 1, texto: linea.trim() });
    tarjetas.push(crearTarjeta({ negocio, rubro, pais: ['es', 'espana', 'spain'].includes(normalizar(pais)) ? 'ES' : 'CO', ciudad, fuente,
      ...clasificarContacto(contacto) }, hoy));
  });
  return { tarjetas, errores };
}

export const hoyLocal = (fecha, zona) => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(fecha);

const dias = (iso) => Date.parse(iso + 'T00:00:00Z') / 86400000;

export function resumenHoy(tarjetas, hoy) {
  return {
    escribirHoy: tarjetas.filter((t) => t.proximo && t.proximo <= hoy && !['cliente', 'descartado'].includes(t.columna)),
    sinRespuesta: tarjetas.filter((t) => t.columna === 'escribi' && dias(hoy) - dias(t.actualizado) > 3),
  };
}

export function plantilla(tipo, t, config = {}) {
  const es = t.pais === 'ES';
  if (tipo === 'correo' && es) return null;
  const web = es ? 'web' : 'página web';
  const servicio = t.servicio || (es ? 'una web sencilla que te traiga clientes' : 'una página web sencilla que te traiga clientes');
  const problema = t.nota ? `Vi a ${t.negocio} y noté que ${String(t.nota).replace(/[.\s]+$/, '')}.` : `Busqué a ${t.negocio} en internet y no encontré una ${web} propia donde ver lo que ofrecen.`;
  const saludo = es ? `Hola, soy Kilian, desarrollador web.` : `Hola, ¿cómo estás? Soy Kilian, desarrollador web.`;
  const oferta = `Puedo hacerles ${servicio}, con ${es ? 'plazo cerrado' : 'entrega en pocos días'}.`;
  const cierre = "¿Te cuento cómo lo haríamos?";
  const lineas = [saludo, problema, oferta, cierre];
  if (tipo === 'correo') return [`Asunto: ${web} para ${t.negocio}`, '', `Hola, equipo de ${t.negocio}:`, ...lineas.slice(1), '', 'Kilian Vega · Desarrollo web'].join('\n');
  if (tipo === 'whatsapp' && !es && config.whatsapp) lineas.push(`Mi WhatsApp: ${config.whatsapp}`);
  return lineas.join('\n');
}
