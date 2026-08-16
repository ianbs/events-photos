// Vitest runs in Node. Production still resolves the real `server-only`
// package, so Client Component imports continue to fail at build time.
export {};
