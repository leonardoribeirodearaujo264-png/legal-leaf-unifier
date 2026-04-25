
ALTER TABLE public.fin_lancamentos DISABLE TRIGGER USER;

WITH alvo AS (
  SELECT s.lancamento_id, c.id AS conta_id
  FROM advbox_financial_sync s
  JOIN fin_lancamentos l ON l.id = s.lancamento_id AND l.conta_origem_id IS NULL
  JOIN fin_contas c
    ON fin_normalize_bank_name(c.nome) = fin_normalize_bank_name(COALESCE(s.advbox_data->>'credit_bank', s.advbox_data->>'debit_bank'))
)
UPDATE fin_lancamentos l
SET conta_origem_id = a.conta_id,
    advbox_account_id = (SELECT advbox_account_id FROM fin_contas WHERE id = a.conta_id)
FROM alvo a
WHERE l.id = a.lancamento_id;

ALTER TABLE public.fin_lancamentos ENABLE TRIGGER USER;

-- Recalcular saldo_atual de todas as contas (saldo_inicial + soma dos lançamentos pagos)
UPDATE public.fin_contas c
SET saldo_atual = c.saldo_inicial + COALESCE(s.total, 0),
    updated_at = NOW()
FROM (
  SELECT 
    conta_origem_id,
    SUM(
      CASE 
        WHEN tipo = 'receita' AND status = 'pago' THEN valor
        WHEN tipo = 'despesa' AND status = 'pago' THEN -valor
        WHEN tipo = 'transferencia' AND status = 'pago' THEN -valor
        ELSE 0
      END
    ) AS total
  FROM public.fin_lancamentos
  WHERE deleted_at IS NULL AND conta_origem_id IS NOT NULL
  GROUP BY conta_origem_id
) s
WHERE s.conta_origem_id = c.id;
