# Testing Guidelines - Envio Legal

## 1) Test frameworks
- **Unit/Integration**: Node test runner (`node --test`) com TS via `tests/register.js`. Evidencias: `package.json`, `tests/register.js`.
- **E2E**: Playwright. Evidencia: `playwright.config.ts`.
- **Vitest**: existe config, mas nao esta em scripts (INCONSISTENTE). Evidencias: `vitest.config.ts`, `package.json`.

## 2) Onde ficam os testes
- Unit: `tests/unit/**/*.test.ts`. Evidencia: `package.json`.
- Integration: `tests/integration/**/*.test.ts`. Evidencia: `package.json`.
- E2E: `tests/e2e/**/*.spec.ts`. Evidencia: `playwright.config.ts`.

## 3) Como rodar
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`

## 4) Checklist minimo de testes por feature
- [ ] Unit para regra de negocio principal.
- [ ] Integration para API que modifica dados criticos.
- [ ] E2E para fluxo de UI critico (checkout, login, admin finance).

## 5) Observacoes
- `tests/register.js` ajusta `setInterval` e alias `@/`. Evidencia: `tests/register.js`.
