import {
  after,
  before,
  certify,
  evaluate,
  type Candidate,
  type Decision,
  type Facts,
  type Version,
} from './pricing';

export type Slot = 'original' | 'nuevo';
export interface Accepted {
  slot: Slot;
  facts: Omit<Facts, 'confirmedAt'>;
  quote: Decision;
}
export interface Shadow {
  slot: Slot;
  candidate: Candidate;
  decision: Decision;
}
type Data = {
  RunStarted: Record<string, never>;
  OrderAccepted: Accepted;
  OrderConfirmed: { slot: Slot; charged: number; confirmedAt: string };
  ShadowEvaluated: Shadow;
  CandidateCorrected: { candidate: Candidate };
  MigrationBlocked: { candidate: Candidate; failures: string[] };
  MigrationActivated: { candidate: Candidate };
};
export type Event = {
  [K in keyof Data]: { kind: K; data: Data[K] };
}[keyof Data];
export type Entry = Event & { seq: number };
export const commands = [
  'accept',
  'confirm',
  'migrate',
  'correct',
  'accept-new',
  'confirm-new',
] as const;
export type Command = (typeof commands)[number];
export interface Order extends Accepted {
  charged: number | null;
  confirmedAt: string | null;
  shadow: Shadow | null;
}
export function restore(events: readonly Entry[]) {
  const orders: Partial<Record<Slot, Order>> = {};
  let active: Version = 'tienda/1';
  let candidate: Candidate = 'candidato/1';
  let gate: 'unchecked' | 'blocked' | 'active' = 'unchecked';
  for (const event of events) {
    switch (event.kind) {
      case 'OrderAccepted':
        orders[event.data.slot] = {
          ...event.data,
          charged: null,
          confirmedAt: null,
          shadow: null,
        };
        break;
      case 'OrderConfirmed':
        Object.assign(orders[event.data.slot]!, {
          charged: event.data.charged,
          confirmedAt: event.data.confirmedAt,
        });
        break;
      case 'ShadowEvaluated':
        orders[event.data.slot]!.shadow = event.data;
        break;
      case 'CandidateCorrected':
        candidate = event.data.candidate;
        gate = 'unchecked';
        break;
      case 'MigrationBlocked':
        gate = 'blocked';
        break;
      case 'MigrationActivated':
        active = event.data.candidate;
        gate = 'active';
        break;
    }
  }
  return { orders, active, candidate, gate };
}
export class InvalidTransition extends Error {}
export function decide(events: Entry[], command: Command): Event[] {
  const state = restore(events);
  const slot: Slot = command.endsWith('-new') ? 'nuevo' : 'original';
  const order = state.orders[slot];
  if (command === 'accept' || command === 'accept-new') {
    if (order) return [];
    if (slot === 'nuevo' && state.gate !== 'active')
      throw new InvalidTransition('Primero activá el motor corregido.');
    const facts = {
      base: 10000,
      coupon: true,
      acceptedAt: slot === 'original' ? before : after,
    };
    // At acceptance only the current instant is known. The snapshot is the contract.
    const quote = evaluate(state.active, {
      ...facts,
      confirmedAt: facts.acceptedAt,
    });
    return [{ kind: 'OrderAccepted', data: { slot, facts, quote } }];
  }
  if (command === 'confirm' || command === 'confirm-new') {
    if (!order) throw new InvalidTransition('Primero aceptá el pedido.');
    if (order.charged !== null) return [];
    return [
      {
        kind: 'OrderConfirmed',
        data: { slot, charged: order.quote.price, confirmedAt: after },
      },
    ];
  }
  if (state.gate === 'active') return [];
  const original = state.orders.original;
  if (!original || original.charged === null)
    throw new InvalidTransition('Primero confirmá el pedido de las 23:55.');
  if (command === 'correct') {
    if (state.candidate === 'candidato/2') return [];
    if (state.gate !== 'blocked')
      throw new InvalidTransition(
        'Probá primero la migración con la regla original.',
      );
    return [{ kind: 'CandidateCorrected', data: { candidate: 'candidato/2' } }];
  }
  if (state.gate === 'blocked') return [];
  if (original.shadow?.candidate !== state.candidate)
    throw new InvalidTransition('La evaluación en sombra está pendiente.');
  const failures = certify(state.candidate)
    .filter((c) => !c.passed)
    .map((c) => c.name);
  if (
    original.shadow.decision.price !== original.quote.price ||
    original.shadow.decision.rule !== original.quote.rule
  )
    failures.push('Precio o regla del pedido aceptado');
  return failures.length
    ? [
        {
          kind: 'MigrationBlocked',
          data: { candidate: state.candidate, failures },
        },
      ]
    : [{ kind: 'MigrationActivated', data: { candidate: state.candidate } }];
}

// The subscriber produces observations only. It cannot create OrderConfirmed.
export function react(prefix: Entry[], event: Entry): Event[] {
  if (event.kind !== 'OrderConfirmed' && event.kind !== 'CandidateCorrected')
    return [];
  const state = restore(prefix);
  const orders =
    event.kind === 'OrderConfirmed'
      ? [state.orders[event.data.slot]!]
      : Object.values(state.orders);
  return orders
    .filter((order) => order.confirmedAt !== null)
    .map((order) => ({
      kind: 'ShadowEvaluated',
      data: {
        slot: order.slot,
        candidate: state.candidate,
        decision: evaluate(state.candidate, {
          ...order.facts,
          confirmedAt: order.confirmedAt!,
        }),
      },
    }));
}
