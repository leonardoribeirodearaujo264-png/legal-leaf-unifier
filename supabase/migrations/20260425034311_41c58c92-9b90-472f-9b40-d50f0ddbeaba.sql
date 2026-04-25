
ALTER TABLE public.fin_contas 
  ADD COLUMN IF NOT EXISTS saldo_inicial_data TIMESTAMPTZ;

UPDATE public.fin_contas
SET saldo_inicial_data = NOW()
WHERE advbox_account_id IS NOT NULL
  AND saldo_inicial_data IS NULL;

ALTER TABLE public.fin_lancamentos DISABLE TRIGGER USER;

UPDATE public.fin_contas c
SET saldo_atual = c.saldo_inicial + COALESCE((
  SELECT SUM(
    CASE 
      WHEN l.tipo = 'receita' AND l.status = 'pago' THEN l.valor
      WHEN l.tipo = 'despesa' AND l.status = 'pago' THEN -l.valor
      WHEN l.tipo = 'transferencia' AND l.conta_origem_id = c.id AND l.status = 'pago' THEN -l.valor
      WHEN l.tipo = 'transferencia' AND l.conta_destino_id = c.id AND l.status = 'pago' THEN l.valor
      ELSE 0
    END
  )
  FROM public.fin_lancamentos l
  WHERE l.deleted_at IS NULL
    AND (l.conta_origem_id = c.id OR l.conta_destino_id = c.id)
    AND (
      c.saldo_inicial_data IS NULL 
      OR COALESCE(l.data_pagamento, l.data_lancamento) > c.saldo_inicial_data::date
    )
), 0),
updated_at = NOW();

ALTER TABLE public.fin_lancamentos ENABLE TRIGGER USER;
