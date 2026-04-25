-- Adicionar coluna leve client_name em advbox_tasks para evitar parse de raw_data no front
ALTER TABLE public.advbox_tasks
  ADD COLUMN IF NOT EXISTS client_name TEXT;

-- Backfill a partir do raw_data existente (idempotente)
UPDATE public.advbox_tasks
SET client_name = COALESCE(
  raw_data #>> '{lawsuit,customers,0,name}',
  raw_data #>> '{lawsuit,customers,name}'
)
WHERE client_name IS NULL
  AND raw_data IS NOT NULL;

-- Índice composto para ordenação/filtro padrão da UI (status + due_date desc)
CREATE INDEX IF NOT EXISTS idx_advbox_tasks_status_due_date
  ON public.advbox_tasks (status, due_date DESC NULLS LAST);