import { calcularTotal, armarPrompt, propuestaTexto, propuestaSinIA, montosSospechosos } from './propuesta.js';
import { MONEDA, formatearMoneda } from './precios.js';
import { normalizar } from './tablero.js';
import { h, copiar, toast } from './util.js';

const PAQUETES = [['presencia', 'Presencia'], ['tiendaWhatsapp', 'Tienda WhatsApp / simple'], ['tiendaPagos', 'Tienda con pagos'], ['catalogo', 'Catálogo PDF']];

export function iniciarPropuesta(raiz, ctx) {
  const { store, hoy } = ctx;
  let tarjeta = null; // la tarjeta desde la que se abrió, si hay

  const negocio = h('input', { id: 'p-negocio', name: 'negocio', required: true });
  const pais = h('select', { id: 'p-pais', name: 'pais' }, h('option', { value: 'CO' }, 'Colombia'), h('option', { value: 'ES' }, 'España'));
  const paquete = h('select', { id: 'p-paquete', name: 'paquete' }, PAQUETES.map(([v, t]) => h('option', { value: v }, t)));
  const catalogo = h('input', { id: 'p-catalogo', type: 'checkbox' });
  const mant = h('input', { id: 'p-mant', type: 'checkbox' });
  const cambios = h('input', { id: 'p-cambios', type: 'number', min: 0, step: 1, value: 0, inputmode: 'numeric' });
  const notas = h('textarea', { id: 'p-notas', rows: 7, placeholder: 'Pegá acá las notas de la reunión: qué vende, qué le duele, qué pidió, cómo atiende hoy…' });
  const total = h('div', { class: 'total', 'aria-live': 'polite' });
  const estado = h('p', { class: 'muted', 'aria-live': 'polite' });
  const texto = h('textarea', { id: 'p-texto', rows: 18, placeholder: 'Acá aparece la propuesta. La podés editar antes de copiarla.' });
  const btnIA = h('button', { class: 'primario', type: 'button', onclick: redactarIA }, 'Redactar con IA');
  const desde = h('p', { class: 'muted', hidden: true });

  raiz.replaceChildren(h('div', { class: 'vista estrecha' },
    h('h2', {}, 'Generador de propuestas'), desde,
    h('form', { class: 'bloque', novalidate: true, onsubmit: (e) => e.preventDefault(), oninput: pintarTotal },
      h('div', { class: 'campos' },
        h('label', { for: 'p-negocio' }, 'Negocio', negocio), h('label', { for: 'p-pais' }, 'País', pais),
        h('label', { for: 'p-paquete' }, 'Paquete', paquete), h('label', { for: 'p-cambios' }, 'Cambios extra', cambios)),
      h('div', { class: 'acciones' },
        h('label', { for: 'p-catalogo', class: 'check' }, catalogo, ' Sumar catálogo'),
        h('label', { for: 'p-mant', class: 'check' }, mant, ' Sumar mantenimiento mensual')),
      total,
      h('label', { for: 'p-notas' }, 'Notas de la reunión', notas),
      h('div', { class: 'acciones' }, btnIA, h('button', { type: 'button', onclick: usarPlantilla }, 'Usar plantilla sin IA')),
      estado),
    h('div', { class: 'bloque' },
      h('label', { for: 'p-texto' }, 'Propuesta', texto),
      h('div', { class: 'acciones' },
        h('button', { type: 'button', class: 'primario', onclick: async () => toast(await copiar(texto.value, texto) ? 'Propuesta copiada.' : 'Seleccioná y copiá a mano.') }, 'Copiar'),
        h('button', { type: 'button', onclick: bajarPdf }, 'Bajar PDF'),
        h('button', { type: 'button', onclick: marcarEnviada }, 'Marcar como enviada')))));

  const datos = () => {
    const cfg = ctx.config(), p = pais.value, paq = paquete.value;
    const complementos = { catalogo: catalogo.checked, mantenimiento: mant.checked, cambiosExtra: Math.max(0, Math.floor(Number(cambios.value) || 0)) };
    return { cfg, negocio: negocio.value.trim(), pais: p, paquete: paq, complementos, total: calcularTotal(p, paq, complementos, cfg.precios), notas: notas.value.trim() };
  };

  function pintarTotal() {
    const d = datos(), f = (x) => formatearMoneda(x, MONEDA[d.pais]);
    total.replaceChildren(
      h('span', {}, 'Total: ', h('b', {}, f(d.total.unico))),
      h('span', {}, 'Anticipo: ', h('b', {}, f(d.total.anticipo))),
      h('span', {}, 'Saldo: ', h('b', {}, f(d.total.saldo))),
      d.total.mensual ? h('span', {}, 'Mantenimiento: ', h('b', {}, f(d.total.mensual) + '/mes')) : '');
  }

  async function redactarIA() {
    const d = datos();
    if (!d.negocio) return toast('Poné el nombre del negocio.');
    if (!d.notas) return toast('Pegá las notas de la reunión.');
    const sample = await ctx.usar('sample');
    if (!sample) { estado.textContent = 'La IA no está disponible acá. Usé la plantilla; completala a mano.'; return usarPlantilla(); }
    btnIA.disabled = true; estado.textContent = 'Redactando…';
    try {
      const partes = await sample.json(armarPrompt({ ...d, config: d.cfg }), { modelTier: 'default' });
      texto.value = propuestaTexto(partes, { negocio: d.negocio, pais: d.pais, paquete: d.paquete, total: d.total, config: d.cfg });
      estado.textContent = montosSospechosos(partes) ? 'Ojo: la IA escribió un monto en el texto. Revisalo antes de mandar.' : 'Listo. Revisala y editá lo que haga falta.';
    } catch (e) {
      const motivo = { not_granted: 'no diste permiso para usar la IA en esta página', rate_limited: 'se alcanzó el límite de uso por ahora' }[e?.code] || 'la IA no respondió bien';
      estado.textContent = `No se pudo redactar con IA (${motivo}). Tus notas siguen acá; usé la plantilla.`;
      usarPlantilla();
    } finally { btnIA.disabled = false; }
  }

  function usarPlantilla() {
    const d = datos();
    if (!d.negocio) return toast('Poné el nombre del negocio.');
    texto.value = propuestaSinIA({ negocio: d.negocio, pais: d.pais, paquete: d.paquete, complementos: d.complementos, total: d.total, config: d.cfg });
  }

  async function bajarPdf() {
    if (!texto.value.trim()) return toast('Primero armá la propuesta.');
    const { jsPDF } = window.jspdf || {};
    const dl = await ctx.usar('downloads');
    if (!jsPDF || !dl) return toast('No se puede bajar el PDF acá. Usá "Copiar".');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const ancho = 515, x = 40;
    doc.setFillColor(11, 20, 38); doc.rect(0, 0, 595, 70, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('Kilian Vega', x, 42); doc.setTextColor(47, 123, 255); doc.text('· Desarrollo web', x + 98, 42);
    doc.setTextColor(13, 26, 51); doc.setFontSize(10.5);
    let y = 100;
    for (const linea of texto.value.split('\n')) {
      const titulo = linea && !linea.startsWith('-') && linea.length < 40 && !/[.:]$/.test(linea);
      doc.setFont('helvetica', titulo ? 'bold' : 'normal'); doc.setFontSize(titulo ? 12 : 10.5);
      for (const parte of doc.splitTextToSize(linea || ' ', ancho)) {
        if (y > 800) { doc.addPage(); y = 50; }
        doc.text(parte, x, y); y += titulo ? 18 : 15;
      }
    }
    try { await dl.save({ filename: `propuesta-${normalizar(negocio.value).replace(/ /g, '-') || 'cliente'}.pdf`, data: doc.output('blob') }); }
    catch (e) { if (!['declined', 'cancelled'].includes(e?.code)) toast('No se pudo bajar el PDF: ' + (e?.message || e)); }
  }

  async function marcarEnviada() {
    if (!tarjeta) return toast('Esta propuesta no salió de una tarjeta. Abrila desde el tablero para marcarla.');
    const d = datos(), cambios = { columna: 'propuesta', actualizado: hoy() };
    if (d.pais === (tarjeta.pais === 'ES' ? 'ES' : 'CO')) cambios.valor = d.total.unico;
    try { await store.update(`tarjetas/${tarjeta.id}`, cambios); toast(`${tarjeta.negocio} pasó a "Propuesta enviada".`); }
    catch (e) { toast('No se pudo actualizar la tarjeta: ' + (e?.message || e)); }
  }

  pintarTotal();
  return {
    cargarTarjeta(t) {
      const otra = t.id !== tarjeta?.id; tarjeta = t; negocio.value = t.negocio || ''; pais.value = t.pais === 'ES' ? 'ES' : 'CO';
      if (otra) notas.value = t.nota || '';
      desde.textContent = `Desde la tarjeta de ${t.negocio}.`; desde.hidden = false;
      texto.value = ''; estado.textContent = ''; pintarTotal();
    },
    refrescar: pintarTotal,
  };
}
