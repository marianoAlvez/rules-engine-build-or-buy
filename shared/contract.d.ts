export type Slot = 'original' | 'nuevo';
export type Command =
  'accept' | 'confirm' | 'correct' | 'migrate' | 'accept-new' | 'confirm-new';
export interface OrderView {
  quote: { price: number; version: string; rule: string };
  charged: number | null;
  shadow: {
    candidate: string;
    decision: { price: number; rule: string; evaluatedAt: string };
  } | null;
}
export interface Report {
  id: string;
  active: string;
  candidate: string;
  gate: 'unchecked' | 'blocked' | 'active';
  orders: Partial<Record<Slot, OrderView>>;
  cases: {
    name: string;
    expected: number;
    actual: number;
    expectedRule: string;
    actualRule: string;
    passed: boolean;
  }[];
  matrix: { id: string; title: string; basisPoints: number; when: string }[];
  candidateClock: 'acceptedAt' | 'confirmedAt';
  events: { seq: number; kind: string; detail: string }[];
}
