import { calcularTarifa, precioProyecto, paqueteCercano } from './calculo.js';
import { formatearMoneda, convertir } from './precios.js';
import { h, toast } from './util.js';

const INICIAL = { moneda: 'COP', fijos: 250000, personales: 1500000, gananciaPct: 20, horasSemana: 30, facturablePct: 60,
  vacacionesSemanas: 3, impuestosPct: 11, horasProyecto: 20, imprevistosPct: 15 };
const CAMPOS = [
  ['fijos', 'Gastos fijos del negocio al mes', 'dinero'], ['personales', 'Gastos personales al mes', 'dinero'],
  ['gananciaPct', 'Ganancia que querés sumar (%)'], ['horasSemana', 'Horas de trabajo por semana'],
  ['facturablePct', '% de horas que de verdad cobrás'], ['vacacionesSemanas', 'Semanas de vacaciones al año'],
  ['impuestosPct', 'Impuestos y retenciones (%)'],
];
const NOMBRE_PAQUETE = { presencia: 'Presencia', tiendaWhatsapp: 'Tienda WhatsApp', tiendaPagos: 'Tienda con pagos', catalogo: 'Catálogo PDF' };

export async function iniciarCalculadora(raiz, { store, config }) {
  const guardados = await store.get('config/calculadora').catch(() => null);
  const v = { ...INICIAL, ...(guardados || {}) };
  let ultimoGuardado = JSON.stringify(v), espera;

  const input = (k, etiqueta) => h('label', { for: 'k-' + k }, etiqueta,
    h('input', { id: 'k-' + k, name: k, type: 'number', inputmode: 'decimal', step: 'any', value: v[k] }));
  const salida = h('div', { class: 'vista', 'aria-live': 'polite' });
  const form = h('form', { class: 'bloque', novalidate: true },
    h('div', { class: 'campos' },
      h('label', { for: 'k-moneda' }, 'Moneda', h('select', { id: 'k-moneda', name: 'moneda' },
        ['COP', 'EUR'].map((m) => h('option', { value: m, selected: v.moneda === m }, m === 'COP' ? 'Pesos (COP)' : 'Euros (EUR)')))),
      CAMPOS.map(([k, t]) => input(k, t))));
  const proyecto = h('form', { class: 'bloque', novalidate: true },
    h('h3', {}, 'Precio de un proyecto'),
    h('div', { class: 'campos' }, input('horasProyecto', 'Horas estimadas'), input('imprevistosPct', 'Margen por imprevistos (%)')),
    h('div', { 'data-proyecto': '' }));

  raiz.replaceChildren(h('div', { class: 'vista estrecha' },
    h('h2', {}, 'Calculadora de tarifa'),
    h('p', { class: 'muted' }, 'Cargá tus números una vez. Se guardan solos.'),
    form, salida, proyecto));

  function leer() {
    for (const el of [...form.elements, ...proyecto.elements]) if (el.name) v[el.name] = el.name === 'moneda' ? el.value : (el.value === '' ? NaN : Number(el.value));
  }

  function pintar() {
    leer();
    const fmt = (x) => formatearMoneda(x, v.moneda);
    let r;
    try { r = calcularTarifa(v); } catch (e) {
      salida.replaceChildren(h('p', { class: 'aviso error' }, String(e.message).replace(/ \(\w+\)/, '') + '.'));
      proyecto.querySelector('[data-proyecto]').replaceChildren();
      return;
    }
    const otra = v.moneda === 'EUR' ? 'COP' : 'EUR', tasa = config().tasaEurCop;
    const eq = (x) => { // equivalente en la otra moneda; sin línea si la tasa no sirve
      try { return h('span', { class: 'muted' }, `≈ ${formatearMoneda(convertir(x, v.moneda, otra, tasa), otra)}${otra === 'EUR' ? ` (tasa ${tasa.toLocaleString('es-CO')})` : ''}`); }
      catch { return ''; }
    };
    salida.replaceChildren(
      h('div', { class: 'cifras' },
        h('div', { class: 'cifra' }, h('span', { class: 'muted' }, 'Por hora'), h('span', { class: 'num' }, fmt(r.hora)), eq(r.hora)),
        h('div', { class: 'cifra' }, h('span', { class: 'muted' }, 'Por día de 8 h'), h('span', { class: 'num' }, fmt(r.dia)), eq(r.dia)),
        h('div', { class: 'cifra' }, h('span', { class: 'muted' }, 'Facturación mensual necesaria'), h('span', { class: 'num' }, fmt(r.mensual)), eq(r.mensual))),
      h('details', { class: 'bloque' }, h('summary', {}, 'Cómo se calculó'),
        h('ol', { class: 'pasos' }, r.pasos.map((p) => h('li', {}, p.texto, ' ',
          h('span', { class: 'num' }, /Horas/.test(p.texto) ? Math.round(p.valor).toLocaleString('es-CO') + ' h' : fmt(p.valor)))))));
    const caja = proyecto.querySelector('[data-proyecto]');
    if (!(v.horasProyecto > 0) || !Number.isFinite(v.imprevistosPct) || v.imprevistosPct < 0) {
      caja.replaceChildren(h('p', { class: 'muted' }, 'Poné las horas (mayor que 0) y un margen de 0 % o más.'));
    } else {
      const precio = precioProyecto(v.horasProyecto, r.hora, v.imprevistosPct);
      const pais = v.moneda === 'EUR' ? 'ES' : 'CO';
      const cerca = paqueteCercano(precio, config().precios[pais]);
      caja.replaceChildren(h('div', { class: 'total' },
        h('span', {}, 'Precio del proyecto: ', h('b', {}, fmt(precio)), ' ', eq(precio)),
        h('span', { class: 'muted' }, `Paquete más cercano: ${NOMBRE_PAQUETE[cerca.clave] || cerca.clave} (${fmt(cerca.precio)})`)));
    }
    programarGuardado();
  }

  function programarGuardado() {
    clearTimeout(espera);
    espera = setTimeout(async () => {
      const ahora = JSON.stringify(v);
      if (ahora === ultimoGuardado || Object.values(v).some((x) => typeof x === 'number' && !Number.isFinite(x))) return;
      try { await store.set('config/calculadora', JSON.parse(ahora)); ultimoGuardado = ahora; }
      catch (e) { toast('No se pudieron guardar tus números: ' + (e?.message || e)); }
    }, 800);
  }

  form.addEventListener('input', pintar); proyecto.addEventListener('input', pintar);
  form.addEventListener('submit', (e) => e.preventDefault()); proyecto.addEventListener('submit', (e) => e.preventDefault());
  pintar();
  return { refrescar: pintar };
}
