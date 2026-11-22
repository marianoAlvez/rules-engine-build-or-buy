import { Component, computed, input, linkedSignal } from '@angular/core';

const defaults = { volume: '100', rate: '2', exit: '3000', initial: '13000', guard: '200' };
type CostKey = keyof typeof defaults;
const dollars = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const limit = 1_000_000;

@Component({
  selector: 'app-cost-model',
  templateUrl: './cost-model.html',
  styleUrl: './cost-model.css',
})
export class CostModel {
  readonly runId = input.required<string>();
  readonly inputs = [
    { key: 'volume', label: 'Volumen mensual', unit: 'Miles de decisiones' },
    { key: 'rate', label: 'Tarifa del proveedor', unit: 'USD por mil decisiones' },
    { key: 'exit', label: 'Ensayo de salida', unit: 'USD · pago único' },
    { key: 'initial', label: 'Construcción inicial', unit: 'USD · pago único' },
    { key: 'guard', label: 'Guardia operativa', unit: 'USD por mes' },
  ] as const;
  readonly values = linkedSignal({ source: this.runId, computation: () => ({ ...defaults }) });
  readonly totals = computed(() => {
    const v = this.values();
    if (this.inputs.some(({ key }) => this.invalid(v[key]))) return null;
    return {
      buy: dollars.format(Number(v.rate) * Number(v.volume) * 36 + Number(v.exit)),
      build: dollars.format(Number(v.initial) + 36 * Number(v.guard)),
    };
  });

  invalid(raw: string) {
    const n = Number(raw);
    return raw === '' || !Number.isFinite(n) || n < 0 || n > limit;
  }
  update(key: CostKey, event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    this.values.update((v) => ({ ...v, [key]: raw }));
  }
}
