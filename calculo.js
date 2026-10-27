export function calcularTarifa(e) {
  const campos = { fijos: 'Los gastos fijos', personales: 'Los gastos personales', gananciaPct: 'El porcentaje de ganancia', horasSemana: 'Las horas por semana',
    facturablePct: 'El porcentaje facturable', vacacionesSemanas: 'Las semanas de vacaciones', impuestosPct: 'El porcentaje de impuestos' };
  for (const [k, nombre] of Object.entries(campos)) if (!Number.isFinite(e?.[k])) throw new Error(`${nombre} (${k}) debe ser un número`);
  if (e.fijos < 0 || e.personales < 0) throw new Error('Los gastos no pueden ser negativos');
  if (e.gananciaPct <= -100) throw new Error('El porcentaje de ganancia debe ser mayor que -100');
  if (e.horasSemana <= 0 || e.horasSemana > 168) throw new Error('Las horas por semana deben estar entre 1 y 168');
  if (e.facturablePct <= 0 || e.facturablePct > 100) throw new Error('El porcentaje facturable debe estar entre 1 y 100');
  if (e.vacacionesSemanas < 0 || e.vacacionesSemanas >= 52) throw new Error('Las semanas de vacaciones deben estar entre 0 y 51');
  if (e.impuestosPct < 0 || e.impuestosPct >= 100) throw new Error('Los impuestos deben ser menores a 100 %');
  const costoAnual = (e.fijos + e.personales) * 12;
  const conGanancia = costoAnual * (1 + e.gananciaPct / 100);
  const bruto = conGanancia / (1 - e.impuestosPct / 100);
  const horasFacturablesAnio = e.horasSemana * (52 - e.vacacionesSemanas) * e.facturablePct / 100;
  const hora = bruto / horasFacturablesAnio, dia = hora * 8, mensual = bruto / 12;
  const pasos = [
    { texto: 'Costo anual (fijos + personales) x 12', valor: costoAnual },
    { texto: 'Con ganancia', valor: conGanancia },
    { texto: 'Bruto con impuestos', valor: bruto },
    { texto: 'Horas facturables al año', valor: horasFacturablesAnio },
    { texto: 'Valor por hora', valor: hora },
    { texto: 'Valor por día (8 h)', valor: dia },
    { texto: 'Ingreso mensual necesario', valor: mensual },
  ];
  return { hora, dia, mensual, horasFacturablesAnio, pasos };
}

export const precioProyecto = (horas, hora, imprevistosPct) => Math.round(horas * hora * (1 + imprevistosPct / 100));

export function paqueteCercano(monto, precios) {
  const [clave, precio] = ['presencia', 'tiendaWhatsapp', 'tiendaPagos', 'catalogo']
    .map((k) => [k, precios[k]]).reduce((a, b) => (Math.abs(b[1] - monto) < Math.abs(a[1] - monto) ? b : a));
  return { clave, precio };
}
