-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create cep_locations table with PostGIS geography column
CREATE TABLE IF NOT EXISTS cep_locations (
  cep VARCHAR(8) PRIMARY KEY,
  latitude NUMERIC(9,6) NOT NULL,
  longitude NUMERIC(9,6) NOT NULL,
  precision VARCHAR(20),
  provider VARCHAR(50),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Add PostGIS geography column (Point in SRID 4326 = WGS84)
ALTER TABLE cep_locations
ADD COLUMN IF NOT EXISTS geom geography(Point, 4326);

-- Create trigger to automatically update geom from lat/lng
CREATE OR REPLACE FUNCTION update_cep_location_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cep_location_geom
BEFORE INSERT OR UPDATE ON cep_locations
FOR EACH ROW
EXECUTE FUNCTION update_cep_location_geom();

-- Create GIST index for efficient spatial queries
CREATE INDEX IF NOT EXISTS idx_cep_locations_geom
ON cep_locations USING GIST (geom);

-- Create index on updated_at for cache cleanup queries
CREATE INDEX IF NOT EXISTS idx_cep_locations_updated_at
ON cep_locations (updated_at);
