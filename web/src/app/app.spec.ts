import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { vi } from 'vitest';

describe('Inicio de la demo', () => {
  it('ofrece recuperación cuando la API no puede abrir la sesión', async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/runs').flush({}, { status: 503, statusText: 'Unavailable' });
    await vi.waitFor(() => expect(fixture.componentInstance.session.error()).toContain('API'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'Volver a consultar',
    );
    http.verify();
  });
});
