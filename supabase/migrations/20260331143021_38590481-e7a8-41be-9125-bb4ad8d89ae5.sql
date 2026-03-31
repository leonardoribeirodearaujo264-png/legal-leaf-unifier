CREATE OR REPLACE FUNCTION public.sync_parceiro_pagamento_to_financeiro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_categoria_id UUID;
  v_parceiro_nome TEXT;
  v_lancamento_id UUID;
  v_valor_efetivo NUMERIC;
BEGIN
  SELECT nome_completo INTO v_parceiro_nome FROM public.parceiros WHERE id = NEW.parceiro_id;
  
  v_valor_efetivo := COALESCE(NEW.valor_liquido, NEW.valor);
  
  IF NEW.tipo = 'receber' THEN
    SELECT id INTO v_categoria_id FROM fin_categorias WHERE nome ILIKE '%parceiro%' AND tipo = 'receita' LIMIT 1;
    IF v_categoria_id IS NULL THEN
      INSERT INTO fin_categorias (nome, tipo, grupo, cor, ativa)
      VALUES ('Comissões de Parceiros (Receber)', 'receita', 'Receitas', '#22c55e', true)
      RETURNING id INTO v_categoria_id;
    END IF;
  ELSE
    SELECT id INTO v_categoria_id FROM fin_categorias WHERE nome ILIKE '%parceiro%' AND tipo = 'despesa' LIMIT 1;
    IF v_categoria_id IS NULL THEN
      INSERT INTO fin_categorias (nome, tipo, grupo, cor, ativa)
      VALUES ('Comissões de Parceiros (Pagar)', 'despesa', 'Despesas Operacionais', '#ef4444', true)
      RETURNING id INTO v_categoria_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.lancamento_financeiro_id IS NOT NULL THEN
      UPDATE fin_lancamentos SET
        valor = v_valor_efetivo,
        data_vencimento = NEW.data_vencimento,
        data_pagamento = NEW.data_pagamento,
        status = NEW.status,
        observacoes = COALESCE(NEW.descricao_abatimentos, observacoes),
        updated_at = NOW()
      WHERE id = NEW.lancamento_financeiro_id;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.lancamento_financeiro_id IS NOT NULL THEN
    UPDATE fin_lancamentos SET
      valor = v_valor_efetivo,
      data_vencimento = NEW.data_vencimento,
      data_pagamento = NEW.data_pagamento,
      status = NEW.status,
      updated_at = NOW()
    WHERE id = NEW.lancamento_financeiro_id;
  ELSE
    INSERT INTO fin_lancamentos (
      tipo,
      categoria_id,
      valor,
      descricao,
      data_vencimento,
      data_pagamento,
      origem,
      status,
      observacoes,
      created_by
    ) VALUES (
      CASE WHEN NEW.tipo = 'receber' THEN 'receita' ELSE 'despesa' END,
      v_categoria_id,
      v_valor_efetivo,
      'Comissão Parceiro: ' || v_parceiro_nome || 
        CASE WHEN NEW.total_parcelas > 1 THEN ' (' || NEW.parcela_atual || '/' || NEW.total_parcelas || ')' ELSE '' END,
      NEW.data_vencimento,
      NEW.data_pagamento,
      'cliente',
      NEW.status,
      COALESCE(NEW.descricao_abatimentos, NEW.observacoes),
      NEW.created_by
    )
    RETURNING id INTO v_lancamento_id;
    
    NEW.lancamento_financeiro_id := v_lancamento_id;
  END IF;
  
  RETURN NEW;
END;
$function$;