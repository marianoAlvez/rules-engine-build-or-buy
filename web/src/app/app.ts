import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Session } from './session';
import { CostModel } from './cost-model';
import type { Command } from '../../../shared/contract';

const format = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
@Component({ selector: 'app-root', imports: [CostModel], templateUrl: './app.html' })
export class App implements OnInit {
  readonly session = inject(Session);
  readonly report = this.session.report;
  readonly tab = signal('Pedido');
  readonly tabs = ['Pedido', 'Matriz y pruebas', 'Eventos', 'Costos'];
  readonly original = computed(() => this.report()?.orders.original);
  readonly second = computed(() => this.report()?.orders.nuevo);
  readonly primary = computed<{ command: Command; label: string; hint: string } | null>(() => {
    const r = this.report();
    if (!r) return null;
    if (!this.original())
      return {
        command: 'accept',
        label: 'Aceptar pedido',
        hint: '23:55 · El cupón todavía está vigente.',
      };
    if (this.original()?.charged == null)
      return {
        command: 'confirm',
        label: 'Confirmar a las 00:05',
        hint: 'Al confirmar, el cupón ya habrá vencido. El precio quedó pactado al aceptar.',
      };
    if (r.gate === 'blocked')
      return {
        command: 'correct',
        label: 'Corregir la matriz',
        hint: 'Cambiá la referencia del candidato a la hora de aceptación.',
      };
    if (r.gate !== 'active')
      return {
        command: 'migrate',
        label: r.candidate === 'candidato/2' ? 'Validar y activar' : 'Intentar migración',
        hint: 'La API verifica los importes y las reglas antes de habilitar pedidos nuevos.',
      };
    if (!this.second())
      return {
        command: 'accept-new',
        label: 'Aceptar otro pedido',
        hint: 'El siguiente pedido llega después del vencimiento.',
      };
    if (this.second()?.charged == null)
      return {
        command: 'confirm-new',
        label: 'Confirmar segundo pedido',
        hint: 'Comprobá el precio del primer pedido junto al del nuevo.',
      };
    return null;
  });
  readonly matchCount = computed(() => this.report()?.cases.filter((c) => c.passed).length ?? 0);
  ngOnInit() {
    void this.session.open();
  }
  money(cents: number | null | undefined) {
    return cents == null ? '—' : '$' + format.format(cents / 100);
  }
  changeTab(tab: string) {
    this.tab.set(tab);
  }
  reset() {
    this.tab.set('Pedido');
    void this.session.open(true);
  }
}
