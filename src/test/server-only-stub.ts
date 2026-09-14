// Stub de 'server-only' para pruebas unitarias con Vitest. En Next.js el
// paquete real usa el campo "browser" de su package.json (resuelto por
// webpack) para no truenar en el bundle de servidor; Vitest no aplica esa
// resolución, así que se alía aquí a un módulo vacío. Ver vitest.config.ts.
export {};
