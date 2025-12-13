# Auditoria de sessão e autenticação – Envio Legal

## Mapa de componentes/arquivos relevantes
- `proxy.ts` – proteção central (JWT, tokenVersion/Redis), controle de idle por cookie `last_activity`, redirecionos/401.
- `lib/auth/jwt-tokens.ts`, `lib/auth/session.ts`, `lib/auth/admin-session.ts`, `lib/auth/collector-session.ts`, `lib/auth/autonomous-collector-session.ts` – emissão/verificação de tokens, cookies, tokenVersion.
- `lib/auth/route-protection.ts` – mapeamento de rotas públicas/privadas/admin/collector.
- `lib/cache.ts` – sessionCache/staffSessionCache/collectorSessionCache (TTL 7d, tokenVersion em Redis).
- Endpoints cliente: `app/api/auth/login|refresh|logout|heartbeat|me/route.ts`, `app/api/auth/google/callback/route.ts`.
- Endpoints admin: `app/api/admin/auth/login|logout|me/route.ts`.
- Front SPA: `components/session/SessionIdleModal.tsx`, `app/(envio)/EnvioLayoutClient.tsx`, `app/(admin)/admin/layout.tsx`, `stores/auth.ts`.
- Coletores/pontos: `app/api/coletores/auth/*`, `app/api/pontos-coleta/auth/*`.

## Tabela de achados
| Severidade | Descrição | Impacto | Evidência | Recomendação |
| --- | --- | --- | --- | --- |
| Alto | Fluxo de idle/keepalive do Admin usa endpoints do cliente (heartbeat em `/api/auth/heartbeat` que exige refresh do cliente e refresh POST em `/api/admin/auth/me` que só expõe GET). O componente trata 401/405 como sessão expirada e chama logout. | Admin é desconectado mesmo ativo; idle não se renova e UX quebra após poucos minutos. | `app/(admin)/admin/layout.tsx:455-461`; `components/session/SessionIdleModal.tsx:142-204`. | Criar endpoints admin específicos para heartbeat/refresh (POST) que validem tokenVersion e atualizem `last_activity`; permitir configurar método no modal ou usar cliente dedicado para admin; cobrir com testes. |
| Alto | Logout não revoga refresh tokens se o access token já expirou/ausente: `getSession()` (access) falha, tokenVersion não é incrementado. | Refresh tokens permanecem válidos após “logout” em sessões expiradas ou roubadas, permitindo reuso por 7 dias. | `app/api/auth/logout/route.ts:10-27`. | No logout, decodificar refresh token (ou access expirado) ignorando expiração para obter `userId` e sempre incrementar tokenVersion; limpar cache em qualquer cenário. |
| Alto | Heartbeat ignora tokenVersion/revogação (validação desativada “para performance”). | Sessões revogadas (logout/password change) continuam recebendo 200 e atualizando `last_activity`, mantendo tela “viva” até um 401 posterior; também permite refresh roubado manter cookie de atividade. | `app/api/auth/heartbeat/route.ts:47-52`. | Validar tokenVersion no heartbeat (via Redis) e retornar 401/limpar cookies em mismatch; opcional: endpoint leve que só consulta tokenVersion. |
| Médio | Login via Google emite apenas access token (15 min) com cookie `maxAge` 7d e não seta refresh token. | Usuários OAuth perdem sessão após ~15 min; `/api/auth/refresh` falha e há loops de logout/heartbeat. | `app/api/auth/google/callback/route.ts:354-384`. | Emitir par access+refresh (signTokenPair), definir ambos cookies e alinhar TTL/rota de refresh; adicionar rotação e invalidar tokenVersion. |
| Médio | Idle desativado para coletores/pontos de coleta (expiração só pelo JWT de 7d/12h). | Sessões ficam ativas indefinidamente em dispositivos compartilhados; maior superfície se o cookie for roubado. | `proxy.ts:5-9`, `proxy.ts:569-572`, `proxy.ts:621-622`. | Definir política de idle também para esses perfis (ex.: 15-20 min) e fornecer heartbeat simples ou aceitar decisão consciente documentada. |
| Médio | Cache do `/api/auth/me` usa chave ad hoc `me:{userId}` e o logout invalida `userCache` por `userId` (prefixo `user:`). | Dados de usuário podem ficar desatualizados após logout/bloqueio por até 5 min; status bloqueado pode ser servido do cache. | `app/api/auth/me/route.ts:27-84`; `app/api/auth/logout/route.ts:14-20`; `lib/cache.ts` (prefixo `user:`). | Usar `userCache.get/set(session.userId)` com prefixo padrão e invalidar a mesma chave; ou remover cache do `/me`. |
| Médio | TTL do sessionCache/tokenVersion (7d) não é renovado em refresh. | Usuários ativos por mais de 7d recebem cache miss/tokenVersion null e são deslogados mesmo fazendo refresh diário; refresh token rotacionado passa a falhar. | `lib/cache.ts:86-118`; ausência de `sessionCache.set`/`expire` em `app/api/auth/refresh/route.ts`. | Atualizar TTL do sessionCache/tokenVersion a cada refresh (touch/expire) ou adotar janela deslizante configurável/limite absoluto. |
| Médio | APIs de sessão (login/refresh/logout/heartbeat) não fazem validação de Origin/CSRF, dependem apenas de SameSite=Lax. | Risco residual de CSRF se houver GET mutantes ou navegadores antigos; falta de sinalização explícita dificulta auditoria. | Ex.: ausência de validação em `app/api/auth/login/route.ts` e `app/api/auth/refresh/route.ts`. | Implementar verificação de `Origin`/`Host` e/ou token CSRF (double-submit) para rotas autenticadas; enviar `Access-Control-Allow-Credentials` apenas quando necessário. |

## Top 10 melhorias priorizadas
1) Corrigir SessionIdleModal no admin: endpoints próprios (POST) de heartbeat/refresh que atualizem `last_activity` e validem tokenVersion; parametrizar método no componente.  
2) Logout resiliente: sempre incrementar tokenVersion usando refresh token ou access expirado; limpar caches mesmo sem sessão ativa.  
3) Heartbeat fail-close: validar tokenVersion e limpar cookies/retornar 401 em mismatch ou redis_error.  
4) OAuth/Google: emitir refresh token + rotação segura; alinhar cookies e usar `signTokenPair`.  
5) Estender idle para coletores/pontos ou documentar exceção; fornecer modal/heartbeat equivalente.  
6) Ajustar cache do `/me` para chave única por usuário e invalidar corretamente em logout/bloqueio.  
7) Renovar TTL do sessionCache a cada refresh (janela deslizante) e adicionar métrica de expirations/misses.  
8) CSRF/Origin hardening para rotas autenticadas e logout; considerar `SameSite=Strict` onde possível.  
9) Observabilidade: logs/metricas para heartbeat 401, tokenVersion mismatch, refresh falho, timeout por inatividade (proxy).  
10) Modelo de sessão por dispositivo/“remember me”: sessionId por device em Redis com limites (ex.: 5 ativos), opção de refresh prolongado só quando “lembrar” estiver marcado.

## Política de sessão sugerida
- Access token: 15 min (máximo 30 min) validando tokenVersion.  
- Refresh token: 7 dias com janela deslizante; limite absoluto de 30 dias; rotação obrigatória a cada refresh.  
- Idle timeout: 10 min clientes/admin (aviso aos 8-9 min), 15-20 min coletores/pontos se aplicável.  
- Remember me: refresh de 30 dias + idle de 30 min, guardado em Redis por dispositivo (sessionId) para revogação seletiva.  
- Logout/password reset/bloqueio: incrementa tokenVersion e invalida todos os refresh tokens do usuário (ou só do device alvo se adotado sessionId).  
- Cookies: `httpOnly`, `secure`, `sameSite=Lax` ou `Strict` quando viável, `path=/`, `domain` explícito no domínio público; limpar ambos tokens e `last_activity` em qualquer 401/timeout.

## Checklist de testes (unit/e2e)
- Login (email e Google) seta ambos cookies com flags (`httpOnly`, `secure` em prod, `sameSite` correto) e grava sessionCache/tokenVersion.  
- Logout com access expirado ainda revoga sessão (tokenVersion incrementado) e limpa cache.  
- Heartbeat com tokenVersion inválido retorna 401 e limpa cookies; com token válido renova `last_activity`.  
- Refresh após logout (tokenVersion mismatch) retorna 401 e não reemite cookies; refresh renova TTL no Redis.  
- Idle: sem heartbeat por >10 min resulta em redirect/401 e cookies limpos; com heartbeat regular mantém sessão.  
- Admin: heartbeat/refresh corretos (POST), sem 401/405; modal não dispara logout indevido.  
- OAuth: após 20 min de inatividade, refresh continua funcionando; sem refresh, rota protegida retorna 401.  
- Coletores/pontos (se idle ativado): simular inatividade e validar expiração e renovação.  
- CSRF: requisições cross-site sem `Origin`/token são rejeitadas; top-level GET não altera estado.  
- Resiliência Redis: falha temporária do cache não deixa sessão “presa” (mensagem clara + recuperação após restabelecer).
