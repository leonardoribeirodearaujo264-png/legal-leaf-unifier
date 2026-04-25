-- 1) Adicionar coluna advbox_account_id em fin_contas
ALTER TABLE public.fin_contas
  ADD COLUMN IF NOT EXISTS advbox_account_id BIGINT;

-- 2) Índice único permitindo NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_contas_advbox_account_id
  ON public.fin_contas (advbox_account_id)
  WHERE advbox_account_id IS NOT NULL;

-- 3) Popular as 12 contas (UPSERT por nome case-insensitive + trim)
-- Usamos uma CTE com os dados do ADVBox e fazemos MERGE-like manual

DO $$
DECLARE
  rec RECORD;
  v_id UUID;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      (38615::BIGINT,  'Banco Itau',                  373643.00::NUMERIC, 'corrente',     '#1E40AF'),
      (38617::BIGINT,  'Investimentos',              -120000.00::NUMERIC, 'investimento', '#7C3AED'),
      (42940::BIGINT,  'Asaas',                        44455.16::NUMERIC, 'pagamentos',   '#10B981'),
      (38618::BIGINT,  'Caixa Local',                   3958.14::NUMERIC, 'caixa',        '#F59E0B'),
      (105148::BIGINT, 'Lucas Mendes',                  -125.05::NUMERIC, 'corrente',     '#3B82F6'),
      (132604::BIGINT, 'Zariel Barreto',                  30.50::NUMERIC, 'corrente',     '#3B82F6'),
      (77314::BIGINT,  'Zalice Josiane dos Santos',       13.72::NUMERIC, 'corrente',     '#3B82F6'),
      (42699::BIGINT,  'Zjack Simon Nessim',               7.52::NUMERIC, 'corrente',     '#3B82F6'),
      (42692::BIGINT,  'Rafael Egg Nunes',                -5.20::NUMERIC, 'corrente',     '#3B82F6'),
      (104777::BIGINT, 'Daniel Martins',                  -2.45::NUMERIC, 'corrente',     '#3B82F6'),
      (77315::BIGINT,  'Kariston Richard Soares',         -1.10::NUMERIC, 'corrente',     '#3B82F6'),
      (42693::BIGINT,  'Marcos Luiz Egg Nunes',            0.50::NUMERIC, 'corrente',     '#3B82F6')
    ) AS t(advbox_id, nome, saldo, tipo, cor)
  LOOP
    -- Tenta achar conta existente por nome (case-insensitive, trim)
    SELECT id INTO v_id
    FROM public.fin_contas
    WHERE LOWER(TRIM(nome)) = LOWER(TRIM(rec.nome))
    LIMIT 1;

    IF v_id IS NOT NULL THEN
      -- Atualiza
      UPDATE public.fin_contas
      SET advbox_account_id = rec.advbox_id,
          saldo_inicial     = rec.saldo,
          saldo_atual       = rec.saldo,
          ativa             = true,
          updated_at        = NOW()
      WHERE id = v_id;
    ELSE
      -- Insere nova
      INSERT INTO public.fin_contas (nome, tipo, saldo_inicial, saldo_atual, cor, ativa, advbox_account_id)
      VALUES (rec.nome, rec.tipo, rec.saldo, rec.saldo, rec.cor, true, rec.advbox_id);
    END IF;
  END LOOP;
END $$;