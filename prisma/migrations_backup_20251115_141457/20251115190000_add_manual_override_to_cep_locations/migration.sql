-- Migration: Add manual override fields to cep_locations
-- Permite correção manual de coordenadas e impede re-geocoding automático

-- Adicionar campo created_at (com valor padrão retroativo)
ALTER TABLE cep_locations
ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL;

-- Adicionar campo manual_override (flag para indicar correção manual)
ALTER TABLE cep_locations
ADD COLUMN manual_override BOOLEAN DEFAULT false NOT NULL;

-- Adicionar campo manual_override_reason (motivo da correção manual)
ALTER TABLE cep_locations
ADD COLUMN manual_override_reason TEXT;

-- Comentários explicativos
COMMENT ON COLUMN cep_locations.manual_override IS 'Indica se as coordenadas foram corrigidas manualmente. CEPs com este flag não devem ser re-geocodificados automaticamente.';
COMMENT ON COLUMN cep_locations.manual_override_reason IS 'Motivo da correção manual (ex: "Geocoding impreciso - coordenadas corrigidas com Google Maps").';
COMMENT ON COLUMN cep_locations.created_at IS 'Data de criação do registro (primeira geocodificação).';

-- Atualizar comentário da tabela
COMMENT ON TABLE cep_locations IS 'Cache de coordenadas geocodificadas. Fonte única de coordenadas para toda a plataforma. Suporta correção manual via manual_override.';
