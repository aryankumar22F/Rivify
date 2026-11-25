export type UnitCategoryId =
  | 'length'
  | 'area'
  | 'volume'
  | 'mass'
  | 'time'
  | 'temperature'
  | 'speed'
  | 'acceleration'
  | 'pressure'
  | 'energy'
  | 'scientific';

export interface UnitDefinition {
  id: string;
  name: string;
  symbol: string;
  // Factor to SI base unit (used for linear units)
  factor?: number;
}

export interface UnitCategory {
  id: UnitCategoryId;
  label: string;
  baseSymbol: string;
  units: UnitDefinition[];
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: 'length',
    label: 'Length',
    baseSymbol: 'm',
    units: [
      { id: 'm', name: 'Meter', symbol: 'm', factor: 1 },
      { id: 'km', name: 'Kilometer', symbol: 'km', factor: 1000 },
      { id: 'cm', name: 'Centimeter', symbol: 'cm', factor: 0.01 },
      { id: 'mm', name: 'Millimeter', symbol: 'mm', factor: 0.001 },
      { id: 'um', name: 'Micrometer', symbol: 'μm', factor: 1e-6 },
      { id: 'nm', name: 'Nanometer', symbol: 'nm', factor: 1e-9 },
      { id: 'mi', name: 'Mile', symbol: 'mi', factor: 1609.344 },
      { id: 'yd', name: 'Yard', symbol: 'yd', factor: 0.9144 },
      { id: 'ft', name: 'Foot', symbol: 'ft', factor: 0.3048 },
      { id: 'in', name: 'Inch', symbol: 'in', factor: 0.0254 },
      { id: 'nmi', name: 'Nautical Mile', symbol: 'nmi', factor: 1852 },
      { id: 'au', name: 'Astronomical Unit', symbol: 'AU', factor: 1.495978707e11 },
    ],
  },
  {
    id: 'area',
    label: 'Area',
    baseSymbol: 'm²',
    units: [
      { id: 'm2', name: 'Square Meter', symbol: 'm²', factor: 1 },
      { id: 'km2', name: 'Square Kilometer', symbol: 'km²', factor: 1e6 },
      { id: 'cm2', name: 'Square Centimeter', symbol: 'cm²', factor: 1e-4 },
      { id: 'mm2', name: 'Square Millimeter', symbol: 'mm²', factor: 1e-6 },
      { id: 'ha', name: 'Hectare', symbol: 'ha', factor: 1e4 },
      { id: 'acre', name: 'Acre', symbol: 'ac', factor: 4046.8564224 },
      { id: 'ft2', name: 'Square Foot', symbol: 'ft²', factor: 0.09290304 },
      { id: 'in2', name: 'Square Inch', symbol: 'in²', factor: 0.00064516 },
    ],
  },
  {
    id: 'volume',
    label: 'Volume',
    baseSymbol: 'm³',
    units: [
      { id: 'm3', name: 'Cubic Meter', symbol: 'm³', factor: 1 },
      { id: 'L', name: 'Liter', symbol: 'L', factor: 0.001 },
      { id: 'mL', name: 'Milliliter', symbol: 'mL', factor: 1e-6 },
      { id: 'cm3', name: 'Cubic Centimeter', symbol: 'cm³', factor: 1e-6 },
      { id: 'gal', name: 'US Gallon', symbol: 'gal', factor: 0.003785411784 },
      { id: 'qt', name: 'US Quart', symbol: 'qt', factor: 0.000946352946 },
      { id: 'ft3', name: 'Cubic Foot', symbol: 'ft³', factor: 0.028316846592 },
      { id: 'in3', name: 'Cubic Inch', symbol: 'in³', factor: 1.6387064e-5 },
    ],
  },
  {
    id: 'mass',
    label: 'Mass',
    baseSymbol: 'kg',
    units: [
      { id: 'kg', name: 'Kilogram', symbol: 'kg', factor: 1 },
      { id: 'g', name: 'Gram', symbol: 'g', factor: 0.001 },
      { id: 'mg', name: 'Milligram', symbol: 'mg', factor: 1e-6 },
      { id: 'ug', name: 'Microgram', symbol: 'μg', factor: 1e-9 },
      { id: 't', name: 'Metric Tonne', symbol: 't', factor: 1000 },
      { id: 'lb', name: 'Pound', symbol: 'lb', factor: 0.45359237 },
      { id: 'oz', name: 'Ounce', symbol: 'oz', factor: 0.028349523125 },
      { id: 'amu', name: 'Atomic Mass Unit', symbol: 'u', factor: 1.6605390666e-27 },
    ],
  },
  {
    id: 'time',
    label: 'Time',
    baseSymbol: 's',
    units: [
      { id: 's', name: 'Second', symbol: 's', factor: 1 },
      { id: 'ms', name: 'Millisecond', symbol: 'ms', factor: 1e-3 },
      { id: 'us', name: 'Microsecond', symbol: 'μs', factor: 1e-6 },
      { id: 'ns', name: 'Nanosecond', symbol: 'ns', factor: 1e-9 },
      { id: 'min', name: 'Minute', symbol: 'min', factor: 60 },
      { id: 'h', name: 'Hour', symbol: 'h', factor: 3600 },
      { id: 'day', name: 'Day', symbol: 'd', factor: 86400 },
      { id: 'wk', name: 'Week', symbol: 'wk', factor: 604800 },
      { id: 'yr', name: 'Julian Year', symbol: 'yr', factor: 31557600 },
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    baseSymbol: 'K',
    units: [
      { id: 'C', name: 'Celsius', symbol: '°C' },
      { id: 'K', name: 'Kelvin', symbol: 'K' },
      { id: 'F', name: 'Fahrenheit', symbol: '°F' },
      { id: 'R', name: 'Rankine', symbol: '°R' },
    ],
  },
  {
    id: 'speed',
    label: 'Speed',
    baseSymbol: 'm/s',
    units: [
      { id: 'ms_vel', name: 'Meter per Second', symbol: 'm/s', factor: 1 },
      { id: 'kmh', name: 'Kilometer per Hour', symbol: 'km/h', factor: 1 / 3.6 },
      { id: 'mph', name: 'Mile per Hour', symbol: 'mph', factor: 0.44704 },
      { id: 'kn', name: 'Knot', symbol: 'kn', factor: 0.5144444444 },
      { id: 'fts', name: 'Foot per Second', symbol: 'ft/s', factor: 0.3048 },
      { id: 'mach', name: 'Mach (ISA Sea Level)', symbol: 'Ma', factor: 340.29 },
      { id: 'c_light', name: 'Speed of Light', symbol: 'c', factor: 299792458 },
    ],
  },
  {
    id: 'acceleration',
    label: 'Acceleration',
    baseSymbol: 'm/s²',
    units: [
      { id: 'ms2', name: 'Meter per Sec²', symbol: 'm/s²', factor: 1 },
      { id: 'cms2', name: 'Gal (cm/s²)', symbol: 'cm/s²', factor: 0.01 },
      { id: 'fts2', name: 'Foot per Sec²', symbol: 'ft/s²', factor: 0.3048 },
      { id: 'g0', name: 'Standard Gravity', symbol: 'g₀', factor: 9.80665 },
    ],
  },
  {
    id: 'pressure',
    label: 'Pressure',
    baseSymbol: 'Pa',
    units: [
      { id: 'Pa', name: 'Pascal', symbol: 'Pa', factor: 1 },
      { id: 'kPa', name: 'Kilopascal', symbol: 'kPa', factor: 1e3 },
      { id: 'MPa', name: 'Megapascal', symbol: 'MPa', factor: 1e6 },
      { id: 'bar', name: 'Bar', symbol: 'bar', factor: 1e5 },
      { id: 'atm', name: 'Standard Atmosphere', symbol: 'atm', factor: 101325 },
      { id: 'psi', name: 'PSI (lbf/in²)', symbol: 'psi', factor: 6894.757293168 },
      { id: 'torr', name: 'Torr / mmHg', symbol: 'Torr', factor: 133.322368421 },
    ],
  },
  {
    id: 'energy',
    label: 'Energy',
    baseSymbol: 'J',
    units: [
      { id: 'J', name: 'Joule', symbol: 'J', factor: 1 },
      { id: 'kJ', name: 'Kilojoule', symbol: 'kJ', factor: 1e3 },
      { id: 'MJ', name: 'Megajoule', symbol: 'MJ', factor: 1e6 },
      { id: 'cal', name: 'Calorie (thermochem)', symbol: 'cal', factor: 4.184 },
      { id: 'kcal', name: 'Kilocalorie', symbol: 'kcal', factor: 4184 },
      { id: 'Wh', name: 'Watt-hour', symbol: 'Wh', factor: 3600 },
      { id: 'kWh', name: 'Kilowatt-hour', symbol: 'kWh', factor: 3.6e6 },
      { id: 'eV', name: 'Electronvolt', symbol: 'eV', factor: 1.602176634e-19 },
      { id: 'BTU', name: 'BTU (IT)', symbol: 'BTU', factor: 1055.05585262 },
      { id: 'erg', name: 'Erg', symbol: 'erg', factor: 1e-7 },
    ],
  },
  {
    id: 'scientific',
    label: 'Scientific (Force / Frequency / Angle)',
    baseSymbol: 'N',
    units: [
      { id: 'N', name: 'Newton (Force)', symbol: 'N', factor: 1 },
      { id: 'kN', name: 'Kilonewton (Force)', symbol: 'kN', factor: 1e3 },
      { id: 'dyn', name: 'Dyne (Force)', symbol: 'dyn', factor: 1e-5 },
      { id: 'lbf', name: 'Pound-force (Force)', symbol: 'lbf', factor: 4.4482216152605 },
    ],
  },
];

function toKelvin(val: number, unitId: string): number {
  switch (unitId) {
    case 'K':
      return val;
    case 'C':
      return val + 273.15;
    case 'F':
      return ((val - 32) * 5) / 9 + 273.15;
    case 'R':
      return (val * 5) / 9;
    default:
      throw new Error(`Unknown temperature unit "${unitId}".`);
  }
}

function fromKelvin(kelvin: number, unitId: string): number {
  switch (unitId) {
    case 'K':
      return kelvin;
    case 'C':
      return kelvin - 273.15;
    case 'F':
      return ((kelvin - 273.15) * 9) / 5 + 32;
    case 'R':
      return (kelvin * 9) / 5;
    default:
      throw new Error(`Unknown temperature unit "${unitId}".`);
  }
}

export interface UnitConversionResult {
  value: number;
  formulaText: string;
  allUnits: { id: string; name: string; symbol: string; value: number }[];
}

export function convertUnits(
  categoryId: UnitCategoryId,
  value: number,
  fromUnitId: string,
  toUnitId: string
): UnitConversionResult {
  if (!Number.isFinite(value)) {
    throw new Error('Enter a finite numeric value to convert.');
  }
  const cat = UNIT_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) throw new Error(`Unknown unit category "${categoryId}".`);

  if (categoryId === 'temperature') {
    const k = toKelvin(value, fromUnitId);
    const out = fromKelvin(k, toUnitId);
    const allUnits = cat.units.map((u) => ({
      id: u.id,
      name: u.name,
      symbol: u.symbol,
      value: fromKelvin(k, u.id),
    }));
    return {
      value: out,
      formulaText: `Converted via Kelvin base: T(K) = ${k.toFixed(4)} K`,
      allUnits,
    };
  }

  const fromUnit = cat.units.find((u) => u.id === fromUnitId);
  const toUnit = cat.units.find((u) => u.id === toUnitId);
  if (!fromUnit?.factor || !toUnit?.factor) {
    throw new Error('Invalid source or target unit.');
  }
  const siValue = value * fromUnit.factor;
  const converted = siValue / toUnit.factor;
  const ratio = fromUnit.factor / toUnit.factor;
  const formulaText = `1 ${fromUnit.symbol} = ${
    Math.abs(ratio) >= 1e-4 && Math.abs(ratio) < 1e6 ? Number(ratio.toPrecision(7)) : ratio.toExponential(4)
  } ${toUnit.symbol}`;

  const allUnits = cat.units.map((u) => ({
    id: u.id,
    name: u.name,
    symbol: u.symbol,
    value: siValue / (u.factor ?? 1),
  }));

  return {
    value: converted,
    formulaText,
    allUnits,
  };
}

export function formatUnitNumber(n: number, sigFigs = 6): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e-4 && abs < 1e7) {
    return Number(n.toPrecision(sigFigs)).toString();
  }
  return n.toExponential(4);
}
