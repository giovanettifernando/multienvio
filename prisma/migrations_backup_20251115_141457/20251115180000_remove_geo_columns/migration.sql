-- Migration: Remove geo columns from cadastros
-- Usar apenas CEP para geolocalização (lookup em cep_locations)
--
-- Remove:
-- - pickup_points.geo
-- - collectors.pf_geo (pfGeo)
-- - collectors.pj_geo (pjGeo)

-- Remove coluna geo de pickup_points
ALTER TABLE pickup_points
DROP COLUMN IF EXISTS geo;

-- Remove colunas pf_geo e pj_geo de collectors
ALTER TABLE collectors
DROP COLUMN IF EXISTS pf_geo;

ALTER TABLE collectors
DROP COLUMN IF EXISTS pj_geo;

-- Comentário final: todas as coordenadas devem ser obtidas via CEP → cep_locations
COMMENT ON TABLE cep_locations IS 'Cache de coordenadas geocodificadas. Fonte única de coordenadas para toda a plataforma.';
