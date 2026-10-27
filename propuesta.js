import { PRECIOS, MONEDA, ANTICIPO_PCT, RONDAS_CAMBIOS, formatearMoneda } from './precios.js';

const redondear = (n, pais) => (pais === 'ES' ? Math.round(n * 100) / 100 : Math.round(n));

export function calcularTotal(pais, paquete, complementos, precios) {
  const p = precios[pais], c = complementos || {};
  const unico = redondear(p[paquete] + (c.catalogo && paquete !== 'catalogo' ? p.catalogo : 0) + (c.cambiosExtra || 0) * p.cambioExtra, pais);
  const anticipo = redondear(unico * ANTICIPO_PCT / 100, pais);
  return { unico, anticipo, saldo: redondear(unico - anticipo, pais), mensual: c.mantenimiento ? p.mantenimiento : 0 };
}

const nombrePaquete = (paquete, pais) => ({ presencia: 'Presencia web', tiendaPagos: 'Tienda con pagos en línea', catalogo: 'Catálogo digital',
  tiendaWhatsapp: pais === 'ES' ? 'Tienda simple con pedidos por formulario' : 'Tienda con pedidos por WhatsApp' })[paquete];

// Plazo total en días hábiles: config primero, luego los precios por defecto. Catálogo no tiene plazo.
const plazoDe = (pais, paquete, config) => config?.precios?.[pais]?.plazos?.[paquete] ?? PRECIOS[pais]?.plazos?.[paquete];

function montos(pais, total) {
  const f = (n) => formatearMoneda(n, MONEDA[pais]);
  return { unico: f(total.unico), anticipo: f(total.anticipo), saldo: f(total.saldo), mensual: total.mensual ? f(total.mensual) : '' };
}

export function armarPrompt({ notas, negocio, pais, paquete, complementos, total, config }) {
  const m = montos(pais, total), c = complementos || {};
  const extras = [c.catalogo && 'catálogo', c.cambiosExtra && `${c.cambiosExtra} cambios extra`, c.mantenimiento && 'mantenimiento mensual'].filter(Boolean);
  const estilo = pais === 'ES'
    ? 'Variante España: di "web" (no "página web"), tuteo profesional, no menciones WhatsApp.'
    : 'Variante Colombia: di "página web", tono cercano y cálido.';
  const plazo = plazoDe(pais, paquete, config);
  return [
    'Eres redactor de propuestas comerciales para Kilian Vega · Desarrollo web. Escribe en español.',
    estilo,
    `Negocio: ${negocio}`,
    `Paquete: ${nombrePaquete(paquete, pais)}${extras.length ? ` (con ${extras.join(', ')})` : ''}${plazo ? `, plazo de ${plazo} días hábiles` : ''}`,
    `Notas del cliente: ${notas ?? ''}`,
    `Montos ya definidos (úsalos tal cual): inversión única ${m.unico}, anticipo ${m.anticipo}, saldo ${m.saldo}${m.mensual ? `, mantenimiento ${m.mensual} al mes` : ''}.`,
    plazo ? `Los días de las etapas de "tiempos" deben sumar exactamente ${plazo}.` : 'No pongas plazos totales en días.',
    'Prohibido escribir cualquier monto distinto de los dados; si no hace falta un monto, no pongas ninguno.',
    'Responde solo con JSON válido, sin texto adicional, con esta forma: {"problema": string, "alcance": string[3..5], "tiempos": [{"etapa": string, "dias": number}], "proximosPasos": string[]}',
  ].join('\n');
}

export function propuestaTexto(partes, { negocio, pais, paquete, total, config = {} }) {
  const es = pais === 'ES', m = montos(pais, total);
  const lista = (x) => (Array.isArray(x) ? x : []);
  const tiempos = lista(partes?.tiempos).map((t) => ({ etapa: String(t?.etapa ?? ''), dias: Number(t?.dias) || 0 }));
  const plazo = plazoDe(pais, paquete, config);
  const lineas = [
    `Propuesta para ${negocio}`, '',
    es ? 'Lo que he visto' : 'Lo que vi', partes?.problema ?? '', '',
    'Qué incluye', ...lista(partes?.alcance).map((a) => `- ${a}`), '',
    ...(tiempos.length ? ['Tiempos', ...tiempos.map((t) => `- ${t.etapa}: ${t.dias} días hábiles`), ''] : []),
    'Inversión', `- Pago único: ${m.unico}`, `- Anticipo del ${ANTICIPO_PCT} %: ${m.anticipo}`, `- Saldo al entregar: ${m.saldo}`,
    ...(m.mensual ? [`- Mantenimiento: ${m.mensual} al mes`] : []), '',
    'Condiciones',
    `- Incluye ${RONDAS_CAMBIOS} rondas de cambios.`,
    ...(plazo ? [`- Plazo de ${plazo} días hábiles, contados desde el anticipo y la recepción del material.`] : []),
    `- Pago principal por Wise${config.wise ? `: ${config.wise}` : ''}.`,
    `- Respaldo por AirTM${config.airtm ? `: ${config.airtm}` : ''}.`, '',
    'Próximos pasos', ...lista(partes?.proximosPasos).map((p) => `- ${p}`),
  ];
  if (config.whatsapp) lineas.push('', `WhatsApp: ${config.whatsapp}`);
  lineas.push('', 'Kilian Vega · Desarrollo web');
  return lineas.join('\n');
}

const BASE = {
  presencia: ['Diseño a medida de 1 a 5 secciones', 'Adaptada a móvil', 'Botón de contacto y mapa', 'Publicación en línea'],
  tiendaWhatsapp: ['Catálogo de productos con fotos y precios', 'Carrito que arma el pedido', 'Pedido enviado por mensaje al negocio', 'Adaptada a móvil', 'Publicación en línea'],
  tiendaPagos: ['Catálogo de productos con fotos y precios', 'Carrito y pasarela de pago', 'Panel para actualizar productos', 'Adaptada a móvil', 'Publicación en línea'],
  catalogo: ['Catálogo digital con tus productos', 'Fichas con fotos y descripción', 'Adaptado a móvil'],
};

// Reparte el plazo del paquete en 3 etapas que suman exactamente ese plazo.
function etapas(plazo) {
  const diseno = Math.round(plazo * 0.3), entrega = Math.max(1, Math.round(plazo * 0.2));
  return [['Diseño', diseno], ['Desarrollo', plazo - diseno - entrega], ['Revisión y entrega', entrega]].map(([etapa, dias]) => ({ etapa, dias }));
}

export function propuestaSinIA({ negocio, pais, paquete, complementos, total, config = {} }) {
  const c = complementos || {}, web = pais === 'ES' ? 'web' : 'página web';
  const plazo = plazoDe(pais, paquete, config);
  const alcance = [...BASE[paquete],
    ...(c.catalogo && paquete !== 'catalogo' ? ['Catálogo digital incluido'] : []),
    ...(c.cambiosExtra ? [`${c.cambiosExtra} cambios extra`] : []),
    ...(c.mantenimiento ? ['Mantenimiento mensual'] : [])];
  return propuestaTexto({
    problema: `${negocio} necesita una ${web} clara que muestre lo que ofrece y facilite que te contacten.`,
    alcance, tiempos: plazo ? etapas(plazo) : [],
    proximosPasos: ['Confirmar la propuesta', 'Pagar el anticipo', 'Enviar logo, fotos y textos'],
  }, { negocio, pais, paquete, total, config });
}
