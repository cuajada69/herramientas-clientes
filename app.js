import { abrirDb, usar } from './db.js';
import { hoyLocal } from './tablero.js';
import { iniciarTablero } from './ui-tablero.js';
import { iniciarConfig, completarConfig } from './ui-config.js';
import { iniciarCalculadora } from './ui-calculadora.js';
import { iniciarPropuesta } from './ui-propuesta.js';
import { $, zonaLocal, toast } from './util.js';

const VISTAS = ['tablero', 'calculadora', 'propuesta', 'config'];

function mostrar(nombre) {
  const v = VISTAS.includes(nombre) ? nombre : 'tablero';
  for (const n of VISTAS) $('#v-' + n).hidden = n !== v;
  document.querySelectorAll('nav.tabs a').forEach((a) => {
    if (a.hash === '#' + v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

async function iniciar() {
  const ruta = () => mostrar(location.hash.slice(1));
  addEventListener('hashchange', ruta); ruta();

  const store = await abrirDb();
  const hoy = () => hoyLocal(new Date(), zonaLocal());
  let config = completarConfig(await store.get('config/general').catch(() => null));
  const ctx = { store, hoy, usar, config: () => config };

  let calc;
  const propuesta = iniciarPropuesta($('#v-propuesta'), ctx);
  iniciarTablero($('#v-tablero'), { ...ctx, irAPropuesta: (t) => { propuesta.cargarTarjeta(t); location.hash = 'propuesta'; } });
  iniciarConfig($('#v-config'), { store, config, alGuardar: (c) => { config = completarConfig(c); propuesta.refrescar(); calc?.refrescar(); } });
  calc = await iniciarCalculadora($('#v-calculadora'), ctx);
}

iniciar().catch((e) => { console.error(e); toast('Algo falló al abrir la página: ' + (e?.message || e)); });
