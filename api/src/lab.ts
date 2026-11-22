import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Param,
  Post,
} from '@nestjs/common';
import { resolve } from 'node:path';
import { EventEmitter } from 'node:events';
import { EventStore, MissingRun } from './event-store';
import {
  commands,
  InvalidTransition,
  restore,
  type Command,
  type Entry,
} from './domain/run';
import { certify, matrices } from './domain/pricing';
import type { Report } from '../../shared/contract';

function amount(cents: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
function describe(e: Entry): string {
  switch (e.kind) {
    case 'RunStarted':
      return 'Sesión independiente iniciada.';
    case 'OrderAccepted':
      return (
        'Pedido ' +
        e.data.slot +
        ' · precio acordado ' +
        amount(e.data.quote.price) +
        ' · ' +
        e.data.quote.version
      );
    case 'OrderConfirmed':
      return (
        'Pedido ' +
        e.data.slot +
        ' · cobro registrado ' +
        amount(e.data.charged)
      );
    case 'ShadowEvaluated':
      return (
        'Pedido ' +
        e.data.slot +
        ' · ' +
        e.data.candidate +
        ' propuso ' +
        amount(e.data.decision.price) +
        ' · ' +
        e.data.decision.rule
      );
    case 'CandidateCorrected':
      return 'Nueva matriz ' + e.data.candidate + ' · vigencia al aceptar.';
    case 'MigrationBlocked':
      return 'Motivos: ' + e.data.failures.join(' / ');
    case 'MigrationActivated':
      return e.data.candidate + ' habilitado para pedidos nuevos.';
  }
}
@Injectable()
class Lab implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Observador');
  private readonly bus = new EventEmitter();
  private readonly store = new EventStore(
    process.env['RULES_DB'] ?? resolve('.var', 'rules.sqlite'),
  );
  private timer?: NodeJS.Timeout;
  onModuleInit() {
    this.bus.on('committed', (id: string) => this.deliver(id));
    this.timer = setInterval(() => {
      for (const id of this.store.pending()) this.deliver(id);
    }, 1000);
    this.timer.unref();
  }
  private deliver(id: string) {
    try {
      this.store.deliver(id);
    } catch (error) {
      this.log.error(
        'Evaluación pendiente de reentrega',
        error instanceof Error ? error.message : '',
      );
    }
  }
  onModuleDestroy() {
    clearInterval(this.timer);
    this.bus.removeAllListeners();
    this.store.close();
  }
  create() {
    const id = this.store.create();
    this.bus.emit('committed', id);
    return this.report(id);
  }
  run(id: string, command: Command) {
    this.store.execute(id, command);
    this.bus.emit('committed', id);
    return this.report(id);
  }
  report(id: string): Report {
    const stream = this.store.read(id);
    if (!stream.length) throw new MissingRun();
    const state = restore(stream);
    const matrix = matrices[state.candidate];
    return {
      id,
      ...state,
      matrix: [...matrix.rows],
      candidateClock: matrix.clock,
      cases: certify(state.candidate),
      events: stream.map((e) => ({
        seq: e.seq,
        kind: e.kind,
        detail: describe(e),
      })),
    };
  }
}
@Controller('api/runs')
class RunsController {
  constructor(private readonly lab: Lab) {}
  @Post() create() {
    return this.lab.create();
  }
  @Get(':id') report(@Param('id') id: string) {
    return this.handle(() => this.lab.report(id));
  }
  @Post(':id/:command') execute(
    @Param('id') id: string,
    @Param('command') command: string,
  ) {
    if (!commands.includes(command as Command))
      throw new BadRequestException('Acción desconocida.');
    return this.handle(() => this.lab.run(id, command as Command));
  }
  private handle(fn: () => Report) {
    try {
      return fn();
    } catch (e) {
      if (e instanceof MissingRun)
        throw new NotFoundException('Sesión inexistente.');
      if (e instanceof InvalidTransition)
        throw new ConflictException(e.message);
      throw e;
    }
  }
}
@Module({ controllers: [RunsController], providers: [Lab] })
export class AppModule {}
