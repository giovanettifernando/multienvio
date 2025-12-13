# Auditoria de sessão e autenticação – revisão v3

## Correções validadas nesta rodada
- Idle do admin passou a usar endpoints dedicados de refresh/heartbeat com tokenVersion, e cookies de atividade segregados (`last_activity_admin` vs `last_activity_user`), evitando resets cruzados (`proxy.ts:5-34`, `app/(admin)/admin/layout.tsx:455-462`, `app/api/admin/auth/refresh/route.ts`, `app/api/admin/auth/heartbeat/route.ts`).
- Logout cliente resiliente: revoga tokenVersion mesmo com access expirado, usando refresh token como fallback e limpando caches (`app/api/auth/logout/route.ts`).
- Heartbeat cliente agora valida tokenVersion (fail-close) e limpa cookies em mismatch (`app/api/auth/heartbeat/route.ts`).
- OAuth Google emite par access+refresh e grava sessão no Redis (`app/api/auth/google/callback/route.ts:356-399`).
- Refresh renova TTL do `sessionCache` (janela deslizante) e valida Origin/CSRF (`app/api/auth/refresh/route.ts`).
- `/api/auth/me` e logout usam `userCache` com a mesma key dos invalidates (`app/api/auth/me/route.ts`).

## Achados remanescentes
| Severidade | Descrição | Impacto | Evidência | Recomendações |
| --- | --- | --- | --- | --- |
| Médio | Idle desativado para coletores/pontos (decisão documentada) – dependem apenas do TTL do JWT (7d/12h). | Em dispositivos compartilhados/roubados o cookie mantém acesso até o JWT expirar; risco maior em ambiente público. | `proxy.ts:10-33`, fluxo collector/pickup usa apenas JWT e tokenVersion, sem `last_activity`. | Avaliar ativar idle opcional (15–20 min) com heartbeat simples e cookies `last_activity_collector/pickup`; se manter exceção, reduzir TTL ou amarrar dispositivo (deviceId + tokenVersion) e exigir re-login após inatividade prolongada. |
| Baixo | Endpoints admin de refresh/heartbeat não validam Origin/CSRF (apenas SameSite=Lax). | Vetor CSRF residual se SameSite for relaxado ou em clientes legados; falta sinalização explícita. | Ausência de `requireValidOrigin` em `app/api/admin/auth/refresh/route.ts` e `app/api/admin/auth/heartbeat/route.ts`. | Incluir validação de Origin/Host (ou double-submit token) também para esses endpoints, principalmente se expostos em domínios múltiplos. |

## Avaliação da arquitetura de sessão
Modelo atual: JWT curta (15 min) + refresh longa (7d) para cliente/admin; tokenVersion em Redis como mecanismo de revogação global; idle via cookie `last_activity` controlado no `proxy.ts`; coletores/pontos apenas JWT fixo com tokenVersion. É funcional e agora fail-close no heartbeat, mas ainda expõe refresh token (7d) e tokenVersion como único mecanismo de revogação.

Recomendações arquiteturais:
1) **Session IDs opacos por dispositivo**: substituir/encapsular o refresh token por um identificador opaco (UUID) armazenado hasheado em Redis com metadados (device, UA, IP, createdAt, lastActivity). Access token continua JWT curto (15 min) assinado, contendo `sessionId` + `tokenVersion`. Vantagens: revogação por dispositivo, redução de replay de refresh (hash), facilidade de rate limit por sessão.  
2) **Rotação obrigatória do “refresh”/sessionId a cada uso** (sliding window + limite absoluto de 30 dias) com detecção de reuse (se token reusado → revogar sessão).  
3) **Idle unificado no servidor**: mover o relógio de idle para Redis por `sessionId` (atualizado no refresh/heartbeat) e validar no `proxy` para reduzir dependência de cookies; cookies de atividade viram apenas hints para UX.  
4) **Perfis especiais**: se idle continuar desativado para coletores, compensar com TTL mais curto (ex.: 24h) ou exigir revalidação de dispositivo (PIN/OTP) após inatividade; se ativar idle, criar heartbeat leve reutilizando `tokenVersion`.  
5) **CSRF hardening para admin**: alinhar refresh/heartbeat admin com validação de Origin/Host e cabeçalho `SameSite` explícito; opcional: header custom `X-CSRF-Token` com double-submit.

## Checklist focal
- [ ] Decisão final sobre idle para coletores/pontos (ativar ou documentar com mitigação: TTL menor ou device binding).  
- [ ] Origin/CSRF aplicado aos endpoints admin de refresh/heartbeat (ou justificativa formal).  
- [ ] Planejamento de migração para sessionId opaco com rotação e reuse detection (com limites por dispositivo).  
