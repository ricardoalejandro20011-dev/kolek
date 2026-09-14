import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Pruebas unitarias puras (fee engine, RBAC, suscripciones, dinero) — no
 * requieren un proyecto Supabase real ni ninguna API externa. Ver
 * docs/production-checklist.md para lo que SÍ necesita infraestructura viva
 * (integración/E2E) y por qué no corre en este entorno.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './src/test/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
