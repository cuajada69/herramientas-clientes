// Helpers de DOM compartidos por las vistas.

export const $ = (sel, root = document) => root.querySelector(sel);

export function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

// El clipboard puede rechazarse dentro del frame: entonces seleccionamos el texto para copiar a mano.
export async function copiar(texto, nodoTexto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch {
    if (nodoTexto) {
      const r = document.createRange(); r.selectNodeContents(nodoTexto);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    return false;
  }
}

export function toast(msg) {
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}

export const zonaLocal = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
