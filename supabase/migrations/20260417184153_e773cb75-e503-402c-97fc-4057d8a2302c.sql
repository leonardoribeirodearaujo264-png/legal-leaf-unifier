
-- ============================================================
-- ETAPA 1: Índices críticos para zerar seq scans
-- ============================================================

-- profiles: lookups por email, position, is_active
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_position ON public.profiles (position) WHERE position IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_active_approved ON public.profiles (is_active, approval_status) WHERE is_active = true;

-- fin_lancamentos: dashboard executivo filtra por deleted_at, status, data_vencimento
CREATE INDEX IF NOT EXISTS idx_fin_lancamentos_dashboard ON public.fin_lancamentos (deleted_at, status, data_vencimento) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fin_lancamentos_data_pagamento ON public.fin_lancamentos (data_pagamento) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fin_lancamentos_categoria ON public.fin_lancamentos (categoria_id) WHERE deleted_at IS NULL;

-- conversation_participants: lookup composto user_id+conversation_id
-- (já existe unique conversation_id+user_id, criar inverso para queries por user)
CREATE INDEX IF NOT EXISTS idx_conv_participants_user_conv ON public.conversation_participants (user_id, conversation_id);

-- crm_deals: filtros por stage+won+owner
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage_won_owner ON public.crm_deals (stage_id, won, owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_owner ON public.crm_deals (owner_id) WHERE owner_id IS NOT NULL;

-- birthday_messages_log: lookup por customer_id+sent_at já parcialmente indexado, criar composto
CREATE INDEX IF NOT EXISTS idx_birthday_log_customer_sent ON public.birthday_messages_log (customer_id, sent_at DESC);

-- intranet_update_reads (composto user+update)
CREATE INDEX IF NOT EXISTS idx_intranet_update_reads_user_update ON public.intranet_update_reads (user_id, update_id);

-- audit_log: query por created_at já existe; adicionar índice por usuario+created
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created ON public.audit_log (usuario_id, created_at DESC);

-- fin_auditoria: indexar por created_at para retenção rápida
CREATE INDEX IF NOT EXISTS idx_fin_auditoria_created_at ON public.fin_auditoria (created_at DESC);

-- ============================================================
-- ETAPA 2: Reduzir tabelas em supabase_realtime
-- ============================================================

ALTER PUBLICATION supabase_realtime DROP TABLE public.advbox_dashboard_cache;
ALTER PUBLICATION supabase_realtime DROP TABLE public.fin_dashboard_cache;
ALTER PUBLICATION supabase_realtime DROP TABLE public.crm_deals;
ALTER PUBLICATION supabase_realtime DROP TABLE public.crm_activities;
ALTER PUBLICATION supabase_realtime DROP TABLE public.favorable_decisions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.qr_codes;
ALTER PUBLICATION supabase_realtime DROP TABLE public.rh_pagamentos;
