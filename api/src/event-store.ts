import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  decide,
  react,
  type Command,
  type Entry,
  type Event,
} from './domain/run';

export class EventStore {
  private readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, checkpoint INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS events(
        run_id TEXT NOT NULL REFERENCES runs(id), seq INTEGER NOT NULL,
        kind TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(run_id, seq)
      );
    `);
  }
  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  private append(id: string, previous: number, changes: Event[]) {
    const insert = this.db.prepare('INSERT INTO events VALUES(?,?,?,?)');
    for (const event of changes)
      insert.run(id, ++previous, event.kind, JSON.stringify(event.data));
  }
  create() {
    const id = randomUUID();
    this.transaction(() => {
      this.db.prepare('INSERT INTO runs(id) VALUES(?)').run(id);
      this.append(id, 0, [{ kind: 'RunStarted', data: {} }]);
    });
    return id;
  }
  read(id: string): Entry[] {
    return this.db
      .prepare('SELECT seq,kind,body FROM events WHERE run_id=? ORDER BY seq')
      .all(id)
      .map(
        (row) =>
          ({
            seq: row.seq,
            kind: row.kind,
            data: JSON.parse(String(row.body)),
          }) as Entry,
      );
  }
  execute(id: string, command: Command) {
    this.transaction(() => {
      const events = this.read(id);
      if (!events.length) throw new MissingRun();
      this.append(id, events.length, decide(events, command));
    });
  }
  // Each run has its own durable consumer offset. A failed commit leaves both the offset
  // and the observation untouched; the next delivery retries the same input.
  deliver(id: string) {
    this.transaction(() => {
      const row = this.db
        .prepare('SELECT checkpoint FROM runs WHERE id=?')
        .get(id);
      if (!row) throw new MissingRun();
      const events = this.read(id);
      let offset = Number(row.checkpoint);
      while (offset < events.length) {
        const event = events[offset++];
        const produced = react(events.slice(0, offset), event);
        this.append(id, events.length, produced);
        for (const change of produced)
          events.push({ ...change, seq: events.length + 1 });
      }
      this.db
        .prepare('UPDATE runs SET checkpoint=? WHERE id=?')
        .run(offset, id);
    });
  }
  pending(): string[] {
    return this.db
      .prepare(
        'SELECT id FROM runs WHERE EXISTS (SELECT 1 FROM events WHERE run_id=runs.id AND seq>runs.checkpoint)',
      )
      .all()
      .map((r) => String(r.id));
  }
  close() {
    this.db.close();
  }
}
export class MissingRun extends Error {}
