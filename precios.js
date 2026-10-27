export const PRECIOS = {
  CO: { presencia: 450000, tiendaWhatsapp: 950000, tiendaPagos: 1800000, catalogo: 150000, mantenimiento: 100000, cambioExtra: 30000,
    plazos: { presencia: 5, tiendaWhatsapp: 10, tiendaPagos: 15 } },
  ES: { presencia: 290, tiendaWhatsapp: 590, tiendaPagos: 990, catalogo: 90, mantenimiento: 35, cambioExtra: 20,
    plazos: { presencia: 5, tiendaWhatsapp: 10, tiendaPagos: 15 } },
};
export const MONEDA = { CO: 'COP', ES: 'EUR' };

const fmt = {
  COP: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }),
  EUR: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }),
};
export const formatearMoneda = (monto, moneda) => fmt[moneda].format(monto);

export function convertir(monto, de, a, tasaEurCop) {
  if (!(tasaEurCop > 0)) throw new Error('La tasa EUR/COP debe ser mayor que 0');
  if (de === a) return monto;
  return de === 'EUR' ? monto * tasaEurCop : monto / tasaEurCop;
}

// El spec fija estos valores; los textos y calcularTotal los leen de aquí.
export const ANTICIPO_PCT = 50;
export const RONDAS_CAMBIOS = 2;
