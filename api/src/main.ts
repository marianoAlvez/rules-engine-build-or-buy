import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { static as serveStatic } from 'express';
import { resolve } from 'node:path';
import { AppModule } from './lab';
async function main() {
  const app = await NestFactory.create(AppModule);
  app.use(serveStatic(resolve('web/dist/rules-console/browser')));
  app.enableShutdownHooks();
  await app.listen(Number(process.env['PORT'] ?? 4329), process.env['HOST'] ?? '127.0.0.1');
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
