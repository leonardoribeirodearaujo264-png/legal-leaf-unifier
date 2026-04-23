-- 1. Add reconciled_count column to sync status table
ALTER TABLE public.advbox_tasks_sync_status
ADD COLUMN IF NOT EXISTS reconciled_count INTEGER DEFAULT 0;

-- 2. Create composite index to speed up reconciliation queries
CREATE INDEX IF NOT EXISTS idx_advbox_tasks_status_synced_at 
ON public.advbox_tasks(status, synced_at);

-- 3. One-shot cleanup: mark ghost tasks (not touched in last 6h by any sync) as completed
UPDATE public.advbox_tasks
SET status = 'completed',
    completed_at = COALESCE(completed_at, synced_at),
    synced_at = NOW(),
    updated_at = NOW()
WHERE status IN ('pending', 'in_progress', 'pendente')
  AND synced_at < (
    COALESCE(
      (SELECT MAX(started_at) FROM public.advbox_tasks_sync_status WHERE status = 'completed'),
      NOW()
    ) - INTERVAL '6 hours'
  );