import { PRECIOS } from './precios.js';
import { h, toast } from './util.js';

const NOMBRES = {
  presencia: 'Presencia', tiendaWhatsapp: 'Tienda WhatsApp / simple', tiendaPagos: 'Tienda con pagos',
  catalogo: 'Catálogo PDF', mantenimiento: 'Mantenimiento (mes)', cambioExtra: 'Cambio extra',
};

export const CONFIG_INICIAL = { whatsapp: '', correo: '', wise: '', airtm: '', tasaEurCop: 4500, precios: structuredClone(PRECIOS) };

// Mezcla lo guardado sobre los valores por defecto, para que un campo nuevo nunca quede vacío.
export function completarConfig(guardada) {
  const c = { ...structuredClone(CONFIG_INICIAL), ...(guardada || {}) };
  for (const pais of ['CO', 'ES']) c.precios[pais] = { ...PRECIOS[pais], ...(guardada?.precios?.[pais] || {}), plazos: PRECIOS[pais].plazos };
  return c;
}

export function iniciarConfig(raiz, { store, config, alGuardar }) {
  const campo = (id, etiqueta, valor, tipo = 'text', extra = {}) =>
    h('label', { for: id }, etiqueta, h('input', { id, name: id, type: tipo, value: valor ?? '', ...extra }));

  const precios = (pais) => h('fieldset', { class: 'bloque' },
    h('legend', {}, pais === 'CO' ? 'Precios Colombia (COP)' : 'Precios España (EUR)'),
    h('div', { class: 'campos' }, Object.keys(NOMBRES).map((k) =>
      campo(`p-${pais}-${k}`, NOMBRES[k], config.precios[pais][k], 'number', { min: 0, step: pais === 'ES' ? '0.01' : '1000', inputmode: 'decimal' }))));

  const form = h('form', { class: 'vista estrecha', novalidate: true },
    h('h2', {}, 'Configuración'),
    h('p', { class: 'muted' }, 'Estos datos salen en las propuestas y los mensajes. Solo los ves vos.'),
    h('div', { class: 'bloque' },
      h('div', { class: 'campos' },
        campo('c-whatsapp', 'Tu WhatsApp', config.whatsapp, 'tel', { placeholder: '+57 3xx xxx xxxx' }),
        campo('c-correo', 'Tu correo', config.correo, 'email'),
        campo('c-wise', 'Wise (correo o datos de la cuenta)', config.wise),
        campo('c-airtm', 'AirTM (usuario o correo)', config.airtm),
        campo('c-tasa', '1 EUR en COP', config.tasaEurCop, 'number', { min: 1, step: 1, inputmode: 'numeric' }))),
    precios('CO'), precios('ES'),
    h('div', { class: 'acciones' }, h('button', { class: 'primario', type: 'submit' }, 'Guardar configuración')));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = (id) => form.querySelector('#' + id).value.trim();
    const n = (id) => Number(v(id));
    const tasa = n('c-tasa');
    if (!(tasa > 0)) return toast('La tasa EUR→COP tiene que ser un número mayor que 0.');
    const nueva = { whatsapp: v('c-whatsapp'), correo: v('c-correo'), wise: v('c-wise'), airtm: v('c-airtm'), tasaEurCop: tasa, precios: {} };
    for (const pais of ['CO', 'ES']) {
      nueva.precios[pais] = { plazos: PRECIOS[pais].plazos };
      for (const k of Object.keys(NOMBRES)) {
        const x = n(`p-${pais}-${k}`);
        if (!(x >= 0) || v(`p-${pais}-${k}`) === '') return toast(`Revisá el precio "${NOMBRES[k]}" de ${pais}.`);
        nueva.precios[pais][k] = x;
      }
    }
    try { await store.set('config/general', nueva); alGuardar(nueva); toast('Configuración guardada.'); }
    catch (err) { toast('No se pudo guardar: ' + (err?.message || err)); }
  });

  raiz.replaceChildren(form);
}
