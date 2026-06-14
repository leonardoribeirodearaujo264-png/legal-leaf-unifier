-- =============================================================================
-- Atualiza case_parties com colunas de polo e fonte
-- Execute no Supabase SQL Editor (idempotente).
-- =============================================================================

-- 1. Adiciona colunas extras (idempotente)
ALTER TABLE public.case_parties
  ADD COLUMN IF NOT EXISTS pole        TEXT,   -- 'ativo' | 'passivo' | 'outro'
  ADD COLUMN IF NOT EXISTS party_type  TEXT,   -- texto livre: 'Autor', 'Réu', 'Litisconsorte'…
  ADD COLUMN IF NOT EXISTS source      TEXT DEFAULT 'datajud'; -- 'datajud' | 'manual' | 'ai_reprocess'

-- 2. Preenche pole nos registros existentes com base no campo type
UPDATE public.case_parties
SET pole = CASE
  WHEN lower(type) IN ('ativo') OR lower(type) LIKE '%autor%' OR lower(type) LIKE '%reclamant%'
       OR lower(type) LIKE '%requerente%' OR lower(type) LIKE '%impetrante%'
       OR lower(type) LIKE '%exequente%'
    THEN 'ativo'
  WHEN lower(type) IN ('passivo') OR lower(type) LIKE '%réu%' OR lower(type) LIKE '%reo%'
       OR lower(type) LIKE '%reclamad%' OR lower(type) LIKE '%requerido%'
       OR lower(type) LIKE '%impetrado%' OR lower(type) LIKE '%executad%'
    THEN 'passivo'
  ELSE 'outro'
END
WHERE pole IS NULL AND type IS NOT NULL;

-- 3. Normaliza source para registros existentes sem fonte definida
UPDATE public.case_parties
SET source = CASE
  WHEN raw_data->>'source' = 'manual' THEN 'manual'
  WHEN raw_data->>'source' = 'ai_reprocess' THEN 'ai_reprocess'
  ELSE 'datajud'
END
WHERE source IS NULL OR source = 'datajud';
