import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Command, Report } from '../../../shared/contract';

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly http = inject(HttpClient);
  private readonly key = 'precio-pactado.session';
  readonly report = signal<Report | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  async open(fresh = false) {
    await this.request(async () => {
      const id = fresh ? null : sessionStorage.getItem(this.key);
      if (id) {
        try {
          return await firstValueFrom(this.http.get<Report>('/api/runs/' + id));
        } catch (e) {
          if (!(e instanceof HttpErrorResponse) || e.status !== 404) throw e;
        }
      }
      return firstValueFrom(this.http.post<Report>('/api/runs', {}));
    });
  }
  async act(action: Command) {
    const previous = this.report();
    if (!previous) return;
    await this.request(async () => {
      const next = await firstValueFrom(
        this.http.post<Report>('/api/runs/' + previous.id + '/' + action, {}),
      );
      if (action === 'confirm' && previous.orders.original?.charged != null)
        this.notice.set('Reintento verificado. Se conserva un único cobro de $90.');
      else this.notice.set(next.events.at(-1)?.detail ?? '');
      return next;
    });
  }
  private async request(work: () => Promise<Report>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      const next = await work();
      this.report.set(next);
      sessionStorage.setItem(this.key, next.id);
    } catch (e) {
      this.error.set(
        e instanceof HttpErrorResponse && typeof e.error?.message === 'string'
          ? e.error.message
          : 'No pudimos consultar la API. Volvé a intentar.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
