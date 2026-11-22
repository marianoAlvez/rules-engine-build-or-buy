// All monetary values are integer centavos. Midnight belongs to the next day.
export const deadline = '2026-11-23T03:00:00.000Z';
export const before = '2026-11-23T02:55:00.000Z';
export const after = '2026-11-23T03:05:00.000Z';
export const versions = ['tienda/1', 'candidato/1', 'candidato/2'] as const;
export type Version = (typeof versions)[number];
export type Candidate = Exclude<Version, 'tienda/1'>;
export interface Facts {
  base: number;
  coupon: boolean;
  acceptedAt: string;
  confirmedAt: string;
}
interface Row {
  id: string;
  title: string;
  when: 'coupon-before-expiry' | 'otherwise';
  basisPoints: number;
}
// The first matching row wins. Historical versions must never be overwritten.
const table: readonly Row[] = [
  {
    id: 'PROMO10',
    title: 'Cupón vigente',
    when: 'coupon-before-expiry',
    basisPoints: 1000,
  },
  { id: 'BASE', title: 'Precio de lista', when: 'otherwise', basisPoints: 0 },
];
export const matrices = {
  'tienda/1': { clock: 'acceptedAt', rows: table },
  'candidato/1': { clock: 'confirmedAt', rows: table },
  'candidato/2': { clock: 'acceptedAt', rows: table },
} as const;
export function evaluate(version: Version, facts: Facts) {
  const matrix = matrices[version];
  const evaluatedAt = facts[matrix.clock];
  const row = matrix.rows.find(
    (row) =>
      row.when === 'otherwise' ||
      (facts.coupon && Date.parse(evaluatedAt) < Date.parse(deadline)),
  );
  if (!row) throw new Error('La matriz debe incluir una regla por defecto');
  const price = Math.floor(
    (facts.base * (10_000 - row.basisPoints) + 5000) / 10_000,
  );
  return { price, rule: row.id, version, evaluatedAt };
}
export type Decision = ReturnType<typeof evaluate>;
export interface Example {
  name: string;
  facts: Facts;
  expected: number;
  expectedRule: string;
}
const crossing: Facts = {
  base: 10000,
  coupon: true,
  acceptedAt: before,
  confirmedAt: after,
};
// Product fixtures are independent of all implementations. Never generate expected values with evaluate().
export const examples: readonly Example[] = [
  {
    name: 'El pedido cruza medianoche',
    facts: crossing,
    expected: 9000,
    expectedRule: 'PROMO10',
  },
  {
    name: 'Aceptado después del vencimiento',
    facts: { ...crossing, acceptedAt: after },
    expected: 10000,
    expectedRule: 'BASE',
  },
  {
    name: 'Exactamente a medianoche',
    facts: { ...crossing, acceptedAt: deadline },
    expected: 10000,
    expectedRule: 'BASE',
  },
  {
    name: 'Pedido sin cupón',
    facts: { ...crossing, coupon: false },
    expected: 10000,
    expectedRule: 'BASE',
  },
  {
    name: 'Redondeo a centavos',
    facts: { ...crossing, base: 10005, confirmedAt: before },
    expected: 9005,
    expectedRule: 'PROMO10',
  },
];
export function certify(version: Version) {
  return examples.map((example) => {
    const actual = evaluate(version, example.facts);
    return {
      name: example.name,
      expected: example.expected,
      actual: actual.price,
      expectedRule: example.expectedRule,
      actualRule: actual.rule,
      passed:
        actual.price === example.expected &&
        actual.rule === example.expectedRule,
    };
  });
}
