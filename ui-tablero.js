import { COLUMNAS, crearTarjeta, esDuplicado, parsearLista, resumenHoy, plantilla } from './tablero.js';
import { MONEDA, formatearMoneda } from './precios.js';
import { h, $, copiar, toast } from './util.js';

const AVISO_ES = 'No enviar correo en frío (LSSI). Usá formulario web, DM de Instagram o teléfono.';
const fechaCorta = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '';

export function iniciarTablero(raiz, ctx) {
  const { store, hoy } = ctx;
  let tarjetas = [];
  const sortables = [];

  const resumen = h('div', { class: 'hoy', 'aria-live': 'polite' });
  const columnas = h('div', { class: 'columnas' });
  const acciones = h('div', { class: 'acciones' },
    h('button', { class: 'primario', type: 'button', onclick: () => abrirTarjeta(null) }, 'Nueva tarjeta'),
    h('button', { type: 'button', onclick: abrirPegar }, 'Pegar lista'),
    h('button', { type: 'button', onclick: exportar }, 'Exportar JSON'),
    h('label', { class: 'btn', for: 'importar-json' }, 'Importar JSON',
      h('input', { id: 'importar-json', type: 'file', accept: 'application/json,.json', hidden: true, onchange: importar })));
  const vacio = h('p', { class: 'muted', hidden: true },
    'Todavía no hay negocios. Tocá "Nueva tarjeta", pegá una lista (una línea por negocio: negocio | rubro | país | ciudad | contacto | fuente) o cargá resultados con /buscar-clientes.');

  raiz.replaceChildren(
    store.real ? '' : h('p', { class: 'aviso warn' }, 'No hay conexión con la base. Lo que cargues ahora solo dura mientras la página siga abierta. Exportá el JSON antes de cerrarla.'),
    resumen, acciones, vacio, h('div', { class: 'carril' }, columnas));

  // Un Sortable por columna; se crean una vez y el render solo cambia su contenido.
  for (const c of COLUMNAS) {
    const lista = h('div', { class: 'lista', 'data-col': c.id });
    columnas.append(h('section', { class: 'col', 'aria-label': c.titulo },
      h('header', {}, h('h3', {}, c.titulo), h('span', { class: 'contador', 'data-cuenta': c.id }, '0')), lista));
    if (window.Sortable) sortables.push(window.Sortable.create(lista, {
      group: 'tablero', sort: false, animation: 150, delay: 150, delayOnTouchOnly: true, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',
      onEnd: (ev) => {
        const id = ev.item.dataset.id, destino = ev.to.dataset.col;
        if (ev.from === ev.to) return;
        guardar(id, { columna: destino, actualizado: hoy() });
      },
    }));
  }

  async function guardar(id, cambios) {
    try { await store.update(`tarjetas/${id}`, cambios); }
    catch (e) { toast('No se pudo guardar el cambio: ' + (e?.message || e)); render(); }
  }

  function chipFecha(t) {
    const hoyD = hoy();
    if (!t.proximo || ['cliente', 'descartado'].includes(t.columna)) return '';
    const clase = t.proximo < hoyD ? 'atraso' : t.proximo === hoyD ? 'vence' : '';
    return h('span', { class: `chip ${clase}` }, t.proximo === hoyD ? 'hoy' : fechaCorta(t.proximo));
  }

  function nodoTarjeta(t) {
    return h('article', { class: 'tarjeta', 'data-id': t.id, tabindex: 0, 'aria-label': t.negocio,
      onclick: () => abrirTarjeta(t), onkeydown: (e) => { if (e.key === 'Enter') abrirTarjeta(t); } },
      h('span', { class: 't-nombre' }, t.negocio),
      h('span', { class: 't-meta' }, [t.rubro, t.ciudad].filter(Boolean).join(' · '),
        t.pais === 'ES' ? h('span', { class: 'chip es', title: AVISO_ES }, 'ES') : '', chipFecha(t)),
      t.valor ? h('span', { class: 't-meta num' }, formatearMoneda(t.valor, MONEDA[t.pais] || 'COP')) : '');
  }

  function render() {
    const hoyD = hoy(), r = resumenHoy(tarjetas, hoyD);
    const item = (t, extra) => h('li', {}, h('button', { type: 'button', onclick: () => abrirTarjeta(t) }, h('span', {}, t.negocio), h('span', { class: 'muted' }, extra)));
    resumen.replaceChildren(
      h('section', {}, h('h3', {}, 'Escribir hoy ', h('span', { class: 'contador' }, r.escribirHoy.length)),
        r.escribirHoy.length ? h('ul', {}, r.escribirHoy.map((t) => item(t, t.proximo < hoyD ? 'atrasado' : 'hoy'))) : h('p', { class: 'muted' }, 'Nadie para hoy.')),
      h('section', {}, h('h3', {}, 'Sin respuesta hace más de 3 días ', h('span', { class: 'contador' }, r.sinRespuesta.length)),
        r.sinRespuesta.length ? h('ul', {}, r.sinRespuesta.map((t) => item(t, 'desde ' + fechaCorta(t.actualizado)))) : h('p', { class: 'muted' }, 'Todos al día.')));
    for (const c of COLUMNAS) {
      const deCol = tarjetas.filter((t) => t.columna === c.id).sort((a, b) => (a.proximo || '9').localeCompare(b.proximo || '9'));
      $(`[data-col="${c.id}"]`, columnas).replaceChildren(...deCol.map(nodoTarjeta));
      $(`[data-cuenta="${c.id}"]`, columnas).textContent = deCol.length;
    }
    vacio.hidden = tarjetas.length > 0;
  }

  store.escuchar('tarjetas', (lista) => { tarjetas = lista; render(); },
    (e) => toast('Se perdió la conexión con la base (' + (e?.code || 'error') + '). Recargá la página.'));

  // ---------- Detalle de tarjeta ----------
  function abrirTarjeta(t) {
    const nueva = !t;
    const d = t || crearTarjeta({}, hoy());
    const campo = (k, etiqueta, tipo = 'text', extra = {}) =>
      h('label', { for: 'f-' + k }, etiqueta, h('input', { id: 'f-' + k, name: k, type: tipo, value: d[k] ?? '', ...extra }));
    const sel = (k, etiqueta, opciones) => h('label', { for: 'f-' + k }, etiqueta,
      h('select', { id: 'f-' + k, name: k }, opciones.map(([v, txt]) => h('option', { value: v, selected: d[k] === v }, txt))));

    const plantillas = h('div', { class: 'acciones' });
    const textoPlantilla = h('div', { class: 'plantilla', hidden: true });
    let mostrado = '';
    const btnCopiar = h('button', { type: 'button', hidden: true, onclick: async () => toast(await copiar(mostrado, textoPlantilla) ? 'Mensaje copiado.' : 'Seleccioné el texto: copialo a mano.') }, 'Copiar');
    const avisoEs = h('p', { class: 'aviso warn', hidden: d.pais !== 'ES' }, AVISO_ES);
    const confirmarBorrar = h('div', { class: 'acciones', hidden: true },
      h('span', {}, '¿Borrar esta tarjeta?'),
      h('button', { type: 'button', onclick: async () => {
        try { await store.delete(`tarjetas/${d.id}`); } catch (err) { return toast('No se pudo borrar: ' + (err?.message || err)); }
        dlg.close(); toast('Tarjeta borrada.');
      } }, 'Sí, borrar'),
      h('button', { type: 'button', onclick: () => { confirmarBorrar.hidden = true; } }, 'No'));

    const form = h('form', { method: 'dialog' },
      h('div', { class: 'cabeza' }, h('h2', {}, nueva ? 'Nueva tarjeta' : d.negocio),
        h('button', { type: 'button', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, '✕')),
      avisoEs,
      h('div', { class: 'campos' },
        campo('negocio', 'Negocio', 'text', { required: true }), campo('rubro', 'Rubro'),
        sel('pais', 'País', [['CO', 'Colombia'], ['ES', 'España']]), campo('ciudad', 'Ciudad'),
        campo('correo', 'Correo', 'email'), campo('telefono', 'Teléfono', 'tel'),
        campo('instagram', 'Instagram'), campo('web', 'Web'),
        campo('servicio', 'Servicio que le ofrecés'), campo('valor', 'Valor estimado', 'number', { min: 0, inputmode: 'numeric' }),
        campo('proximo', 'Próximo contacto', 'date'),
        sel('columna', 'Etapa', COLUMNAS.map((c) => [c.id, c.titulo])),
        campo('fuente', 'Fuente del dato')),
      h('label', { for: 'f-nota' }, 'Nota', h('textarea', { id: 'f-nota', name: 'nota', rows: 3 }, d.nota || '')),
      h('div', {}, h('h3', {}, 'Primer mensaje'), plantillas, textoPlantilla, btnCopiar),
      h('div', { class: 'acciones' },
        h('button', { class: 'primario', type: 'submit' }, 'Guardar'),
        nueva ? '' : h('button', { type: 'button', onclick: () => { dlg.close(); ctx.irAPropuesta?.(leer()); } }, 'Armar propuesta'),
        nueva ? '' : h('button', { type: 'button', onclick: () => { confirmarBorrar.hidden = false; } }, 'Borrar')),
      confirmarBorrar);

    const leer = () => {
      const f = new FormData(form), x = { ...d };
      for (const [k, v] of f.entries()) x[k] = String(v).trim();
      x.valor = x.valor === '' ? null : Number(x.valor);
      x.proximo = x.proximo || null;
      return x;
    };

    function pintarPlantillas() {
      const actual = leer();
      avisoEs.hidden = actual.pais !== 'ES';
      plantillas.replaceChildren(...['correo', 'instagram', 'whatsapp'].map((tipo) => {
        const texto = plantilla(tipo, actual, ctx.config());
        if (texto == null) return '';
        return h('button', { type: 'button', onclick: () => { mostrado = texto; textoPlantilla.textContent = texto; textoPlantilla.hidden = false; btnCopiar.hidden = false; } },
          { correo: 'Ver correo', instagram: 'Ver DM Instagram', whatsapp: 'Ver WhatsApp' }[tipo]);
      }));
    }
    form.addEventListener('input', pintarPlantillas);
    pintarPlantillas();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const x = leer();
      if (!x.negocio) return toast('Poné el nombre del negocio.');
      if (nueva) {
        const final = crearTarjeta({ ...x, id: undefined }, hoy());
        if (tarjetas.some((o) => o.id === final.id || esDuplicado(o, final))) return toast('Ese negocio ya está en el tablero.');
        try { await store.set(`tarjetas/${final.id}`, final); } catch (err) { return toast('No se pudo guardar: ' + (err?.message || err)); }
      } else {
        if (x.columna !== d.columna) x.actualizado = hoy();
        const cambios = Object.fromEntries(Object.entries(x).filter(([k, v]) => k !== 'id' && v !== d[k]));
        if (Object.keys(cambios).length) {
          try { await store.update(`tarjetas/${d.id}`, cambios); }
          catch { dlg.close(); return toast('Esa tarjeta ya no existe.'); }
        }
      }
      dlg.close(); toast('Guardado.');
    });

    const dlg = h('dialog', { onclose: () => dlg.remove() }, form);
    document.body.append(dlg); dlg.showModal();
  }

  // ---------- Pegar lista ----------
  function abrirPegar() {
    const area = h('textarea', { id: 'pegar-texto', rows: 8, placeholder: 'Muebles Sol | mueblería | CO | Villavicencio | @mueblessol | instagram.com/mueblessol' });
    const salida = h('p', { class: 'muted', 'aria-live': 'polite' });
    const boton = h('button', { class: 'primario', type: 'submit' }, 'Agregar al tablero');
    const form = h('form', {},
      h('div', { class: 'cabeza' }, h('h2', {}, 'Pegar lista'), h('button', { type: 'button', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, '✕')),
      h('p', { class: 'muted' }, 'Una línea por negocio: negocio | rubro | país (CO o ES) | ciudad | contacto | fuente'),
      h('label', { for: 'pegar-texto' }, 'Lista', area), salida, h('div', { class: 'acciones' }, boton));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      boton.disabled = true;
      const r = await agregarVarias(parsearLista(area.value, hoy()).tarjetas);
      const { errores } = parsearLista(area.value, hoy());
      salida.textContent = `Agregados: ${r.agregadas}. Repetidos: ${r.repetidas}. Con error: ${errores.length}` +
        (errores.length ? ` (líneas ${errores.map((x) => x.linea).join(', ')})` : '') + '.';
      boton.disabled = false;
      if (!errores.length && r.agregadas) area.value = '';
    });
    const dlg = h('dialog', { onclose: () => dlg.remove() }, form);
    document.body.append(dlg); dlg.showModal();
  }

  async function agregarVarias(nuevas) {
    let agregadas = 0, repetidas = 0;
    const vistas = [...tarjetas];
    for (const t of nuevas) {
      if (vistas.some((o) => o.id === t.id || esDuplicado(o, t))) { repetidas++; continue; }
      try { await store.set(`tarjetas/${t.id}`, t); vistas.push(t); agregadas++; }
      catch (e) { toast('Se cortó la carga: ' + (e?.message || e)); break; }
    }
    return { agregadas, repetidas };
  }

  // ---------- Exportar / importar ----------
  async function exportar() {
    const json = JSON.stringify(tarjetas, null, 2);
    const dl = await ctx.usar('downloads');
    if (dl) {
      try { await dl.save({ filename: `tablero-clientes-${hoy()}.json`, data: json }); return; }
      catch (e) { if (e?.code === 'declined' || e?.code === 'cancelled') return; }
    }
    const area = h('textarea', { id: 'export-texto', rows: 12, readonly: true }, json);
    const dlg = h('dialog', { onclose: () => dlg.remove() }, h('form', { method: 'dialog' },
      h('div', { class: 'cabeza' }, h('h2', {}, 'Copiá este JSON'), h('button', { 'aria-label': 'Cerrar' }, '✕')),
      h('p', { class: 'muted' }, 'No se pudo bajar el archivo. Copiá el texto y guardalo en un archivo .json.'),
      h('label', { for: 'export-texto' }, 'Tablero en JSON', area),
      h('div', { class: 'acciones' }, h('button', { type: 'button', class: 'primario', onclick: async () => toast(await copiar(json, area) ? 'Copiado.' : 'Seleccioná y copiá a mano.') }, 'Copiar'))));
    document.body.append(dlg); dlg.showModal(); area.select();
  }

  async function importar(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    let datos;
    try { datos = JSON.parse(await archivo.text()); } catch { return toast('El archivo no es un JSON válido.'); }
    if (!Array.isArray(datos)) return toast('El JSON tiene que ser una lista de tarjetas (lo que baja "Exportar JSON").');
    const validas = datos.filter((x) => x && typeof x.negocio === 'string' && x.negocio.trim())
      .map((x) => crearTarjeta({ ...x, id: undefined, columna: COLUMNAS.some((c) => c.id === x.columna) ? x.columna : 'prospecto', pais: x.pais === 'ES' ? 'ES' : 'CO' }, hoy()));
    const r = await agregarVarias(validas);
    toast(`Importados: ${r.agregadas}. Repetidos: ${r.repetidas}. Inválidos: ${datos.length - validas.length}.`);
  }

  return { agregarVarias, destruir: () => sortables.forEach((s) => s.destroy()) };
}
