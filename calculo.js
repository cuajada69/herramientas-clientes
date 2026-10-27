export function calcularTarifa(e) {
  if (e.impuestosPct >= 100) throw new Error('Los impuestos deben ser menores a 100 %');
  if (e.horasSemana <= 0) throw new Error('Las horas por semana deben ser mayores que 0');
  if (e.facturablePct <= 0) throw new Error('El porcentaje facturable debe ser mayor que 0');
  if (e.vacacionesSemanas >= 52) throw new Error('Las semanas de vacaciones deben ser menos de 52');
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
