# Auditoria de sessão e autenticação – revisão pós-correções

## O que foi verificado como corrigido
- Idle do admin agora usa endpoints dedicados (`/api/admin/auth/refresh`, `/api/admin/auth/heartbeat`) com validação de tokenVersion e atualização de `last_activity` (`app/(admin)/admin/layout.tsx`, `app/api/admin/auth/refresh/route.ts`, `app/api/admin/auth/heartbeat/route.ts`).
- Logout cliente revoga sessão mesmo com access token expirado, usando refresh token para obter `userId` e incrementando `tokenVersion` (`app/api/auth/logout/route.ts`).
- Heartbeat cliente passou a validar tokenVersion no Redis e faz fail-close limpando cookies (`app/api/auth/heartbeat/route.ts`).
- Google OAuth agora emite par access+refresh com TTL correto e salva sessão em Redis (`app/api/auth/google/callback/route.ts`).
- Refresh renova TTL do `sessionCache` (janela deslizante) e valida CSRF de Origin (`app/api/auth/refresh/route.ts`).
- `/api/auth/me` e `logout` alinharam uso de `userCache` para evitar “cache órfão” (`app/api/auth/me/route.ts`, `app/api/auth/logout/route.ts`).
- Proteção CSRF por Origin adicionada a login/logout/refresh (cliente e admin) via `lib/api/csrf.ts`.

## Achados remanescentes
| Severidade | Descrição | Impacto | Evidência | Recomendações |
| --- | --- | --- | --- | --- |
| Médio | Perfis de coletores/pontos seguem sem timeout por inatividade; dependem apenas do TTL fixo do JWT (7d/12h). | Em dispositivos compartilhados, sessões permanecem válidas até o JWT expirar; roubo de cookie mantém acesso prolongado. | `proxy.ts` (comentário inicial e blocos collector/pickup), `lib/auth/collector-session.ts` (TTL 12h, idle NO), `lib/auth/autonomous-collector-session.ts` (TTL 7d, idle NO). | Definir idle para esses perfis (ex.: 15–20 min) com heartbeat simples ou documentar exceção e mitigações (reduzir TTL, device binding). |
| Baixo | `last_activity` é compartilhado entre cliente e admin (mesmo nome/path). Usar admin e cliente no mesmo navegador pode gerar resets cruzados e expirations inesperadas. | Logout/timeout de um contexto pode limpar o timer do outro; UX confusa em multi-sessão. | Cookie name único em `proxy.ts` e `app/api/admin/auth/*` (`last_activity`). | Isolar cookies por contexto (`last_activity_admin`, `last_activity_user`) ou separar domínios/subdomínios para portais distintos. |
| Baixo | Endpoints admin de refresh/heartbeat não aplicam validação de Origin/CSRF. Dependem apenas de SameSite=Lax. | Vetor CSRF residual caso SameSite seja afrouxado ou em user agents antigos; não há camada adicional de sinalização. | Ausência de `requireValidOrigin` em `app/api/admin/auth/refresh/route.ts` e `app/api/admin/auth/heartbeat/route.ts`. | Avaliar incluir validação de Origin/Host ou token CSRF também para esses endpoints (especialmente em ambientes híbridos com domínios múltiplos). |

## Checklist de verificação pós-ajustes
- [ ] Idle e heartbeat para coletores/pontos definidos ou exceção documentada/mitigada.  
- [ ] Cookies de atividade segregados por contexto (admin vs cliente) ou confirmado que não há uso simultâneo.  
- [ ] CSRF/Origin aplicado (ou conscientemente dispensado) em refresh/heartbeat admin.  
- [ ] Métricas/logs para heartbeat 401/tokenVersion mismatch monitorando revogação em produção.  
