# Gerenciamento de CEPs Problemáticos

Sistema para corrigir e gerenciar CEPs com geocoding impreciso.

## Problema

Alguns CEPs retornam coordenadas imprecisas (state_fallback, city_fallback) no geocoding automático, causando cálculos de distância incorretos.

**Exemplo**: CEP 58035-100 (João Pessoa/PB) retornando coordenadas da capital do estado ao invés do endereço específico.

## Solução

### Opção 1: Re-geocodificação Forçada

Força o sistema a geocodificar novamente um CEP específico, apagando o cache e tentando obter melhores coordenadas.

**Quando usar**:
- O CEP tem precisão ruim (state_fallback, city_fallback)
- Você acredita que o provider de geocoding pode ter melhorado os dados
- Quer tentar novamente sem esperar 7 dias (período de re-geocoding automático)

**Como usar**:

Via API:
```bash
curl -X POST http://localhost:3000/api/admin/ceps/force-regeocode \
  -H "Content-Type: application/json" \
  -d '{"cep": "58035100"}'
```

Via SQL:
```sql
-- 1. Apagar entrada atual do cache
DELETE FROM cep_locations WHERE cep = '58035100';

-- 2. A próxima consulta ao CEP irá geocodificar novamente
-- (use a aplicação ou chame getCoordinatesForCep programaticamente)
```

### Opção 2: Correção Manual de Coordenadas

Atualiza coordenadas manualmente com valores precisos obtidos de outra fonte (Google Maps, OpenStreetMap, etc.).

**Quando usar**:
- O geocoding automático sempre retorna coordenadas ruins para este CEP
- Você tem coordenadas precisas de outra fonte
- Quer garantir que o sistema NUNCA sobrescreva essas coordenadas

**Como usar**:

Via API:
```bash
curl -X POST http://localhost:3000/api/admin/ceps/manual-update \
  -H "Content-Type: application/json" \
  -d '{
    "cep": "58035100",
    "lat": -7.1198028,
    "lng": -34.8623789,
    "precision": "address",
    "motivo": "Coordenadas corrigidas com Google Maps - geocoding automático retornava state_fallback"
  }'
```

Via SQL:
```sql
-- Inserir ou atualizar coordenadas manualmente
INSERT INTO cep_locations (
  cep,
  latitude,
  longitude,
  precision,
  provider,
  manual_override,
  manual_override_reason,
  created_at,
  updated_at
)
VALUES (
  '58035100',
  -7.1198028,
  -34.8623789,
  'address',
  'manual',
  true,
  'Coordenadas corrigidas com Google Maps - geocoding automático retornava state_fallback',
  now(),
  now()
)
ON CONFLICT (cep) DO UPDATE
SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  precision = EXCLUDED.precision,
  provider = EXCLUDED.provider,
  manual_override = EXCLUDED.manual_override,
  manual_override_reason = EXCLUDED.manual_override_reason,
  updated_at = now();
```

## Comandos SQL Úteis

### Listar CEPs com Baixa Precisão

```sql
-- Listar CEPs com state_fallback ou city_fallback que não foram corrigidos manualmente
SELECT
  cep,
  latitude,
  longitude,
  precision,
  provider,
  manual_override,
  updated_at
FROM cep_locations
WHERE precision IN ('state_fallback', 'city_fallback')
  AND manual_override = false
ORDER BY updated_at DESC;
```

### Listar CEPs Corrigidos Manualmente

```sql
SELECT
  cep,
  latitude,
  longitude,
  precision,
  manual_override_reason,
  updated_at
FROM cep_locations
WHERE manual_override = true
ORDER BY updated_at DESC;
```

### Buscar CEP Específico

```sql
SELECT * FROM cep_locations WHERE cep = '58035100';
```

### Apagar CEP Específico (Forçar Re-geocoding)

```sql
-- ATENÇÃO: Apenas use em CEPs SEM manualOverride=true
DELETE FROM cep_locations
WHERE cep = '58035100'
  AND manual_override = false;
```

### Remover Override Manual de um CEP

```sql
-- Permite que o CEP seja re-geocodificado automaticamente no futuro
UPDATE cep_locations
SET
  manual_override = false,
  manual_override_reason = NULL,
  updated_at = now()
WHERE cep = '58035100';
```

### Estatísticas de Precisão

```sql
-- Contar CEPs por nível de precisão
SELECT
  precision,
  COUNT(*) as total,
  SUM(CASE WHEN manual_override THEN 1 ELSE 0 END) as manual_overrides
FROM cep_locations
GROUP BY precision
ORDER BY total DESC;
```

## Endpoints Admin

### POST /api/admin/ceps/force-regeocode

Força re-geocodificação de um CEP.

**Request**:
```json
{
  "cep": "58035100"
}
```

**Response**:
```json
{
  "success": true,
  "cepLocation": {
    "cep": "58035100",
    "latitude": -7.1198028,
    "longitude": -34.8623789,
    "precision": "address",
    "provider": "nominatim",
    "manualOverride": false,
    "createdAt": "2025-11-15T19:00:00.000Z",
    "updatedAt": "2025-11-15T19:00:00.000Z"
  },
  "message": "CEP 58035100 re-geocodificado com sucesso"
}
```

**Erros**:
- 400: Validação falhou (CEP inválido)
- 500: Geocoding falhou ou CEP tem manualOverride=true

### POST /api/admin/ceps/manual-update

Atualiza coordenadas manualmente.

**Request**:
```json
{
  "cep": "58035100",
  "lat": -7.1198028,
  "lng": -34.8623789,
  "precision": "address",
  "motivo": "Coordenadas corrigidas com Google Maps"
}
```

**Response**:
```json
{
  "success": true,
  "cepLocation": {
    "cep": "58035100",
    "latitude": -7.1198028,
    "longitude": -34.8623789,
    "precision": "address",
    "provider": "manual",
    "manualOverride": true,
    "manualOverrideReason": "Coordenadas corrigidas com Google Maps",
    "createdAt": "2025-11-15T18:00:00.000Z",
    "updatedAt": "2025-11-15T19:30:00.000Z"
  },
  "message": "CEP 58035100 atualizado manualmente com sucesso. Protegido contra re-geocoding automático."
}
```

### GET /api/admin/ceps/list-low-precision

Lista CEPs com baixa precisão (state_fallback, city_fallback).

**Response**:
```json
{
  "success": true,
  "count": 5,
  "ceps": [
    {
      "cep": "58035100",
      "latitude": -7.1195,
      "longitude": -34.845,
      "precision": "state_fallback",
      "provider": "nominatim",
      "updatedAt": "2025-11-15T19:00:00.000Z"
    }
  ]
}
```

### GET /api/admin/ceps/list-manual-overrides

Lista CEPs corrigidos manualmente.

**Response**:
```json
{
  "success": true,
  "count": 3,
  "ceps": [
    {
      "cep": "58035100",
      "latitude": -7.1198028,
      "longitude": -34.8623789,
      "precision": "address",
      "manualOverride": true,
      "manualOverrideReason": "Coordenadas corrigidas com Google Maps",
      "updatedAt": "2025-11-15T19:30:00.000Z"
    }
  ]
}
```

## Integração com Sistema de Distâncias

### Como o Manual Override Funciona

1. **Geocoding Automático** (`lib/services/postgis.ts`):
   - Quando `getCoordinatesForCep()` é chamado:
     - Busca em `cep_locations`
     - Se `manualOverride = true`: retorna coordenadas e **nunca** tenta re-geocodificar
     - Se `manualOverride = false` e precisão ruim (>7 dias): tenta re-geocodificar automaticamente

2. **Cálculo de Distância** (`lib/services/distance.ts`):
   - Usa `getCoordinatesForCep()` para obter coordenadas
   - Valida precisão
   - Retorna warnings para `state_fallback` e `city_fallback`
   - CEPs com `manualOverride = true` e `precision = 'address'` são tratados como precisos

3. **Taxa de Coleta** (`lib/services/pickupFee.ts`):
   - Usa PostGIS para encontrar coletor mais próximo
   - Exibe warnings de precisão no frontend
   - CEPs corrigidos manualmente não mostram warnings (se precision adequada)

## Exemplo Completo: Corrigir CEP 58035-100

**Situação**: CEP retorna `state_fallback` (coordenadas da capital ao invés do bairro específico).

**Passo 1**: Verificar CEP atual

```sql
SELECT * FROM cep_locations WHERE cep = '58035100';

-- Resultado:
-- cep       | 58035100
-- latitude  | -7.1195    (capital do estado)
-- longitude | -34.845    (capital do estado)
-- precision | state_fallback
-- provider  | nominatim
-- manual_override | false
```

**Passo 2**: Obter coordenadas corretas

Usar Google Maps ou OpenStreetMap para encontrar coordenadas precisas:
- CEP 58035-100: Av. Gov. Flávio Ribeiro Coutinho, Manaíra, João Pessoa/PB
- Coordenadas: -7.1198028, -34.8623789

**Passo 3**: Atualizar manualmente

Via API:
```bash
curl -X POST http://localhost:3000/api/admin/ceps/manual-update \
  -H "Content-Type: application/json" \
  -d '{
    "cep": "58035100",
    "lat": -7.1198028,
    "lng": -34.8623789,
    "precision": "address",
    "motivo": "Geocoding automático retornava state_fallback. Coordenadas obtidas via Google Maps."
  }'
```

Via SQL:
```sql
INSERT INTO cep_locations (
  cep, latitude, longitude, precision, provider,
  manual_override, manual_override_reason, created_at, updated_at
)
VALUES (
  '58035100', -7.1198028, -34.8623789, 'address', 'manual',
  true, 'Geocoding automático retornava state_fallback. Coordenadas obtidas via Google Maps.',
  now(), now()
)
ON CONFLICT (cep) DO UPDATE SET
  latitude = -7.1198028,
  longitude = -34.8623789,
  precision = 'address',
  provider = 'manual',
  manual_override = true,
  manual_override_reason = 'Geocoding automático retornava state_fallback. Coordenadas obtidas via Google Maps.',
  updated_at = now();
```

**Passo 4**: Verificar correção

```sql
SELECT * FROM cep_locations WHERE cep = '58035100';

-- Resultado:
-- cep       | 58035100
-- latitude  | -7.1198028    (coordenadas precisas)
-- longitude | -34.8623789   (coordenadas precisas)
-- precision | address
-- provider  | manual
-- manual_override | true
-- manual_override_reason | Geocoding automático retornava state_fallback...
```

**Passo 5**: Testar no sistema

```bash
# Calcular distância usando o CEP corrigido
DATABASE_URL="postgresql://envio:envio@localhost:5432/enviolegal?schema=public" \
  npx tsx scripts/test-postgis.ts
```

Agora o CEP retornará coordenadas precisas e:
- Não será mais re-geocodificado automaticamente
- Não mostrará warnings de precisão
- Cálculos de distância estarão corretos

## Notas Importantes

1. **Proteção de Override Manual**:
   - CEPs com `manualOverride = true` NUNCA são re-geocodificados automaticamente
   - Tentativas de `forceRegeocodeCep()` em CEPs protegidos retornam erro

2. **Re-geocoding Automático**:
   - CEPs com `state_fallback` ou `city_fallback` mais antigos que 7 dias são automaticamente re-geocodificados
   - Isso NÃO afeta CEPs com `manualOverride = true`

3. **Validação de Coordenadas**:
   - O service valida se coordenadas estão dentro do Brasil
   - Emite warning se fora dos limites (lat: -35 a 6, lng: -75 a -33)

4. **Auditoria**:
   - Todos os CEPs mantêm histórico via `createdAt` e `updatedAt`
   - Campo `manualOverrideReason` documenta motivo das correções
   - Logs no console registram todas as operações

## Referências

- **Service**: `lib/services/cepLocation.ts`
- **PostGIS Integration**: `lib/services/postgis.ts`
- **Distance Service**: `lib/services/distance.ts`
- **Endpoints**: `app/api/admin/ceps/*`
- **Schema**: `prisma/schema.prisma` (model CepLocation)
- **Migration**: `prisma/migrations/20251115190000_add_manual_override_to_cep_locations/`
