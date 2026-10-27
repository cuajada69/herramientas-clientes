import { PRECIOS, MONEDA, formatearMoneda } from './precios.js';

const redondear = (n, pais) => (pais === 'ES' ? Math.round(n * 100) / 100 : Math.round(n));

export function calcularTotal(pais, paquete, complementos, precios) {
  const p = precios[pais], c = complementos || {};
  const unico = redondear(p[paquete] + (c.catalogo && paquete !== 'catalogo' ? p.catalogo : 0) + (c.cambiosExtra || 0) * p.cambioExtra, pais);
  const anticipo = redondear(unico / 2, pais);
  return { unico, anticipo, saldo: redondear(unico - anticipo, pais), mensual: c.mantenimiento ? p.mantenimiento : 0 };
}

const NOMBRES = { presencia: 'Presencia web', tiendaWhatsapp: 'Tienda con pedidos por WhatsApp', tiendaPagos: 'Tienda con pagos en línea', catalogo: 'Catálogo digital' };

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
  const plazo = (config?.precios ?? PRECIOS)[pais].plazos?.[paquete];
  return [
    'Eres redactor de propuestas comerciales para Kilian Vega · Desarrollo web. Escribe en español.',
    estilo,
    `Negocio: ${negocio}`,
    `Paquete: ${NOMBRES[paquete]}${extras.length ? ` (con ${extras.join(', ')})` : ''}${plazo ? `, plazo de ${plazo} días hábiles` : ''}`,
    `Notas del cliente: ${notas}`,
    `Montos ya definidos (úsalos tal cual): inversión única ${m.unico}, anticipo ${m.anticipo}, saldo ${m.saldo}${m.mensual ? `, mantenimiento ${m.mensual} al mes` : ''}.`,
    'Prohibido escribir cualquier monto distinto de los dados; si no hace falta un monto, no pongas ninguno.',
    'Responde solo con JSON válido, sin texto adicional, con esta forma: {"problema": string, "alcance": string[3..5], "tiempos": [{"etapa": string, "dias": number}], "proximosPasos": string[]}',
  ].join('\n');
}

export function propuestaTexto(partes, { negocio, pais, total, config = {} }) {
  const es = pais === 'ES', m = montos(pais, total);
  const dias = (partes.tiempos || []).reduce((s, t) => s + t.dias, 0);
  const lineas = [
    `Propuesta para ${negocio}`, '',
    es ? 'Lo que he visto' : 'Lo que vi', partes.problema, '',
    'Qué incluye', ...partes.alcance.map((a) => `- ${a}`), '',
    'Tiempos', ...(partes.tiempos || []).map((t) => `- ${t.etapa}: ${t.dias} días hábiles`), '',
    'Inversión', `- Pago único: ${m.unico}`, `- Anticipo del 50 %: ${m.anticipo}`, `- Saldo al entregar: ${m.saldo}`,
    ...(m.mensual ? [`- Mantenimiento: ${m.mensual} al mes`] : []), '',
    'Condiciones',
    `- Incluye 2 rondas de cambios.`,
    ...(dias ? [`- Plazo de ${dias} días hábiles, contados desde el anticipo y la recepción del material.`] : ['- El plazo cuenta desde el anticipo y la recepción del material.']),
    `- Pago principal por Wise${config.wise ? `: ${config.wise}` : ''}.`,
    `- Respaldo por AirTM${config.airtm ? `: ${config.airtm}` : ''}.`, '',
    'Próximos pasos', ...(partes.proximosPasos || []).map((p) => `- ${p}`),
  ];
  if (config.whatsapp) lineas.push('', `WhatsApp: ${config.whatsapp}`);
  lineas.push('', 'Kilian Vega · Desarrollo web');
  return lineas.join('\n');
}

const BASE = {
  presencia: { alcance: ['Diseño a medida de 1 a 5 secciones', 'Adaptada a móvil', 'Botón de contacto y mapa', 'Publicación en línea'], tiempos: [['Diseño', 2], ['Desarrollo', 2], ['Revisión y entrega', 1]] },
  tiendaWhatsapp: { alcance: ['Catálogo de productos con fotos y precios', 'Carrito que arma el pedido', 'Pedido enviado por mensaje al negocio', 'Adaptada a móvil', 'Publicación en línea'], tiempos: [['Diseño', 3], ['Desarrollo', 5], ['Revisión y entrega', 2]] },
  tiendaPagos: { alcance: ['Catálogo de productos con fotos y precios', 'Carrito y pasarela de pago', 'Panel para actualizar productos', 'Adaptada a móvil', 'Publicación en línea'], tiempos: [['Diseño', 4], ['Desarrollo', 8], ['Revisión y entrega', 3]] },
  catalogo: { alcance: ['Catálogo digital con tus productos', 'Fichas con fotos y descripción', 'Adaptado a móvil'], tiempos: [['Diseño', 1], ['Desarrollo', 3], ['Revisión y entrega', 1]] },
};

export function propuestaSinIA({ negocio, pais, paquete, complementos, total, config = {} }) {
  const b = BASE[paquete], c = complementos || {}, web = pais === 'ES' ? 'web' : 'página web';
  const alcance = [...b.alcance, ...(c.catalogo && paquete !== 'catalogo' ? ['Catálogo digital incluido'] : []), ...(c.mantenimiento ? ['Mantenimiento mensual'] : [])].slice(0, 5);
  return propuestaTexto({
    problema: `${negocio} necesita una ${web} clara que muestre lo que ofrece y facilite que te contacten.`,
    alcance, tiempos: b.tiempos.map(([etapa, dias]) => ({ etapa, dias })),
    proximosPasos: ['Confirmar la propuesta', 'Pagar el anticipo', 'Enviar logo, fotos y textos'],
  }, { negocio, pais, total, config });
}
