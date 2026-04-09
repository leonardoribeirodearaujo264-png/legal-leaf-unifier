export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_permissions: {
        Row: {
          admin_user_id: string
          created_at: string
          created_by: string
          id: string
          perm_admin_requests: string
          perm_advbox: string
          perm_agentes_ia: string | null
          perm_aniversarios_clientes: string | null
          perm_announcements: string
          perm_arquivos_teams: string | null
          perm_assistente_ia: string | null
          perm_birthdays: string
          perm_caixinha_desabafo: string | null
          perm_collection: string
          perm_contratos: string | null
          perm_copa_cozinha: string
          perm_crm: string | null
          perm_decisoes: string | null
          perm_documents: string
          perm_events: string
          perm_financial: string
          perm_forum: string
          perm_historico_pagamentos: string | null
          perm_home_office: string
          perm_integracoes: string | null
          perm_jurisprudencia: string | null
          perm_lead_tracking: string
          perm_mensagens: string | null
          perm_onboarding: string
          perm_parceiros: string | null
          perm_payroll: string | null
          perm_processos: string | null
          perm_publicacoes: string | null
          perm_recruitment: string
          perm_rota_doc: string | null
          perm_sala_reuniao: string | null
          perm_setor_comercial: string | null
          perm_sobre_escritorio: string | null
          perm_suggestions: string
          perm_tarefas_advbox: string | null
          perm_task_rules: string
          perm_teams: string
          perm_totp: string
          perm_users: string
          perm_utm_generator: string | null
          perm_vacation: string
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          created_by: string
          id?: string
          perm_admin_requests?: string
          perm_advbox?: string
          perm_agentes_ia?: string | null
          perm_aniversarios_clientes?: string | null
          perm_announcements?: string
          perm_arquivos_teams?: string | null
          perm_assistente_ia?: string | null
          perm_birthdays?: string
          perm_caixinha_desabafo?: string | null
          perm_collection?: string
          perm_contratos?: string | null
          perm_copa_cozinha?: string
          perm_crm?: string | null
          perm_decisoes?: string | null
          perm_documents?: string
          perm_events?: string
          perm_financial?: string
          perm_forum?: string
          perm_historico_pagamentos?: string | null
          perm_home_office?: string
          perm_integracoes?: string | null
          perm_jurisprudencia?: string | null
          perm_lead_tracking?: string
          perm_mensagens?: string | null
          perm_onboarding?: string
          perm_parceiros?: string | null
          perm_payroll?: string | null
          perm_processos?: string | null
          perm_publicacoes?: string | null
          perm_recruitment?: string
          perm_rota_doc?: string | null
          perm_sala_reuniao?: string | null
          perm_setor_comercial?: string | null
          perm_sobre_escritorio?: string | null
          perm_suggestions?: string
          perm_tarefas_advbox?: string | null
          perm_task_rules?: string
          perm_teams?: string
          perm_totp?: string
          perm_users?: string
          perm_utm_generator?: string | null
          perm_vacation?: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          created_by?: string
          id?: string
          perm_admin_requests?: string
          perm_advbox?: string
          perm_agentes_ia?: string | null
          perm_aniversarios_clientes?: string | null
          perm_announcements?: string
          perm_arquivos_teams?: string | null
          perm_assistente_ia?: string | null
          perm_birthdays?: string
          perm_caixinha_desabafo?: string | null
          perm_collection?: string
          perm_contratos?: string | null
          perm_copa_cozinha?: string
          perm_crm?: string | null
          perm_decisoes?: string | null
          perm_documents?: string
          perm_events?: string
          perm_financial?: string
          perm_forum?: string
          perm_historico_pagamentos?: string | null
          perm_home_office?: string
          perm_integracoes?: string | null
          perm_jurisprudencia?: string | null
          perm_lead_tracking?: string
          perm_mensagens?: string | null
          perm_onboarding?: string
          perm_parceiros?: string | null
          perm_payroll?: string | null
          perm_processos?: string | null
          perm_publicacoes?: string | null
          perm_recruitment?: string
          perm_rota_doc?: string | null
          perm_sala_reuniao?: string | null
          perm_setor_comercial?: string | null
          perm_sobre_escritorio?: string | null
          perm_suggestions?: string
          perm_tarefas_advbox?: string | null
          perm_task_rules?: string
          perm_teams?: string
          perm_totp?: string
          perm_users?: string
          perm_utm_generator?: string | null
          perm_vacation?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_task_notification_recipients: {
        Row: {
          admin_user_id: string
          created_at: string
          id: string
          receive_due_soon_alerts: boolean
          receive_due_today_alerts: boolean
          receive_overdue_alerts: boolean
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          id?: string
          receive_due_soon_alerts?: boolean
          receive_due_today_alerts?: boolean
          receive_overdue_alerts?: boolean
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          id?: string
          receive_due_soon_alerts?: boolean
          receive_due_today_alerts?: boolean
          receive_overdue_alerts?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      administrative_requests: {
        Row: {
          created_at: string
          description: string
          handled_at: string | null
          handled_by: string | null
          id: string
          priority: string
          request_type: string
          resolution_notes: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          priority?: string
          request_type: string
          resolution_notes?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          priority?: string
          request_type?: string
          resolution_notes?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_admin_requests_handled_by_profiles"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_admin_requests_user_id_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      advbox_customers: {
        Row: {
          advbox_id: number
          bairro: string | null
          birthday: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          estado_civil: string | null
          id: string
          nacionalidade: string | null
          name: string
          naturalidade: string | null
          nome_mae: string | null
          nome_pai: string | null
          numero: string | null
          observacoes: string | null
          orgao_emissor: string | null
          origem: string | null
          phone: string | null
          profissao: string | null
          raw_data: Json | null
          rg: string | null
          sexo: string | null
          synced_at: string
          tax_id: string | null
          telefone_comercial: string | null
          telefone_fixo: string | null
        }
        Insert: {
          advbox_id: number
          bairro?: string | null
          birthday?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          nacionalidade?: string | null
          name: string
          naturalidade?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string | null
          observacoes?: string | null
          orgao_emissor?: string | null
          origem?: string | null
          phone?: string | null
          profissao?: string | null
          raw_data?: Json | null
          rg?: string | null
          sexo?: string | null
          synced_at?: string
          tax_id?: string | null
          telefone_comercial?: string | null
          telefone_fixo?: string | null
        }
        Update: {
          advbox_id?: number
          bairro?: string | null
          birthday?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          nacionalidade?: string | null
          name?: string
          naturalidade?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string | null
          observacoes?: string | null
          orgao_emissor?: string | null
          origem?: string | null
          phone?: string | null
          profissao?: string | null
          raw_data?: Json | null
          rg?: string | null
          sexo?: string | null
          synced_at?: string
          tax_id?: string | null
          telefone_comercial?: string | null
          telefone_fixo?: string | null
        }
        Relationships: []
      }
      advbox_dashboard_cache: {
        Row: {
          id: string
          lawsuits_data: Json | null
          metadata: Json | null
          movements_data: Json | null
          total_lawsuits: number | null
          total_movements: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          lawsuits_data?: Json | null
          metadata?: Json | null
          movements_data?: Json | null
          total_lawsuits?: number | null
          total_movements?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          lawsuits_data?: Json | null
          metadata?: Json | null
          movements_data?: Json | null
          total_lawsuits?: number | null
          total_movements?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      advbox_financial_sync: {
        Row: {
          advbox_data: Json
          advbox_transaction_id: string
          id: string
          lancamento_id: string | null
          last_updated: string
          synced_at: string
        }
        Insert: {
          advbox_data: Json
          advbox_transaction_id: string
          id?: string
          lancamento_id?: string | null
          last_updated?: string
          synced_at?: string
        }
        Update: {
          advbox_data?: Json
          advbox_transaction_id?: string
          id?: string
          lancamento_id?: string | null
          last_updated?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advbox_financial_sync_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      advbox_report_schedules: {
        Row: {
          created_at: string | null
          email_recipients: string[] | null
          export_format: string
          id: string
          include_financial: boolean | null
          include_lawsuits: boolean | null
          include_publications: boolean | null
          include_tasks: boolean | null
          is_active: boolean | null
          last_run_at: string | null
          next_run_at: string | null
          report_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_recipients?: string[] | null
          export_format: string
          id?: string
          include_financial?: boolean | null
          include_lawsuits?: boolean | null
          include_publications?: boolean | null
          include_tasks?: boolean | null
          is_active?: boolean | null
          last_run_at?: string | null
          next_run_at?: string | null
          report_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_recipients?: string[] | null
          export_format?: string
          id?: string
          include_financial?: boolean | null
          include_lawsuits?: boolean | null
          include_publications?: boolean | null
          include_tasks?: boolean | null
          is_active?: boolean | null
          last_run_at?: string | null
          next_run_at?: string | null
          report_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      advbox_settings: {
        Row: {
          cache_ttl_minutes: number
          delay_between_requests_ms: number
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          cache_ttl_minutes?: number
          delay_between_requests_ms?: number
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          cache_ttl_minutes?: number
          delay_between_requests_ms?: number
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      advbox_sync_status: {
        Row: {
          completed_at: string | null
          created_at: string | null
          end_date: string | null
          error_message: string | null
          id: string
          last_offset: number | null
          last_run_at: string | null
          months: number | null
          start_date: string | null
          started_at: string | null
          status: string
          sync_type: string
          total_created: number | null
          total_processed: number | null
          total_skipped: number | null
          total_updated: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          end_date?: string | null
          error_message?: string | null
          id?: string
          last_offset?: number | null
          last_run_at?: string | null
          months?: number | null
          start_date?: string | null
          started_at?: string | null
          status?: string
          sync_type?: string
          total_created?: number | null
          total_processed?: number | null
          total_skipped?: number | null
          total_updated?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          end_date?: string | null
          error_message?: string | null
          id?: string
          last_offset?: number | null
          last_run_at?: string | null
          months?: number | null
          start_date?: string | null
          started_at?: string | null
          status?: string
          sync_type?: string
          total_created?: number | null
          total_processed?: number | null
          total_skipped?: number | null
          total_updated?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      advbox_tasks: {
        Row: {
          advbox_id: number
          assigned_user_ids: Json | null
          assigned_users: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          lawsuit_id: number | null
          points: number
          process_number: string | null
          raw_data: Json | null
          status: string
          synced_at: string
          task_type: string | null
          task_type_id: number | null
          title: string
          updated_at: string
        }
        Insert: {
          advbox_id: number
          assigned_user_ids?: Json | null
          assigned_users?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lawsuit_id?: number | null
          points?: number
          process_number?: string | null
          raw_data?: Json | null
          status?: string
          synced_at?: string
          task_type?: string | null
          task_type_id?: number | null
          title?: string
          updated_at?: string
        }
        Update: {
          advbox_id?: number
          assigned_user_ids?: Json | null
          assigned_users?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lawsuit_id?: number | null
          points?: number
          process_number?: string | null
          raw_data?: Json | null
          status?: string
          synced_at?: string
          task_type?: string | null
          task_type_id?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      advbox_tasks_sync_status: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          last_offset: number | null
          started_at: string | null
          status: string
          sync_type: string
          total_count: number | null
          total_synced: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_offset?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
          total_count?: number | null
          total_synced?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_offset?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
          total_count?: number | null
          total_synced?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_agent_favorites: {
        Row: {
          agent_url: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          agent_url: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          agent_url?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          model: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_message_favorites: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          model: string
          notes: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          model: string
          notes?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          model?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          attachments: Json | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          images: Json | null
          role: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          images?: Json | null
          role: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          images?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          prompt: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          prompt: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          prompt?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcement_attachments: {
        Row: {
          announcement_id: string
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_link: boolean | null
          uploaded_by: string | null
        }
        Insert: {
          announcement_id: string
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_link?: boolean | null
          uploaded_by?: string | null
        }
        Update: {
          announcement_id?: string
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_link?: boolean | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_attachments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          attachment_url: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          is_pinned: boolean
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_pinned?: boolean
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_pinned?: boolean
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      asaas_api_key_alerts: {
        Row: {
          api_key_id: string | null
          api_key_name: string | null
          created_at: string
          event_type: string
          expiration_date: string | null
          id: string
          is_read: boolean | null
        }
        Insert: {
          api_key_id?: string | null
          api_key_name?: string | null
          created_at?: string
          event_type: string
          expiration_date?: string | null
          id?: string
          is_read?: boolean | null
        }
        Update: {
          api_key_id?: string | null
          api_key_name?: string | null
          created_at?: string
          event_type?: string
          expiration_date?: string | null
          id?: string
          is_read?: boolean | null
        }
        Relationships: []
      }
      asaas_internal_transfers: {
        Row: {
          asaas_transfer_id: string
          created_at: string
          description: string | null
          from_wallet_id: string | null
          id: string
          status: string | null
          to_wallet_id: string | null
          transfer_type: string
          updated_at: string
          value: number
        }
        Insert: {
          asaas_transfer_id: string
          created_at?: string
          description?: string | null
          from_wallet_id?: string | null
          id?: string
          status?: string | null
          to_wallet_id?: string | null
          transfer_type: string
          updated_at?: string
          value: number
        }
        Update: {
          asaas_transfer_id?: string
          created_at?: string
          description?: string | null
          from_wallet_id?: string | null
          id?: string
          status?: string | null
          to_wallet_id?: string | null
          transfer_type?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      asaas_invoices: {
        Row: {
          asaas_invoice_id: string
          asaas_payment_id: string | null
          authorized_date: string | null
          canceled_date: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          error_message: string | null
          external_reference: string | null
          id: string
          invoice_number: string | null
          invoice_url: string | null
          observations: string | null
          pdf_url: string | null
          scheduled_date: string | null
          service_description: string | null
          status: string | null
          updated_at: string
          value: number | null
          xml_url: string | null
        }
        Insert: {
          asaas_invoice_id: string
          asaas_payment_id?: string | null
          authorized_date?: string | null
          canceled_date?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          error_message?: string | null
          external_reference?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          observations?: string | null
          pdf_url?: string | null
          scheduled_date?: string | null
          service_description?: string | null
          status?: string | null
          updated_at?: string
          value?: number | null
          xml_url?: string | null
        }
        Update: {
          asaas_invoice_id?: string
          asaas_payment_id?: string | null
          authorized_date?: string | null
          canceled_date?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          error_message?: string | null
          external_reference?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          observations?: string | null
          pdf_url?: string | null
          scheduled_date?: string | null
          service_description?: string | null
          status?: string | null
          updated_at?: string
          value?: number | null
          xml_url?: string | null
        }
        Relationships: []
      }
      asaas_payment_links: {
        Row: {
          asaas_customer_id: string | null
          asaas_installment_id: string | null
          asaas_payment_id: string
          bank_slip_url: string | null
          billing_type: string | null
          created_at: string
          customer_name: string | null
          due_date: string | null
          id: string
          invoice_url: string | null
          lancamento_id: string | null
          payment_date: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          status: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_installment_id?: string | null
          asaas_payment_id: string
          bank_slip_url?: string | null
          billing_type?: string | null
          created_at?: string
          customer_name?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          lancamento_id?: string | null
          payment_date?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          status?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_installment_id?: string | null
          asaas_payment_id?: string
          bank_slip_url?: string | null
          billing_type?: string | null
          created_at?: string
          customer_name?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          lancamento_id?: string | null
          payment_date?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          status?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_payment_links_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_transfers: {
        Row: {
          asaas_transfer_id: string
          bank_account_id: string | null
          created_at: string
          description: string | null
          effective_date: string | null
          failure_reason: string | null
          id: string
          net_value: number | null
          operation_type: string | null
          scheduled_date: string | null
          status: string
          transaction_receipt_url: string | null
          transfer_fee: number | null
          transfer_type: string | null
          updated_at: string
          value: number
        }
        Insert: {
          asaas_transfer_id: string
          bank_account_id?: string | null
          created_at?: string
          description?: string | null
          effective_date?: string | null
          failure_reason?: string | null
          id?: string
          net_value?: number | null
          operation_type?: string | null
          scheduled_date?: string | null
          status: string
          transaction_receipt_url?: string | null
          transfer_fee?: number | null
          transfer_type?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          asaas_transfer_id?: string
          bank_account_id?: string | null
          created_at?: string
          description?: string | null
          effective_date?: string | null
          failure_reason?: string | null
          id?: string
          net_value?: number | null
          operation_type?: string | null
          scheduled_date?: string | null
          status?: string
          transaction_receipt_url?: string | null
          transfer_fee?: number | null
          transfer_type?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      asaas_webhook_events: {
        Row: {
          created_at: string
          customer_id: string | null
          error_message: string | null
          event_data: Json
          event_type: string
          id: string
          installment_id: string | null
          invoice_id: string | null
          payment_id: string | null
          processed: boolean | null
          processed_at: string | null
          subscription_id: string | null
          transfer_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          event_data: Json
          event_type: string
          id?: string
          installment_id?: string | null
          invoice_id?: string | null
          payment_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          subscription_id?: string | null
          transfer_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          installment_id?: string | null
          invoice_id?: string | null
          payment_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          subscription_id?: string | null
          transfer_id?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          acao: string
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          id: string
          ip_address: string | null
          registro_id: string | null
          tabela: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          ip_address?: string | null
          registro_id?: string | null
          tabela: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          ip_address?: string | null
          registro_id?: string | null
          tabela?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      birthday_messages_log: {
        Row: {
          created_at: string | null
          customer_id: string
          customer_name: string
          customer_phone: string
          error_message: string | null
          id: string
          message_text: string
          send_via: string | null
          sent_at: string | null
          status: string
          zapi_message_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          customer_name: string
          customer_phone: string
          error_message?: string | null
          id?: string
          message_text: string
          send_via?: string | null
          sent_at?: string | null
          status?: string
          zapi_message_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          customer_name?: string
          customer_phone?: string
          error_message?: string | null
          id?: string
          message_text?: string
          send_via?: string | null
          sent_at?: string | null
          status?: string
          zapi_message_id?: string | null
        }
        Relationships: []
      }
      boleto_reminder_log: {
        Row: {
          asaas_payment_id: string
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          due_date: string | null
          error_message: string | null
          id: string
          reminder_type: string
          sent_at: string
          status: string
          value: number | null
          zapi_message_id: string | null
        }
        Insert: {
          asaas_payment_id: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          due_date?: string | null
          error_message?: string | null
          id?: string
          reminder_type: string
          sent_at?: string
          status?: string
          value?: number | null
          zapi_message_id?: string | null
        }
        Update: {
          asaas_payment_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          due_date?: string | null
          error_message?: string | null
          id?: string
          reminder_type?: string
          sent_at?: string
          status?: string
          value?: number | null
          zapi_message_id?: string | null
        }
        Relationships: []
      }
      browser_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "browser_push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      captured_leads: {
        Row: {
          created_at: string
          email: string | null
          form_id: string | null
          id: string
          ip_address: string | null
          landing_page: string | null
          name: string
          phone: string
          product_name: string | null
          rd_station_sync_error: string | null
          rd_station_synced: boolean | null
          referrer: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_device: string | null
          utm_medium: string | null
          utm_placement: string | null
          utm_publisher: string | null
          utm_source: string | null
          utm_term: string | null
          whatsapp_business_phone: string | null
          whatsapp_message: string | null
          whatsapp_phone: string | null
          whatsapp_referral: Json | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          form_id?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          name: string
          phone: string
          product_name?: string | null
          rd_station_sync_error?: string | null
          rd_station_synced?: boolean | null
          referrer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_device?: string | null
          utm_medium?: string | null
          utm_placement?: string | null
          utm_publisher?: string | null
          utm_source?: string | null
          utm_term?: string | null
          whatsapp_business_phone?: string | null
          whatsapp_message?: string | null
          whatsapp_phone?: string | null
          whatsapp_referral?: Json | null
        }
        Update: {
          created_at?: string
          email?: string | null
          form_id?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          name?: string
          phone?: string
          product_name?: string | null
          rd_station_sync_error?: string | null
          rd_station_synced?: boolean | null
          referrer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_device?: string | null
          utm_medium?: string | null
          utm_placement?: string | null
          utm_publisher?: string | null
          utm_source?: string | null
          utm_term?: string | null
          whatsapp_business_phone?: string | null
          whatsapp_message?: string | null
          whatsapp_phone?: string | null
          whatsapp_referral?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "captured_leads_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "lead_capture_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      client_form_overrides: {
        Row: {
          aposentado: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          client_row_id: number
          como_conheceu: string | null
          complemento: string | null
          conhece_alguem_mesma_situacao: string | null
          conhece_alguem_situacao: string | null
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          data_vencimento: string | null
          documento_identidade: string | null
          doenca_grave: string | null
          doenca_negativa: string | null
          email: string | null
          estado: string | null
          estado_civil: string | null
          id: string
          negativa_plano: string | null
          nome_completo: string | null
          nome_mae: string | null
          nome_pai: string | null
          numero: string | null
          opcao_pagamento: string | null
          plano_saude: string | null
          possui_emprestimo: string | null
          previsao_aposentadoria: string | null
          profissao: string | null
          qual_plano_saude: string | null
          quantidade_parcelas: string | null
          rua: string | null
          telefone: string | null
          telefone_alternativo: string | null
          tem_whatsapp: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          aposentado?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          client_row_id: number
          como_conheceu?: string | null
          complemento?: string | null
          conhece_alguem_mesma_situacao?: string | null
          conhece_alguem_situacao?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          data_vencimento?: string | null
          documento_identidade?: string | null
          doenca_grave?: string | null
          doenca_negativa?: string | null
          email?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          negativa_plano?: string | null
          nome_completo?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string | null
          opcao_pagamento?: string | null
          plano_saude?: string | null
          possui_emprestimo?: string | null
          previsao_aposentadoria?: string | null
          profissao?: string | null
          qual_plano_saude?: string | null
          quantidade_parcelas?: string | null
          rua?: string | null
          telefone?: string | null
          telefone_alternativo?: string | null
          tem_whatsapp?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          aposentado?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          client_row_id?: number
          como_conheceu?: string | null
          complemento?: string | null
          conhece_alguem_mesma_situacao?: string | null
          conhece_alguem_situacao?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          data_vencimento?: string | null
          documento_identidade?: string | null
          doenca_grave?: string | null
          doenca_negativa?: string | null
          email?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          negativa_plano?: string | null
          nome_completo?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          numero?: string | null
          opcao_pagamento?: string | null
          plano_saude?: string | null
          possui_emprestimo?: string | null
          previsao_aposentadoria?: string | null
          profissao?: string | null
          qual_plano_saude?: string | null
          quantidade_parcelas?: string | null
          rua?: string | null
          telefone?: string | null
          telefone_alternativo?: string | null
          tem_whatsapp?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      collection_rules: {
        Row: {
          created_at: string | null
          created_by: string
          days_overdue: number
          id: string
          is_active: boolean | null
          name: string
          send_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          days_overdue: number
          id?: string
          is_active?: boolean | null
          name: string
          send_time?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          days_overdue?: number
          id?: string
          is_active?: boolean | null
          name?: string
          send_time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      comercial_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      comercial_demanda_historico: {
        Row: {
          alterado_por: string
          alterado_por_nome: string
          created_at: string | null
          demanda_id: string
          id: string
          motivo: string | null
          vendedor_anterior_id: string | null
          vendedor_anterior_nome: string | null
          vendedor_novo_id: string
          vendedor_novo_nome: string
        }
        Insert: {
          alterado_por: string
          alterado_por_nome: string
          created_at?: string | null
          demanda_id: string
          id?: string
          motivo?: string | null
          vendedor_anterior_id?: string | null
          vendedor_anterior_nome?: string | null
          vendedor_novo_id: string
          vendedor_novo_nome: string
        }
        Update: {
          alterado_por?: string
          alterado_por_nome?: string
          created_at?: string | null
          demanda_id?: string
          id?: string
          motivo?: string | null
          vendedor_anterior_id?: string | null
          vendedor_anterior_nome?: string | null
          vendedor_novo_id?: string
          vendedor_novo_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "comercial_demanda_historico_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "comercial_demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      comercial_demandas: {
        Row: {
          chatguru_note_id: string | null
          cliente_advbox_id: string
          cliente_nome: string
          cliente_telefone: string | null
          created_at: string | null
          criado_por: string | null
          criado_por_nome: string | null
          crm_activity_id: string | null
          id: string
          status: string | null
          vendedor_id: string | null
          vendedor_nome: string | null
        }
        Insert: {
          chatguru_note_id?: string | null
          cliente_advbox_id: string
          cliente_nome: string
          cliente_telefone?: string | null
          created_at?: string | null
          criado_por?: string | null
          criado_por_nome?: string | null
          crm_activity_id?: string | null
          id?: string
          status?: string | null
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Update: {
          chatguru_note_id?: string | null
          cliente_advbox_id?: string
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string | null
          criado_por?: string | null
          criado_por_nome?: string | null
          crm_activity_id?: string | null
          id?: string
          status?: string | null
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comercial_demandas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comercial_vendedores_config: {
        Row: {
          ativo: boolean | null
          chatguru_user_id: string | null
          created_at: string | null
          id: string
          vendedor_id: string
          vendedor_nome: string
        }
        Insert: {
          ativo?: boolean | null
          chatguru_user_id?: string | null
          created_at?: string | null
          id?: string
          vendedor_id: string
          vendedor_nome: string
        }
        Update: {
          ativo?: boolean | null
          chatguru_user_id?: string | null
          created_at?: string | null
          id?: string
          vendedor_id?: string
          vendedor_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "comercial_vendedores_config_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contra_partida_templates: {
        Row: {
          created_at: string
          description: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contract_drafts: {
        Row: {
          clausula_exito_gerada: string | null
          clausula_primeira_gerada: string | null
          client_id: number
          client_name: string
          contra_partida: string | null
          contract_preview_text: string | null
          created_at: string
          data_vencimento: string | null
          descricao_honorarios_exito: string | null
          forma_pagamento: string | null
          id: string
          numero_parcelas: string | null
          objeto_contrato: string | null
          product_name: string
          qualification: string
          tem_entrada: boolean | null
          tem_honorarios_exito: boolean | null
          tipo_honorarios: string | null
          updated_at: string
          user_id: string
          valor_entrada: string | null
          valor_parcela: string | null
          valor_total: string | null
        }
        Insert: {
          clausula_exito_gerada?: string | null
          clausula_primeira_gerada?: string | null
          client_id: number
          client_name: string
          contra_partida?: string | null
          contract_preview_text?: string | null
          created_at?: string
          data_vencimento?: string | null
          descricao_honorarios_exito?: string | null
          forma_pagamento?: string | null
          id?: string
          numero_parcelas?: string | null
          objeto_contrato?: string | null
          product_name: string
          qualification: string
          tem_entrada?: boolean | null
          tem_honorarios_exito?: boolean | null
          tipo_honorarios?: string | null
          updated_at?: string
          user_id: string
          valor_entrada?: string | null
          valor_parcela?: string | null
          valor_total?: string | null
        }
        Update: {
          clausula_exito_gerada?: string | null
          clausula_primeira_gerada?: string | null
          client_id?: number
          client_name?: string
          contra_partida?: string | null
          contract_preview_text?: string | null
          created_at?: string
          data_vencimento?: string | null
          descricao_honorarios_exito?: string | null
          forma_pagamento?: string | null
          id?: string
          numero_parcelas?: string | null
          objeto_contrato?: string | null
          product_name?: string
          qualification?: string
          tem_entrada?: boolean | null
          tem_honorarios_exito?: boolean | null
          tipo_honorarios?: string | null
          updated_at?: string
          user_id?: string
          valor_entrada?: string | null
          valor_parcela?: string | null
          valor_total?: string | null
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string | null
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          is_group: boolean | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          is_group?: boolean | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          is_group?: boolean | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          owner_id: string | null
          priority: string | null
          rd_station_id: string | null
          status: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          priority?: string | null
          rd_station_id?: string | null
          status?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          priority?: string | null
          rd_station_id?: string | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_alert_settings: {
        Row: {
          close_date_warning_days: number | null
          enable_close_date_alerts: boolean | null
          enable_follow_up_alerts: boolean | null
          enable_stale_alerts: boolean | null
          id: string
          stale_deal_days: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          close_date_warning_days?: number | null
          enable_close_date_alerts?: boolean | null
          enable_follow_up_alerts?: boolean | null
          enable_stale_alerts?: boolean | null
          id?: string
          stale_deal_days?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          close_date_warning_days?: number | null
          enable_close_date_alerts?: boolean | null
          enable_follow_up_alerts?: boolean | null
          enable_stale_alerts?: boolean | null
          id?: string
          stale_deal_days?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      crm_automation_log: {
        Row: {
          action_result: Json | null
          created_at: string | null
          error_message: string | null
          id: string
          rule_id: string | null
          success: boolean | null
          trigger_entity_id: string | null
          trigger_entity_type: string | null
        }
        Insert: {
          action_result?: Json | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          rule_id?: string | null
          success?: boolean | null
          trigger_entity_id?: string | null
          trigger_entity_type?: string | null
        }
        Update: {
          action_result?: Json | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          rule_id?: string | null
          success?: boolean | null
          trigger_entity_id?: string | null
          trigger_entity_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_automation_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "crm_automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_automation_rules: {
        Row: {
          action_config: Json | null
          action_type: string
          created_at: string | null
          created_by: string | null
          executions_count: number | null
          id: string
          is_active: boolean | null
          last_executed_at: string | null
          name: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          created_at?: string | null
          created_by?: string | null
          executions_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name: string
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          created_at?: string | null
          created_by?: string | null
          executions_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          investment: number
          name: string
          platform: string
          start_date: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          investment?: number
          name: string
          platform?: string
          start_date?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          investment?: number
          name?: string
          platform?: string
          start_date?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_commission_rules: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          max_contracts: number | null
          min_contracts: number
          updated_at: string | null
          value_per_contract: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_contracts?: number | null
          min_contracts: number
          updated_at?: string | null
          value_per_contract: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_contracts?: number | null
          min_contracts?: number
          updated_at?: string | null
          value_per_contract?: number
        }
        Relationships: []
      }
      crm_contact_tags: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          tag_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          tag_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          tag_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "crm_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          address: string | null
          birthday: string | null
          city: string | null
          company: string | null
          country: string | null
          created_at: string
          custom_fields: Json | null
          email: string | null
          facebook: string | null
          first_conversion: string | null
          id: string
          job_title: string | null
          last_conversion: string | null
          lead_score: number | null
          linkedin: string | null
          name: string
          notes: string | null
          phone: string | null
          rd_station_id: string | null
          state: string | null
          traffic_campaign: string | null
          traffic_medium: string | null
          traffic_source: string | null
          twitter: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          birthday?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          facebook?: string | null
          first_conversion?: string | null
          id?: string
          job_title?: string | null
          last_conversion?: string | null
          lead_score?: number | null
          linkedin?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          rd_station_id?: string | null
          state?: string | null
          traffic_campaign?: string | null
          traffic_medium?: string | null
          traffic_source?: string | null
          twitter?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          birthday?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          facebook?: string | null
          first_conversion?: string | null
          id?: string
          job_title?: string | null
          last_conversion?: string | null
          lead_score?: number | null
          linkedin?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          rd_station_id?: string | null
          state?: string | null
          traffic_campaign?: string | null
          traffic_medium?: string | null
          traffic_source?: string | null
          twitter?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          website?: string | null
        }
        Relationships: []
      }
      crm_daily_logs: {
        Row: {
          calls_made: number
          contracts_signed: number
          created_at: string
          follow_ups: number
          id: string
          log_date: string
          meetings_held: number
          new_leads: number
          notes: string | null
          proposals_sent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calls_made?: number
          contracts_signed?: number
          created_at?: string
          follow_ups?: number
          id?: string
          log_date?: string
          meetings_held?: number
          new_leads?: number
          notes?: string | null
          proposals_sent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calls_made?: number
          contracts_signed?: number
          created_at?: string
          follow_ups?: number
          id?: string
          log_date?: string
          meetings_held?: number
          new_leads?: number
          notes?: string | null
          proposals_sent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_daily_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_history: {
        Row: {
          changed_by: string | null
          created_at: string
          deal_id: string | null
          from_stage_id: string | null
          id: string
          notes: string | null
          to_stage_id: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          deal_id?: string | null
          from_stage_id?: string | null
          id?: string
          notes?: string | null
          to_stage_id?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          deal_id?: string | null
          from_stage_id?: string | null
          id?: string
          notes?: string | null
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_deal_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_deal_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_stages: {
        Row: {
          created_at: string
          id: string
          is_lost: boolean | null
          is_won: boolean | null
          name: string
          order_index: number
          pipeline_id: string | null
          rd_station_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_lost?: boolean | null
          is_won?: boolean | null
          name: string
          order_index?: number
          pipeline_id?: string | null
          rd_station_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_lost?: boolean | null
          is_won?: boolean | null
          name?: string
          order_index?: number
          pipeline_id?: string | null
          rd_station_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          campaign_name: string | null
          closed_at: string | null
          contact_id: string | null
          created_at: string
          custom_fields: Json | null
          expected_close_date: string | null
          id: string
          loss_reason: string | null
          name: string
          notes: string | null
          owner_id: string | null
          pipeline_id: string | null
          product_name: string | null
          rd_station_id: string | null
          stage_changed_at: string | null
          stage_id: string | null
          star_rating: number | null
          updated_at: string
          value: number | null
          won: boolean | null
        }
        Insert: {
          campaign_name?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          custom_fields?: Json | null
          expected_close_date?: string | null
          id?: string
          loss_reason?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string | null
          product_name?: string | null
          rd_station_id?: string | null
          stage_changed_at?: string | null
          stage_id?: string | null
          star_rating?: number | null
          updated_at?: string
          value?: number | null
          won?: boolean | null
        }
        Update: {
          campaign_name?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          custom_fields?: Json | null
          expected_close_date?: string | null
          id?: string
          loss_reason?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string | null
          product_name?: string | null
          rd_station_id?: string | null
          stage_changed_at?: string | null
          stage_id?: string | null
          star_rating?: number | null
          updated_at?: string
          value?: number | null
          won?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_deal_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_follow_up_reminders: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          notes: string | null
          reminder_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          notes?: string | null
          reminder_date: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          notes?: string | null
          reminder_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_follow_up_reminders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_follow_up_reminders_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_lists: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          filters: Json
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_lead_scoring_rules: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          field_name: string
          field_value: string
          id: string
          is_active: boolean | null
          name: string
          operator: string
          points: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          field_name: string
          field_value: string
          id?: string
          is_active?: boolean | null
          name: string
          operator?: string
          points?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          field_name?: string
          field_value?: string
          id?: string
          is_active?: boolean | null
          name?: string
          operator?: string
          points?: number
          updated_at?: string
        }
        Relationships: []
      }
      crm_notifications: {
        Row: {
          contact_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notifications_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          rd_station_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          rd_station_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          rd_station_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_settings: {
        Row: {
          created_at: string
          id: string
          last_full_sync_at: string | null
          rd_station_sync_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_full_sync_at?: string | null
          rd_station_sync_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_full_sync_at?: string | null
          rd_station_sync_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      crm_sync_log: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string
          error_message: string | null
          id: string
          status: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          status: string
          sync_type: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      crm_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          rd_station_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          rd_station_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          rd_station_id?: string | null
        }
        Relationships: []
      }
      crm_whatsapp_logs: {
        Row: {
          chatguru_message_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          direction: string
          id: string
          message_text: string | null
          message_type: string | null
          phone_number: string
          sent_at: string
          sent_by: string | null
        }
        Insert: {
          chatguru_message_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          direction: string
          id?: string
          message_text?: string | null
          message_type?: string | null
          phone_number: string
          sent_at?: string
          sent_by?: string | null
        }
        Update: {
          chatguru_message_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          direction?: string
          id?: string
          message_text?: string | null
          message_type?: string | null
          phone_number?: string
          sent_at?: string
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_whatsapp_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_whatsapp_logs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_birthday_exclusions: {
        Row: {
          created_at: string
          customer_id: string
          customer_name: string
          excluded_by: string
          id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          customer_name: string
          excluded_by: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          customer_name?: string
          excluded_by?: string
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_digest_logs: {
        Row: {
          created_at: string
          details: Json
          email: string | null
          id: string
          position: string | null
          profile_id: string | null
          reason: string | null
          run_at: string
          run_id: string
          status: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          email?: string | null
          id?: string
          position?: string | null
          profile_id?: string | null
          reason?: string | null
          run_at?: string
          run_id: string
          status: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          email?: string | null
          id?: string
          position?: string | null
          profile_id?: string | null
          reason?: string | null
          run_at?: string
          run_id?: string
          status?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_digest_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      defaulter_exclusions: {
        Row: {
          created_at: string | null
          customer_id: string
          customer_name: string
          excluded_by: string
          id: string
          reason: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          customer_name: string
          excluded_by: string
          id?: string
          reason?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          customer_name?: string
          excluded_by?: string
          id?: string
          reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      defaulter_messages_log: {
        Row: {
          chatguru_message_id: string | null
          created_at: string | null
          customer_id: string
          customer_name: string
          customer_phone: string
          days_overdue: number
          error_message: string | null
          id: string
          message_template: string
          message_text: string
          sent_at: string | null
          sent_by: string
          status: string | null
        }
        Insert: {
          chatguru_message_id?: string | null
          created_at?: string | null
          customer_id: string
          customer_name: string
          customer_phone: string
          days_overdue: number
          error_message?: string | null
          id?: string
          message_template: string
          message_text: string
          sent_at?: string | null
          sent_by: string
          status?: string | null
        }
        Update: {
          chatguru_message_id?: string | null
          created_at?: string | null
          customer_id?: string
          customer_name?: string
          customer_phone?: string
          days_overdue?: number
          error_message?: string | null
          id?: string
          message_template?: string
          message_text?: string
          sent_at?: string | null
          sent_by?: string
          status?: string | null
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean | null
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean | null
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          resend_id: string | null
          sent_at: string | null
          status: string
          subject: string
          template_type: string
          to_email: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template_type: string
          to_email: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_type?: string
          to_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_notification_preferences: {
        Row: {
          created_at: string | null
          id: string
          notify_announcements: boolean | null
          notify_approvals: boolean | null
          notify_birthdays: boolean | null
          notify_crm: boolean | null
          notify_daily_digest: boolean | null
          notify_financial: boolean | null
          notify_forum: boolean | null
          notify_intranet_updates: boolean | null
          notify_messages: boolean | null
          notify_tasks: boolean | null
          notify_vacation: boolean | null
          popup_messages_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notify_announcements?: boolean | null
          notify_approvals?: boolean | null
          notify_birthdays?: boolean | null
          notify_crm?: boolean | null
          notify_daily_digest?: boolean | null
          notify_financial?: boolean | null
          notify_forum?: boolean | null
          notify_intranet_updates?: boolean | null
          notify_messages?: boolean | null
          notify_tasks?: boolean | null
          notify_vacation?: boolean | null
          popup_messages_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notify_announcements?: boolean | null
          notify_approvals?: boolean | null
          notify_birthdays?: boolean | null
          notify_crm?: boolean | null
          notify_daily_digest?: boolean | null
          notify_financial?: boolean | null
          notify_forum?: boolean | null
          notify_intranet_updates?: boolean | null
          notify_messages?: boolean | null
          notify_tasks?: boolean | null
          notify_vacation?: boolean | null
          popup_messages_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      event_gallery: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          event_date: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          event_date: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_photos: {
        Row: {
          caption: string | null
          created_at: string
          event_id: string
          id: string
          photo_url: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_id: string
          id?: string
          photo_url: string
          uploaded_by: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_id?: string
          id?: string
          photo_url?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_gallery"
            referencedColumns: ["id"]
          },
        ]
      }
      favorable_decisions: {
        Row: {
          ai_analysis: Json | null
          client_id: string | null
          client_name: string
          court: string | null
          court_division: string | null
          created_at: string
          created_by: string
          decisao_texto: string | null
          decision_date: string
          decision_link: string | null
          decision_type: string
          evaluation_requested: boolean | null
          id: string
          lawsuit_id: string | null
          materia: string | null
          notify_message: string | null
          notify_team: boolean | null
          observation: string | null
          process_number: string | null
          product_name: string
          regiao: string | null
          resultado: string | null
          reu: string | null
          teams_row_index: number | null
          updated_at: string
          was_evaluated: boolean | null
          was_posted: boolean | null
        }
        Insert: {
          ai_analysis?: Json | null
          client_id?: string | null
          client_name: string
          court?: string | null
          court_division?: string | null
          created_at?: string
          created_by: string
          decisao_texto?: string | null
          decision_date: string
          decision_link?: string | null
          decision_type: string
          evaluation_requested?: boolean | null
          id?: string
          lawsuit_id?: string | null
          materia?: string | null
          notify_message?: string | null
          notify_team?: boolean | null
          observation?: string | null
          process_number?: string | null
          product_name: string
          regiao?: string | null
          resultado?: string | null
          reu?: string | null
          teams_row_index?: number | null
          updated_at?: string
          was_evaluated?: boolean | null
          was_posted?: boolean | null
        }
        Update: {
          ai_analysis?: Json | null
          client_id?: string | null
          client_name?: string
          court?: string | null
          court_division?: string | null
          created_at?: string
          created_by?: string
          decisao_texto?: string | null
          decision_date?: string
          decision_link?: string | null
          decision_type?: string
          evaluation_requested?: boolean | null
          id?: string
          lawsuit_id?: string | null
          materia?: string | null
          notify_message?: string | null
          notify_team?: boolean | null
          observation?: string | null
          process_number?: string | null
          product_name?: string
          regiao?: string | null
          resultado?: string | null
          reu?: string | null
          teams_row_index?: number | null
          updated_at?: string
          was_evaluated?: boolean | null
          was_posted?: boolean | null
        }
        Relationships: []
      }
      feedback_box: {
        Row: {
          created_at: string | null
          id: string
          is_anonymous: boolean | null
          is_read: boolean | null
          message: string
          read_at: string | null
          sender_id: string
          subject: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_anonymous?: boolean | null
          is_read?: boolean | null
          message: string
          read_at?: string | null
          sender_id: string
          subject: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_anonymous?: boolean | null
          is_read?: boolean | null
          message?: string
          read_at?: string | null
          sender_id?: string
          subject?: string
        }
        Relationships: []
      }
      feedback_forwards: {
        Row: {
          feedback_id: string
          forwarded_at: string
          forwarded_by: string
          forwarded_to: string
          id: string
          is_read: boolean
          note: string | null
          read_at: string | null
        }
        Insert: {
          feedback_id: string
          forwarded_at?: string
          forwarded_by: string
          forwarded_to: string
          id?: string
          is_read?: boolean
          note?: string | null
          read_at?: string | null
        }
        Update: {
          feedback_id?: string
          forwarded_at?: string
          forwarded_by?: string
          forwarded_to?: string
          id?: string
          is_read?: boolean
          note?: string | null
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_forwards_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_box"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_replies: {
        Row: {
          created_at: string
          feedback_id: string
          id: string
          message: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          feedback_id: string
          id?: string
          message: string
          sender_id: string
        }
        Update: {
          created_at?: string
          feedback_id?: string
          id?: string
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_replies_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_box"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_alertas: {
        Row: {
          created_at: string | null
          data_alerta: string
          id: string
          lancamento_id: string | null
          lido: boolean | null
          lido_em: string | null
          lido_por: string | null
          mensagem: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          data_alerta: string
          id?: string
          lancamento_id?: string | null
          lido?: boolean | null
          lido_em?: string | null
          lido_por?: string | null
          mensagem: string
          tipo: string
        }
        Update: {
          created_at?: string | null
          data_alerta?: string
          id?: string
          lancamento_id?: string | null
          lido?: boolean | null
          lido_em?: string | null
          lido_por?: string | null
          mensagem?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_alertas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_anexos: {
        Row: {
          created_at: string | null
          id: string
          lancamento_id: string | null
          nome_arquivo: string
          tamanho: number | null
          tipo_arquivo: string | null
          uploaded_by: string | null
          url_arquivo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lancamento_id?: string | null
          nome_arquivo: string
          tamanho?: number | null
          tipo_arquivo?: string | null
          uploaded_by?: string | null
          url_arquivo: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lancamento_id?: string | null
          nome_arquivo?: string
          tamanho?: number | null
          tipo_arquivo?: string | null
          uploaded_by?: string | null
          url_arquivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_anexos_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_aprovacao_config: {
        Row: {
          aprovador_id: string
          ativo: boolean | null
          created_at: string | null
          id: string
          updated_at: string | null
          valor_maximo: number | null
          valor_minimo: number
        }
        Insert: {
          aprovador_id: string
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          valor_maximo?: number | null
          valor_minimo?: number
        }
        Update: {
          aprovador_id?: string
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          valor_maximo?: number | null
          valor_minimo?: number
        }
        Relationships: []
      }
      fin_aprovacoes: {
        Row: {
          aprovador_id: string | null
          created_at: string | null
          id: string
          justificativa: string | null
          lancamento_id: string | null
          respondido_em: string | null
          resposta_aprovador: string | null
          solicitado_em: string | null
          solicitante_id: string
          status: string
          valor_limite: number | null
        }
        Insert: {
          aprovador_id?: string | null
          created_at?: string | null
          id?: string
          justificativa?: string | null
          lancamento_id?: string | null
          respondido_em?: string | null
          resposta_aprovador?: string | null
          solicitado_em?: string | null
          solicitante_id: string
          status?: string
          valor_limite?: number | null
        }
        Update: {
          aprovador_id?: string | null
          created_at?: string | null
          id?: string
          justificativa?: string | null
          lancamento_id?: string | null
          respondido_em?: string | null
          resposta_aprovador?: string | null
          solicitado_em?: string | null
          solicitante_id?: string
          status?: string
          valor_limite?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_aprovacoes_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_auditoria: {
        Row: {
          acao: string
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          registro_id: string
          tabela: string
          usuario_id: string
        }
        Insert: {
          acao: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          registro_id: string
          tabela: string
          usuario_id: string
        }
        Update: {
          acao?: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          registro_id?: string
          tabela?: string
          usuario_id?: string
        }
        Relationships: []
      }
      fin_backups: {
        Row: {
          arquivo_url: string | null
          created_at: string | null
          created_by: string | null
          erro_mensagem: string | null
          id: string
          status: string
          tabelas_incluidas: string[] | null
          tamanho_bytes: number | null
          tipo: string
        }
        Insert: {
          arquivo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          erro_mensagem?: string | null
          id?: string
          status?: string
          tabelas_incluidas?: string[] | null
          tamanho_bytes?: number | null
          tipo: string
        }
        Update: {
          arquivo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          erro_mensagem?: string | null
          id?: string
          status?: string
          tabelas_incluidas?: string[] | null
          tamanho_bytes?: number | null
          tipo?: string
        }
        Relationships: []
      }
      fin_categorias: {
        Row: {
          ativa: boolean | null
          cor: string | null
          created_at: string | null
          descricao: string | null
          grupo: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          grupo?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          grupo?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fin_centros_custo: {
        Row: {
          ativo: boolean | null
          codigo: string | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          responsavel_id: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          responsavel_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          responsavel_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fin_clientes: {
        Row: {
          advbox_id: string | null
          ativo: boolean | null
          cpf_cnpj: string | null
          created_at: string | null
          email: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          advbox_id?: string | null
          ativo?: boolean | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          advbox_id?: string | null
          ativo?: boolean | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fin_conciliacao_itens: {
        Row: {
          conciliacao_id: string
          conciliado: boolean | null
          created_at: string | null
          data_extrato: string | null
          descricao_extrato: string | null
          id: string
          lancamento_id: string | null
          observacao: string | null
          valor_extrato: number | null
        }
        Insert: {
          conciliacao_id: string
          conciliado?: boolean | null
          created_at?: string | null
          data_extrato?: string | null
          descricao_extrato?: string | null
          id?: string
          lancamento_id?: string | null
          observacao?: string | null
          valor_extrato?: number | null
        }
        Update: {
          conciliacao_id?: string
          conciliado?: boolean | null
          created_at?: string | null
          data_extrato?: string | null
          descricao_extrato?: string | null
          id?: string
          lancamento_id?: string | null
          observacao?: string | null
          valor_extrato?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_conciliacao_itens_conciliacao_id_fkey"
            columns: ["conciliacao_id"]
            isOneToOne: false
            referencedRelation: "fin_conciliacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_conciliacao_itens_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_conciliacoes: {
        Row: {
          conciliado_em: string | null
          conciliado_por: string | null
          conta_id: string
          created_at: string | null
          data_conciliacao: string
          diferenca: number
          id: string
          observacoes: string | null
          saldo_banco: number
          saldo_sistema: number
          status: string | null
        }
        Insert: {
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_id: string
          created_at?: string | null
          data_conciliacao: string
          diferenca: number
          id?: string
          observacoes?: string | null
          saldo_banco: number
          saldo_sistema: number
          status?: string | null
        }
        Update: {
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_id?: string
          created_at?: string | null
          data_conciliacao?: string
          diferenca?: number
          id?: string
          observacoes?: string | null
          saldo_banco?: number
          saldo_sistema?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_conciliacoes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "fin_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_configuracoes: {
        Row: {
          chave: string
          descricao: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
          valor: Json | null
        }
        Insert: {
          chave: string
          descricao?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          valor?: Json | null
        }
        Update: {
          chave?: string
          descricao?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          valor?: Json | null
        }
        Relationships: []
      }
      fin_contas: {
        Row: {
          agencia: string | null
          ativa: boolean | null
          banco: string | null
          cor: string | null
          created_at: string | null
          created_by: string | null
          icone: string | null
          id: string
          nome: string
          numero_conta: string | null
          saldo_atual: number | null
          saldo_inicial: number | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          agencia?: string | null
          ativa?: boolean | null
          banco?: string | null
          cor?: string | null
          created_at?: string | null
          created_by?: string | null
          icone?: string | null
          id?: string
          nome: string
          numero_conta?: string | null
          saldo_atual?: number | null
          saldo_inicial?: number | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          agencia?: string | null
          ativa?: boolean | null
          banco?: string | null
          cor?: string | null
          created_at?: string | null
          created_by?: string | null
          icone?: string | null
          id?: string
          nome?: string
          numero_conta?: string | null
          saldo_atual?: number | null
          saldo_inicial?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fin_contratos: {
        Row: {
          advbox_customer_id: string | null
          advbox_lawsuit_id: string | null
          advbox_sync_error: string | null
          advbox_sync_status: string | null
          assinado_em: string | null
          assinatura_status: string | null
          client_cpf: string | null
          client_email: string | null
          client_id: number
          client_name: string
          client_phone: string | null
          contract_file_url: string | null
          created_at: string
          created_by: string | null
          data_vencimento: string | null
          descricao_exito: string | null
          forma_pagamento: string | null
          id: string
          numero_parcelas: number | null
          numero_processo: string | null
          objeto_contrato: string | null
          product_name: string
          qualification: string | null
          status: string | null
          status_processo: string | null
          tem_honorarios_exito: boolean | null
          updated_at: string
          valor_entrada: number | null
          valor_parcela: number | null
          valor_total: number | null
          zapsign_document_id: string | null
        }
        Insert: {
          advbox_customer_id?: string | null
          advbox_lawsuit_id?: string | null
          advbox_sync_error?: string | null
          advbox_sync_status?: string | null
          assinado_em?: string | null
          assinatura_status?: string | null
          client_cpf?: string | null
          client_email?: string | null
          client_id: number
          client_name: string
          client_phone?: string | null
          contract_file_url?: string | null
          created_at?: string
          created_by?: string | null
          data_vencimento?: string | null
          descricao_exito?: string | null
          forma_pagamento?: string | null
          id?: string
          numero_parcelas?: number | null
          numero_processo?: string | null
          objeto_contrato?: string | null
          product_name: string
          qualification?: string | null
          status?: string | null
          status_processo?: string | null
          tem_honorarios_exito?: boolean | null
          updated_at?: string
          valor_entrada?: number | null
          valor_parcela?: number | null
          valor_total?: number | null
          zapsign_document_id?: string | null
        }
        Update: {
          advbox_customer_id?: string | null
          advbox_lawsuit_id?: string | null
          advbox_sync_error?: string | null
          advbox_sync_status?: string | null
          assinado_em?: string | null
          assinatura_status?: string | null
          client_cpf?: string | null
          client_email?: string | null
          client_id?: number
          client_name?: string
          client_phone?: string | null
          contract_file_url?: string | null
          created_at?: string
          created_by?: string | null
          data_vencimento?: string | null
          descricao_exito?: string | null
          forma_pagamento?: string | null
          id?: string
          numero_parcelas?: number | null
          numero_processo?: string | null
          objeto_contrato?: string | null
          product_name?: string
          qualification?: string | null
          status?: string | null
          status_processo?: string | null
          tem_honorarios_exito?: boolean | null
          updated_at?: string
          valor_entrada?: number | null
          valor_parcela?: number | null
          valor_total?: number | null
          zapsign_document_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_contratos_zapsign_document_id_fkey"
            columns: ["zapsign_document_id"]
            isOneToOne: false
            referencedRelation: "zapsign_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_dashboard_cache: {
        Row: {
          dashboard_data: Json | null
          id: string
          periodo: string | null
          updated_at: string | null
        }
        Insert: {
          dashboard_data?: Json | null
          id?: string
          periodo?: string | null
          updated_at?: string | null
        }
        Update: {
          dashboard_data?: Json | null
          id?: string
          periodo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fin_importacao_itens: {
        Row: {
          created_at: string | null
          data_transacao: string
          descricao: string
          id: string
          identificador_banco: string | null
          importacao_id: string | null
          lancamento_id: string | null
          status: string | null
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          data_transacao: string
          descricao: string
          id?: string
          identificador_banco?: string | null
          importacao_id?: string | null
          lancamento_id?: string | null
          status?: string | null
          tipo: string
          valor: number
        }
        Update: {
          created_at?: string | null
          data_transacao?: string
          descricao?: string
          id?: string
          identificador_banco?: string | null
          importacao_id?: string | null
          lancamento_id?: string | null
          status?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_importacao_itens_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "fin_importacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_importacao_itens_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_importacoes: {
        Row: {
          conta_id: string | null
          created_at: string | null
          erro_mensagem: string | null
          id: string
          imported_by: string | null
          nome_arquivo: string
          registros_duplicados: number | null
          registros_importados: number | null
          status: string | null
          tipo_arquivo: string
          total_registros: number | null
        }
        Insert: {
          conta_id?: string | null
          created_at?: string | null
          erro_mensagem?: string | null
          id?: string
          imported_by?: string | null
          nome_arquivo: string
          registros_duplicados?: number | null
          registros_importados?: number | null
          status?: string | null
          tipo_arquivo: string
          total_registros?: number | null
        }
        Update: {
          conta_id?: string | null
          created_at?: string | null
          erro_mensagem?: string | null
          id?: string
          imported_by?: string | null
          nome_arquivo?: string
          registros_duplicados?: number | null
          registros_importados?: number | null
          status?: string | null
          tipo_arquivo?: string
          total_registros?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_importacoes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "fin_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_lancamentos: {
        Row: {
          a_reembolsar: boolean | null
          advbox_transaction_id: string | null
          anexo_url: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          cliente_id: string | null
          cliente_nome: string | null
          conciliacao_id: string | null
          conciliado: boolean | null
          conciliado_em: string | null
          conta_destino_id: string | null
          conta_origem_id: string | null
          created_at: string | null
          created_by: string
          data_lancamento: string
          data_pagamento: string | null
          data_reembolso: string | null
          data_vencimento: string | null
          deleted_at: string | null
          descricao: string
          id: string
          lancamento_pai_id: string | null
          numero_documento: string | null
          observacoes: string | null
          origem: string | null
          parcela_atual: number | null
          produto_id: string | null
          produto_rd_station: string | null
          recorrencia_fim: string | null
          recorrencia_id: string | null
          recorrencia_tipo: string | null
          recorrente: boolean | null
          reembolsada: boolean | null
          requer_aprovacao: boolean | null
          setor_id: string | null
          status: string | null
          status_aprovacao: string | null
          subcategoria_id: string | null
          tipo: string
          total_parcelas: number | null
          updated_at: string | null
          updated_by: string | null
          valor: number
        }
        Insert: {
          a_reembolsar?: boolean | null
          advbox_transaction_id?: string | null
          anexo_url?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          conciliacao_id?: string | null
          conciliado?: boolean | null
          conciliado_em?: string | null
          conta_destino_id?: string | null
          conta_origem_id?: string | null
          created_at?: string | null
          created_by: string
          data_lancamento?: string
          data_pagamento?: string | null
          data_reembolso?: string | null
          data_vencimento?: string | null
          deleted_at?: string | null
          descricao: string
          id?: string
          lancamento_pai_id?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          origem?: string | null
          parcela_atual?: number | null
          produto_id?: string | null
          produto_rd_station?: string | null
          recorrencia_fim?: string | null
          recorrencia_id?: string | null
          recorrencia_tipo?: string | null
          recorrente?: boolean | null
          reembolsada?: boolean | null
          requer_aprovacao?: boolean | null
          setor_id?: string | null
          status?: string | null
          status_aprovacao?: string | null
          subcategoria_id?: string | null
          tipo: string
          total_parcelas?: number | null
          updated_at?: string | null
          updated_by?: string | null
          valor: number
        }
        Update: {
          a_reembolsar?: boolean | null
          advbox_transaction_id?: string | null
          anexo_url?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          conciliacao_id?: string | null
          conciliado?: boolean | null
          conciliado_em?: string | null
          conta_destino_id?: string | null
          conta_origem_id?: string | null
          created_at?: string | null
          created_by?: string
          data_lancamento?: string
          data_pagamento?: string | null
          data_reembolso?: string | null
          data_vencimento?: string | null
          deleted_at?: string | null
          descricao?: string
          id?: string
          lancamento_pai_id?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          origem?: string | null
          parcela_atual?: number | null
          produto_id?: string | null
          produto_rd_station?: string | null
          recorrencia_fim?: string | null
          recorrencia_id?: string | null
          recorrencia_tipo?: string | null
          recorrente?: boolean | null
          reembolsada?: boolean | null
          requer_aprovacao?: boolean | null
          setor_id?: string | null
          status?: string | null
          status_aprovacao?: string | null
          subcategoria_id?: string | null
          tipo?: string
          total_parcelas?: number | null
          updated_at?: string | null
          updated_by?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_lancamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fin_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "fin_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "fin_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "fin_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_conta_origem_id_fkey"
            columns: ["conta_origem_id"]
            isOneToOne: false
            referencedRelation: "fin_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_lancamento_pai_id_fkey"
            columns: ["lancamento_pai_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_recorrencia_id_fkey"
            columns: ["recorrencia_id"]
            isOneToOne: false
            referencedRelation: "fin_recorrencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "fin_setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "fin_subcategorias"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_metas: {
        Row: {
          ano: number
          categoria_id: string | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          id: string
          mes: number
          tipo: string
          updated_at: string | null
          valor_meta: number
        }
        Insert: {
          ano: number
          categoria_id?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          mes: number
          tipo: string
          updated_at?: string | null
          valor_meta: number
        }
        Update: {
          ano?: number
          categoria_id?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          id?: string
          mes?: number
          tipo?: string
          updated_at?: string | null
          valor_meta?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_metas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fin_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_orcamentos: {
        Row: {
          ano: number
          categoria_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          mes: number
          observacao: string | null
          updated_at: string | null
          valor_planejado: number
        }
        Insert: {
          ano: number
          categoria_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          mes: number
          observacao?: string | null
          updated_at?: string | null
          valor_planejado?: number
        }
        Update: {
          ano?: number
          categoria_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          mes?: number
          observacao?: string | null
          updated_at?: string | null
          valor_planejado?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_orcamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fin_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_previsoes: {
        Row: {
          confianca: number | null
          created_at: string | null
          id: string
          modelo_utilizado: string | null
          parametros: Json | null
          periodo_fim: string
          periodo_inicio: string
          tipo: string
          updated_at: string | null
          valor_previsto: number
          valor_realizado: number | null
        }
        Insert: {
          confianca?: number | null
          created_at?: string | null
          id?: string
          modelo_utilizado?: string | null
          parametros?: Json | null
          periodo_fim: string
          periodo_inicio: string
          tipo: string
          updated_at?: string | null
          valor_previsto: number
          valor_realizado?: number | null
        }
        Update: {
          confianca?: number | null
          created_at?: string | null
          id?: string
          modelo_utilizado?: string | null
          parametros?: Json | null
          periodo_fim?: string
          periodo_inicio?: string
          tipo?: string
          updated_at?: string | null
          valor_previsto?: number
          valor_realizado?: number | null
        }
        Relationships: []
      }
      fin_recorrencias: {
        Row: {
          ativo: boolean | null
          categoria_id: string | null
          cliente_id: string | null
          conta_id: string | null
          created_at: string | null
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string
          dia_vencimento: number | null
          frequencia: string
          id: string
          proxima_geracao: string | null
          setor_id: string | null
          subcategoria_id: string | null
          tipo: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          ativo?: boolean | null
          categoria_id?: string | null
          cliente_id?: string | null
          conta_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fim?: string | null
          data_inicio: string
          descricao: string
          dia_vencimento?: number | null
          frequencia: string
          id?: string
          proxima_geracao?: string | null
          setor_id?: string | null
          subcategoria_id?: string | null
          tipo: string
          updated_at?: string | null
          valor: number
        }
        Update: {
          ativo?: boolean | null
          categoria_id?: string | null
          cliente_id?: string | null
          conta_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string
          dia_vencimento?: number | null
          frequencia?: string
          id?: string
          proxima_geracao?: string | null
          setor_id?: string | null
          subcategoria_id?: string | null
          tipo?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_recorrencias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fin_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_recorrencias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "fin_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_recorrencias_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "fin_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_recorrencias_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "fin_setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_recorrencias_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "fin_subcategorias"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_setores: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      fin_subcategorias: {
        Row: {
          ativa: boolean | null
          categoria_id: string
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean | null
          categoria_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean | null
          categoria_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_subcategorias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fin_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          period: string
          threshold_value: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          period: string
          threshold_value: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          period?: string
          threshold_value?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      financial_goals: {
        Row: {
          created_at: string | null
          goal_type: string
          id: string
          is_active: boolean | null
          month: number | null
          quarter: number | null
          target_value: number
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string | null
          goal_type: string
          id?: string
          is_active?: boolean | null
          month?: number | null
          quarter?: number | null
          target_value: number
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          created_at?: string | null
          goal_type?: string
          id?: string
          is_active?: boolean | null
          month?: number | null
          quarter?: number | null
          target_value?: number
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      food_items: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          normalized_name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          normalized_name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          normalized_name?: string
        }
        Relationships: []
      }
      food_purchase_status: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          food_item_id: string
          id: string
          notes: string | null
          status: string
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          food_item_id: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          food_item_id?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_purchase_status_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
        ]
      }
      food_suggestions: {
        Row: {
          created_at: string
          food_item_id: string
          id: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          food_item_id: string
          id?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          food_item_id?: string
          id?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_suggestions_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores_uteis: {
        Row: {
          categoria: string | null
          created_at: string
          created_by: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      forum_notifications: {
        Row: {
          created_at: string
          id: string
          mentioned_by: string
          post_id: string
          read: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentioned_by: string
          post_id: string
          read?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mentioned_by?: string
          post_id?: string
          read?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_forum_posts_created_by_profiles"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "forum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_topics: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          last_post_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          last_post_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          last_post_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_forum_topics_created_by_profiles"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      home_office_schedules: {
        Row: {
          created_at: string
          created_by: string
          day_of_week: number
          id: string
          month: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by: string
          day_of_week: number
          id?: string
          month: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string
          day_of_week?: number
          id?: string
          month?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      home_office_swap_requests: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          requester_original_date: string
          responded_at: string | null
          status: string
          target_id: string
          target_original_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          requester_original_date: string
          responded_at?: string | null
          status?: string
          target_id: string
          target_original_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          requester_original_date?: string
          responded_at?: string | null
          status?: string
          target_id?: string
          target_original_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      informal_vacation_records: {
        Row: {
          colaborador_id: string
          created_at: string
          created_by: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          dias: number
          id: string
          observacoes: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          created_by: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          dias: number
          id?: string
          observacoes?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          created_by?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          dias?: number
          id?: string
          observacoes?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "informal_vacation_records_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      initial_fee_templates: {
        Row: {
          created_at: string
          descricao: string | null
          forma_pagamento: string | null
          forma_pagamento_entrada: string | null
          forma_pagamento_parcelas: string | null
          id: string
          is_default: boolean | null
          name: string
          numero_parcelas: string | null
          tem_entrada: boolean | null
          tipo_honorarios: string
          updated_at: string
          user_id: string | null
          valor_entrada: string | null
          valor_parcela: string | null
          valor_total: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          forma_pagamento?: string | null
          forma_pagamento_entrada?: string | null
          forma_pagamento_parcelas?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          numero_parcelas?: string | null
          tem_entrada?: boolean | null
          tipo_honorarios?: string
          updated_at?: string
          user_id?: string | null
          valor_entrada?: string | null
          valor_parcela?: string | null
          valor_total?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          forma_pagamento?: string | null
          forma_pagamento_entrada?: string | null
          forma_pagamento_parcelas?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          numero_parcelas?: string | null
          tem_entrada?: boolean | null
          tipo_honorarios?: string
          updated_at?: string
          user_id?: string | null
          valor_entrada?: string | null
          valor_parcela?: string | null
          valor_total?: string | null
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          created_at: string
          id: string
          integration_id: string
          is_active: boolean
          last_tested_at: string | null
          test_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          integration_id: string
          is_active?: boolean
          last_tested_at?: string | null
          test_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          integration_id?: string
          is_active?: boolean
          last_tested_at?: string | null
          test_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      integration_sync_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          source_id: string
          source_table: string
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          source_id: string
          source_table: string
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          source_id?: string
          source_table?: string
          target_id?: string | null
          target_table?: string
        }
        Relationships: []
      }
      intranet_agent_conversations: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intranet_agent_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "intranet_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      intranet_agent_files: {
        Row: {
          agent_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intranet_agent_files_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "intranet_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      intranet_agent_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "intranet_agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "intranet_agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      intranet_agents: {
        Row: {
          card_color: string | null
          created_at: string
          created_by: string
          data_access: string[] | null
          function_role: string | null
          icon_emoji: string
          id: string
          instructions: string
          is_active: boolean
          model: string
          name: string
          objective: string
          updated_at: string
        }
        Insert: {
          card_color?: string | null
          created_at?: string
          created_by: string
          data_access?: string[] | null
          function_role?: string | null
          icon_emoji?: string
          id?: string
          instructions: string
          is_active?: boolean
          model?: string
          name: string
          objective: string
          updated_at?: string
        }
        Update: {
          card_color?: string | null
          created_at?: string
          created_by?: string
          data_access?: string[] | null
          function_role?: string | null
          icon_emoji?: string
          id?: string
          instructions?: string
          is_active?: boolean
          model?: string
          name?: string
          objective?: string
          updated_at?: string
        }
        Relationships: []
      }
      intranet_update_reads: {
        Row: {
          id: string
          read_at: string
          update_id: string
          user_id: string
        }
        Insert: {
          id?: string
          read_at?: string
          update_id: string
          user_id: string
        }
        Update: {
          id?: string
          read_at?: string
          update_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intranet_update_reads_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "intranet_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      intranet_updates: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string
          id: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      jurisprudence_searches: {
        Row: {
          created_at: string
          id: string
          query: string
          response: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          response: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          response?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jurisprudence_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_product_mappings: {
        Row: {
          created_at: string
          created_by: string
          id: string
          product_name: string
          updated_at: string
          url_pattern: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          product_name: string
          updated_at?: string
          url_pattern: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          product_name?: string
          updated_at?: string
          url_pattern?: string
        }
        Relationships: []
      }
      lead_capture_forms: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean | null
          name: string
          redirect_to_whatsapp: boolean | null
          updated_at: string
          whatsapp_message: string | null
          whatsapp_number: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean | null
          name: string
          redirect_to_whatsapp?: boolean | null
          updated_at?: string
          whatsapp_message?: string | null
          whatsapp_number: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean | null
          name?: string
          redirect_to_whatsapp?: boolean | null
          updated_at?: string
          whatsapp_message?: string | null
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_capture_forms_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "utm_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_publications: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          platform: string
          scheduled_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          platform?: string
          scheduled_date: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          platform?: string
          scheduled_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_publications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "crm_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_room_bookings: {
        Row: {
          booking_date: string
          created_at: string
          description: string | null
          end_time: string
          id: string
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_date: string
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_date?: string
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_favorites: {
        Row: {
          created_at: string | null
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_favorites_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          is_edited: boolean | null
          reply_to_id: string | null
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads_ai_analyses: {
        Row: {
          analysis_text: string
          campaigns_count: number | null
          created_at: string
          date_from: string | null
          date_to: string | null
          id: string
          leads_count: number | null
          model_used: string | null
          total_spend: number | null
          user_id: string
        }
        Insert: {
          analysis_text: string
          campaigns_count?: number | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          id?: string
          leads_count?: number | null
          model_used?: string | null
          total_spend?: number | null
          user_id: string
        }
        Update: {
          analysis_text?: string
          campaigns_count?: number | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          id?: string
          leads_count?: number | null
          model_used?: string | null
          total_spend?: number | null
          user_id?: string
        }
        Relationships: []
      }
      meta_ads_config: {
        Row: {
          access_token: string
          account_name: string | null
          ad_account_id: string
          created_at: string
          id: string
          instagram_account_id: string | null
          is_active: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_name?: string | null
          ad_account_id: string
          created_at?: string
          id?: string
          instagram_account_id?: string | null
          is_active?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_name?: string | null
          ad_account_id?: string
          created_at?: string
          id?: string
          instagram_account_id?: string | null
          is_active?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mood_surveys: {
        Row: {
          created_at: string
          id: string
          mood: string
          observacoes: string | null
          survey_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood: string
          observacoes?: string | null
          survey_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood?: string
          observacoes?: string | null
          survey_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_surveys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_translations: {
        Row: {
          created_at: string | null
          id: string
          original_title: string
          suggested_by_ai: boolean | null
          translated_text: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          original_title: string
          suggested_by_ai?: boolean | null
          translated_text?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          original_title?: string
          suggested_by_ai?: boolean | null
          translated_text?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      objeto_contrato_templates: {
        Row: {
          created_at: string
          description: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      onboarding_materials: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          file_url: string
          id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          description?: string | null
          file_url: string
          id?: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          file_url?: string
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      parceiros: {
        Row: {
          ativo: boolean | null
          created_at: string
          created_by: string | null
          data_cadastro: string
          data_inativacao: string | null
          email: string | null
          id: string
          motivo_inativacao: string | null
          nome_completo: string
          nome_escritorio: string | null
          observacoes: string | null
          ranking: number | null
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          created_by?: string | null
          data_cadastro?: string
          data_inativacao?: string | null
          email?: string | null
          id?: string
          motivo_inativacao?: string | null
          nome_completo: string
          nome_escritorio?: string | null
          observacoes?: string | null
          ranking?: number | null
          telefone?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          created_by?: string | null
          data_cadastro?: string
          data_inativacao?: string | null
          email?: string | null
          id?: string
          motivo_inativacao?: string | null
          nome_completo?: string
          nome_escritorio?: string | null
          observacoes?: string | null
          ranking?: number | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      parceiros_areas: {
        Row: {
          area_id: string
          created_at: string
          id: string
          parceiro_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          id?: string
          parceiro_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          id?: string
          parceiro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parceiros_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "parceiros_areas_atuacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiros_areas_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiros_areas_atuacao: {
        Row: {
          ativo: boolean | null
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      parceiros_indicacoes: {
        Row: {
          area_atuacao_id: string | null
          created_at: string
          created_by: string | null
          data_indicacao: string
          descricao_caso: string | null
          forma_pagamento: string | null
          id: string
          nome_cliente: string
          numero_parcelas: number | null
          observacoes: string | null
          pago_no_ato: boolean | null
          parceiro_id: string
          percentual_comissao: number | null
          status: string | null
          tipo_indicacao: string
          updated_at: string
          valor_comissao: number | null
          valor_liquido_escritorio: number | null
          valor_total_causa: number | null
        }
        Insert: {
          area_atuacao_id?: string | null
          created_at?: string
          created_by?: string | null
          data_indicacao?: string
          descricao_caso?: string | null
          forma_pagamento?: string | null
          id?: string
          nome_cliente: string
          numero_parcelas?: number | null
          observacoes?: string | null
          pago_no_ato?: boolean | null
          parceiro_id: string
          percentual_comissao?: number | null
          status?: string | null
          tipo_indicacao: string
          updated_at?: string
          valor_comissao?: number | null
          valor_liquido_escritorio?: number | null
          valor_total_causa?: number | null
        }
        Update: {
          area_atuacao_id?: string | null
          created_at?: string
          created_by?: string | null
          data_indicacao?: string
          descricao_caso?: string | null
          forma_pagamento?: string | null
          id?: string
          nome_cliente?: string
          numero_parcelas?: number | null
          observacoes?: string | null
          pago_no_ato?: boolean | null
          parceiro_id?: string
          percentual_comissao?: number | null
          status?: string | null
          tipo_indicacao?: string
          updated_at?: string
          valor_comissao?: number | null
          valor_liquido_escritorio?: number | null
          valor_total_causa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parceiros_indicacoes_area_atuacao_id_fkey"
            columns: ["area_atuacao_id"]
            isOneToOne: false
            referencedRelation: "parceiros_areas_atuacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiros_indicacoes_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiros_pagamentos: {
        Row: {
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao_abatimentos: string | null
          forma_pagamento: string | null
          id: string
          indicacao_id: string | null
          lancamento_financeiro_id: string | null
          observacoes: string | null
          parceiro_id: string
          parcela_atual: number | null
          status: string | null
          tipo: string
          total_parcelas: number | null
          updated_at: string
          valor: number
          valor_abatimentos: number | null
          valor_bruto: number | null
          valor_liquido: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao_abatimentos?: string | null
          forma_pagamento?: string | null
          id?: string
          indicacao_id?: string | null
          lancamento_financeiro_id?: string | null
          observacoes?: string | null
          parceiro_id: string
          parcela_atual?: number | null
          status?: string | null
          tipo: string
          total_parcelas?: number | null
          updated_at?: string
          valor: number
          valor_abatimentos?: number | null
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao_abatimentos?: string | null
          forma_pagamento?: string | null
          id?: string
          indicacao_id?: string | null
          lancamento_financeiro_id?: string | null
          observacoes?: string | null
          parceiro_id?: string
          parcela_atual?: number | null
          status?: string | null
          tipo?: string
          total_parcelas?: number | null
          updated_at?: string
          valor?: number
          valor_abatimentos?: number | null
          valor_bruto?: number | null
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parceiros_pagamentos_indicacao_id_fkey"
            columns: ["indicacao_id"]
            isOneToOne: false
            referencedRelation: "parceiros_indicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiros_pagamentos_lancamento_financeiro_id_fkey"
            columns: ["lancamento_financeiro_id"]
            isOneToOne: false
            referencedRelation: "fin_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiros_pagamentos_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      position_permission_defaults: {
        Row: {
          created_at: string
          id: string
          is_admin_group: boolean | null
          perm_admin_requests: string
          perm_advbox: string
          perm_agentes_ia: string | null
          perm_aniversarios_clientes: string | null
          perm_announcements: string
          perm_arquivos_teams: string | null
          perm_assistente_ia: string | null
          perm_birthdays: string
          perm_caixinha_desabafo: string | null
          perm_collection: string
          perm_contratos: string | null
          perm_copa_cozinha: string
          perm_crm: string | null
          perm_decisoes: string | null
          perm_documents: string
          perm_events: string
          perm_financial: string
          perm_forum: string
          perm_historico_pagamentos: string | null
          perm_home_office: string
          perm_integracoes: string | null
          perm_jurisprudencia: string | null
          perm_lead_tracking: string
          perm_mensagens: string | null
          perm_onboarding: string
          perm_parceiros: string | null
          perm_payroll: string | null
          perm_processos: string | null
          perm_publicacoes: string | null
          perm_recruitment: string
          perm_rota_doc: string | null
          perm_sala_reuniao: string | null
          perm_setor_comercial: string | null
          perm_sobre_escritorio: string | null
          perm_suggestions: string
          perm_tarefas_advbox: string | null
          perm_task_rules: string
          perm_teams: string
          perm_totp: string
          perm_users: string
          perm_utm_generator: string | null
          perm_vacation: string
          position: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin_group?: boolean | null
          perm_admin_requests?: string
          perm_advbox?: string
          perm_agentes_ia?: string | null
          perm_aniversarios_clientes?: string | null
          perm_announcements?: string
          perm_arquivos_teams?: string | null
          perm_assistente_ia?: string | null
          perm_birthdays?: string
          perm_caixinha_desabafo?: string | null
          perm_collection?: string
          perm_contratos?: string | null
          perm_copa_cozinha?: string
          perm_crm?: string | null
          perm_decisoes?: string | null
          perm_documents?: string
          perm_events?: string
          perm_financial?: string
          perm_forum?: string
          perm_historico_pagamentos?: string | null
          perm_home_office?: string
          perm_integracoes?: string | null
          perm_jurisprudencia?: string | null
          perm_lead_tracking?: string
          perm_mensagens?: string | null
          perm_onboarding?: string
          perm_parceiros?: string | null
          perm_payroll?: string | null
          perm_processos?: string | null
          perm_publicacoes?: string | null
          perm_recruitment?: string
          perm_rota_doc?: string | null
          perm_sala_reuniao?: string | null
          perm_setor_comercial?: string | null
          perm_sobre_escritorio?: string | null
          perm_suggestions?: string
          perm_tarefas_advbox?: string | null
          perm_task_rules?: string
          perm_teams?: string
          perm_totp?: string
          perm_users?: string
          perm_utm_generator?: string | null
          perm_vacation?: string
          position: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin_group?: boolean | null
          perm_admin_requests?: string
          perm_advbox?: string
          perm_agentes_ia?: string | null
          perm_aniversarios_clientes?: string | null
          perm_announcements?: string
          perm_arquivos_teams?: string | null
          perm_assistente_ia?: string | null
          perm_birthdays?: string
          perm_caixinha_desabafo?: string | null
          perm_collection?: string
          perm_contratos?: string | null
          perm_copa_cozinha?: string
          perm_crm?: string | null
          perm_decisoes?: string | null
          perm_documents?: string
          perm_events?: string
          perm_financial?: string
          perm_forum?: string
          perm_historico_pagamentos?: string | null
          perm_home_office?: string
          perm_integracoes?: string | null
          perm_jurisprudencia?: string | null
          perm_lead_tracking?: string
          perm_mensagens?: string | null
          perm_onboarding?: string
          perm_parceiros?: string | null
          perm_payroll?: string | null
          perm_processos?: string | null
          perm_publicacoes?: string | null
          perm_recruitment?: string
          perm_rota_doc?: string | null
          perm_sala_reuniao?: string | null
          perm_setor_comercial?: string | null
          perm_sobre_escritorio?: string | null
          perm_suggestions?: string
          perm_tarefas_advbox?: string | null
          perm_task_rules?: string
          perm_teams?: string
          perm_totp?: string
          perm_users?: string
          perm_utm_generator?: string | null
          perm_vacation?: string
          position?: string
          updated_at?: string
        }
        Relationships: []
      }
      prazo_verificacoes: {
        Row: {
          advbox_task_id: string
          created_at: string | null
          id: string
          observacoes: string | null
          status: string | null
          verificado_em: string | null
          verificado_por: string | null
        }
        Insert: {
          advbox_task_id: string
          created_at?: string | null
          id?: string
          observacoes?: string | null
          status?: string | null
          verificado_em?: string | null
          verificado_por?: string | null
        }
        Update: {
          advbox_task_id?: string
          created_at?: string | null
          id?: string
          observacoes?: string | null
          status?: string | null
          verificado_em?: string | null
          verificado_por?: string | null
        }
        Relationships: []
      }
      prazos_manuais: {
        Row: {
          advogado_responsavel: string | null
          cliente_advbox_id: number | null
          cliente_nome: string
          created_at: string | null
          created_by: string | null
          id: string
          observacoes: string | null
          prazo_fatal: string | null
          prazo_interno: string | null
          process_number: string | null
          status: string | null
          task_type: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          advogado_responsavel?: string | null
          cliente_advbox_id?: number | null
          cliente_nome: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          observacoes?: string | null
          prazo_fatal?: string | null
          prazo_interno?: string | null
          process_number?: string | null
          status?: string | null
          task_type: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          advogado_responsavel?: string | null
          cliente_advbox_id?: number | null
          cliente_nome?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          observacoes?: string | null
          prazo_fatal?: string | null
          prazo_interno?: string | null
          process_number?: string | null
          status?: string | null
          task_type?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      procuracao_drafts: {
        Row: {
          client_id: number
          client_name: string | null
          created_at: string | null
          id: string
          poderes_especiais: string | null
          qualification: string | null
          tem_poderes_especiais: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_id: number
          client_name?: string | null
          created_at?: string | null
          id?: string
          poderes_especiais?: string | null
          qualification?: string | null
          tem_poderes_especiais?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: number
          client_name?: string | null
          created_at?: string | null
          id?: string
          poderes_especiais?: string | null
          qualification?: string | null
          tem_poderes_especiais?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      product_template_associations: {
        Row: {
          contra_partida_template_id: string | null
          created_at: string
          id: string
          objeto_contrato_template_id: string | null
          product_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contra_partida_template_id?: string | null
          created_at?: string
          id?: string
          objeto_contrato_template_id?: string | null
          product_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contra_partida_template_id?: string | null
          created_at?: string
          id?: string
          objeto_contrato_template_id?: string | null
          product_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_template_associations_contra_partida_template_id_fkey"
            columns: ["contra_partida_template_id"]
            isOneToOne: false
            referencedRelation: "contra_partida_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_template_associations_objeto_contrato_template_id_fkey"
            columns: ["objeto_contrato_template_id"]
            isOneToOne: false
            referencedRelation: "objeto_contrato_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          birth_date: string | null
          cargo_id: string | null
          contrato_associado_registrado: boolean | null
          cpf: string | null
          created_at: string
          email: string
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_estado: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          full_name: string
          id: string
          is_active: boolean
          is_suspended: boolean
          join_date: string | null
          oab_number: string | null
          oab_state: string | null
          perfil_completo: boolean | null
          position: Database["public"]["Enums"]["position_type"] | null
          salario: number | null
          suspended_at: string | null
          suspended_reason: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          cargo_id?: string | null
          contrato_associado_registrado?: boolean | null
          cpf?: string | null
          created_at?: string
          email: string
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          full_name: string
          id: string
          is_active?: boolean
          is_suspended?: boolean
          join_date?: string | null
          oab_number?: string | null
          oab_state?: string | null
          perfil_completo?: boolean | null
          position?: Database["public"]["Enums"]["position_type"] | null
          salario?: number | null
          suspended_at?: string | null
          suspended_reason?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          cargo_id?: string | null
          contrato_associado_registrado?: boolean | null
          cpf?: string | null
          created_at?: string
          email?: string
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_suspended?: boolean
          join_date?: string | null
          oab_number?: string | null
          oab_state?: string | null
          perfil_completo?: boolean | null
          position?: Database["public"]["Enums"]["position_type"] | null
          salario?: number | null
          suspended_at?: string | null
          suspended_reason?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_cargo"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "rh_cargos"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacoes_dje: {
        Row: {
          conteudo: string | null
          created_at: string
          data_disponibilizacao: string | null
          data_publicacao: string | null
          destinatario: string | null
          hash: string | null
          id: string
          meio: string | null
          nome_advogado: string | null
          numero_comunicacao: string | null
          numero_processo: string
          raw_data: Json | null
          siglatribunal: string | null
          tipo_comunicacao: string | null
          tribunal: string | null
          updated_at: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          destinatario?: string | null
          hash?: string | null
          id?: string
          meio?: string | null
          nome_advogado?: string | null
          numero_comunicacao?: string | null
          numero_processo: string
          raw_data?: Json | null
          siglatribunal?: string | null
          tipo_comunicacao?: string | null
          tribunal?: string | null
          updated_at?: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          destinatario?: string | null
          hash?: string | null
          id?: string
          meio?: string | null
          nome_advogado?: string | null
          numero_comunicacao?: string | null
          numero_processo?: string
          raw_data?: Json | null
          siglatribunal?: string | null
          tipo_comunicacao?: string | null
          tribunal?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      publicacoes_dje_reads: {
        Row: {
          id: string
          publicacao_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          publicacao_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          publicacao_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_dje_reads_publicacao_id_fkey"
            columns: ["publicacao_id"]
            isOneToOne: false
            referencedRelation: "publicacoes_dje"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_reads: {
        Row: {
          created_at: string
          id: string
          lawsuit_id: number
          movement_date: string
          movement_title: string
          read_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lawsuit_id: number
          movement_date: string
          movement_title: string
          read_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lawsuit_id?: number
          movement_date?: string
          movement_title?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      qr_codes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          qr_code_data: string
          title: string | null
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          qr_code_data: string
          title?: string | null
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          qr_code_data?: string
          title?: string | null
          url?: string
        }
        Relationships: []
      }
      realtime_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      recruitment_candidate_documents: {
        Row: {
          candidate_id: string
          created_at: string
          document_type: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          document_type?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_candidate_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_candidates: {
        Row: {
          created_at: string
          created_by: string
          current_stage: Database["public"]["Enums"]["recruitment_stage"]
          elimination_notes: string | null
          elimination_reason:
            | Database["public"]["Enums"]["elimination_reason"]
            | null
          email: string | null
          extracted_data: Json | null
          full_name: string
          future_hire_notes: string | null
          hired_date: string | null
          id: string
          in_person_interview_date: string | null
          interview_date: string | null
          is_active: boolean
          is_future_hire_candidate: boolean | null
          job_opening_id: string | null
          phone: string | null
          position_applied: string | null
          previous_job_opening_id: string | null
          resume_file_name: string | null
          resume_url: string | null
          test_date: string | null
          test_score: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_stage?: Database["public"]["Enums"]["recruitment_stage"]
          elimination_notes?: string | null
          elimination_reason?:
            | Database["public"]["Enums"]["elimination_reason"]
            | null
          email?: string | null
          extracted_data?: Json | null
          full_name: string
          future_hire_notes?: string | null
          hired_date?: string | null
          id?: string
          in_person_interview_date?: string | null
          interview_date?: string | null
          is_active?: boolean
          is_future_hire_candidate?: boolean | null
          job_opening_id?: string | null
          phone?: string | null
          position_applied?: string | null
          previous_job_opening_id?: string | null
          resume_file_name?: string | null
          resume_url?: string | null
          test_date?: string | null
          test_score?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_stage?: Database["public"]["Enums"]["recruitment_stage"]
          elimination_notes?: string | null
          elimination_reason?:
            | Database["public"]["Enums"]["elimination_reason"]
            | null
          email?: string | null
          extracted_data?: Json | null
          full_name?: string
          future_hire_notes?: string | null
          hired_date?: string | null
          id?: string
          in_person_interview_date?: string | null
          interview_date?: string | null
          is_active?: boolean
          is_future_hire_candidate?: boolean | null
          job_opening_id?: string | null
          phone?: string | null
          position_applied?: string | null
          previous_job_opening_id?: string | null
          resume_file_name?: string | null
          resume_url?: string | null
          test_date?: string | null
          test_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_candidates_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "recruitment_job_openings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidates_previous_job_opening_id_fkey"
            columns: ["previous_job_opening_id"]
            isOneToOne: false
            referencedRelation: "recruitment_job_openings"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_interview_feedback: {
        Row: {
          additional_notes: string | null
          communication: number | null
          created_at: string
          cultural_fit: number | null
          evaluator_id: string
          experience: number | null
          id: string
          interview_id: string
          motivation: number | null
          overall_rating: number | null
          problem_solving: number | null
          recommendation: string | null
          strengths: string | null
          technical_skills: number | null
          updated_at: string
          weaknesses: string | null
        }
        Insert: {
          additional_notes?: string | null
          communication?: number | null
          created_at?: string
          cultural_fit?: number | null
          evaluator_id: string
          experience?: number | null
          id?: string
          interview_id: string
          motivation?: number | null
          overall_rating?: number | null
          problem_solving?: number | null
          recommendation?: string | null
          strengths?: string | null
          technical_skills?: number | null
          updated_at?: string
          weaknesses?: string | null
        }
        Update: {
          additional_notes?: string | null
          communication?: number | null
          created_at?: string
          cultural_fit?: number | null
          evaluator_id?: string
          experience?: number | null
          id?: string
          interview_id?: string
          motivation?: number | null
          overall_rating?: number | null
          problem_solving?: number | null
          recommendation?: string | null
          strengths?: string | null
          technical_skills?: number | null
          updated_at?: string
          weaknesses?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_interview_feedback_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "recruitment_interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_interviews: {
        Row: {
          candidate_id: string
          created_at: string
          created_by: string
          duration_minutes: number | null
          feedback: string | null
          id: string
          interview_type: string
          interviewer_ids: string[]
          location: string | null
          meeting_link: string | null
          notes: string | null
          rating: number | null
          scheduled_date: string
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          created_by: string
          duration_minutes?: number | null
          feedback?: string | null
          id?: string
          interview_type: string
          interviewer_ids?: string[]
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          rating?: number | null
          scheduled_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number | null
          feedback?: string | null
          id?: string
          interview_type?: string
          interviewer_ids?: string[]
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          rating?: number | null
          scheduled_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_job_openings: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          opened_at: string
          position: string
          requirements: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          opened_at?: string
          position: string
          requirements?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          opened_at?: string
          position?: string
          requirements?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      recruitment_notes: {
        Row: {
          candidate_id: string
          content: string
          created_at: string
          created_by: string
          id: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_position_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          position: string
          requirements: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          position: string
          requirements?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          position?: string
          requirements?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recruitment_stage_history: {
        Row: {
          candidate_id: string
          changed_by: string
          created_at: string
          from_stage: Database["public"]["Enums"]["recruitment_stage"] | null
          id: string
          notes: string | null
          to_stage: Database["public"]["Enums"]["recruitment_stage"]
        }
        Insert: {
          candidate_id: string
          changed_by: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["recruitment_stage"] | null
          id?: string
          notes?: string | null
          to_stage: Database["public"]["Enums"]["recruitment_stage"]
        }
        Update: {
          candidate_id?: string
          changed_by?: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["recruitment_stage"] | null
          id?: string
          notes?: string | null
          to_stage?: Database["public"]["Enums"]["recruitment_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_stage_history_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_adiantamento_descontos: {
        Row: {
          adiantamento_id: string
          created_at: string
          data_desconto: string | null
          id: string
          mes_referencia: string
          pagamento_id: string | null
          parcela_numero: number
          valor_descontado: number
        }
        Insert: {
          adiantamento_id: string
          created_at?: string
          data_desconto?: string | null
          id?: string
          mes_referencia: string
          pagamento_id?: string | null
          parcela_numero: number
          valor_descontado: number
        }
        Update: {
          adiantamento_id?: string
          created_at?: string
          data_desconto?: string | null
          id?: string
          mes_referencia?: string
          pagamento_id?: string | null
          parcela_numero?: number
          valor_descontado?: number
        }
        Relationships: [
          {
            foreignKeyName: "rh_adiantamento_descontos_adiantamento_id_fkey"
            columns: ["adiantamento_id"]
            isOneToOne: false
            referencedRelation: "rh_adiantamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_adiantamento_descontos_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "rh_pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_adiantamentos: {
        Row: {
          colaborador_id: string
          conta_pagamento_id: string | null
          created_at: string
          created_by: string
          data_adiantamento: string
          forma_desconto: string
          id: string
          lancamento_financeiro_id: string | null
          mes_inicio_desconto: string | null
          numero_parcelas: number | null
          observacoes: string | null
          saldo_restante: number
          status: string
          tipo_adiantamento: string
          tipo_adiantamento_outro: string | null
          updated_at: string
          valor: number
          valor_parcela: number | null
        }
        Insert: {
          colaborador_id: string
          conta_pagamento_id?: string | null
          created_at?: string
          created_by: string
          data_adiantamento?: string
          forma_desconto: string
          id?: string
          lancamento_financeiro_id?: string | null
          mes_inicio_desconto?: string | null
          numero_parcelas?: number | null
          observacoes?: string | null
          saldo_restante: number
          status?: string
          tipo_adiantamento: string
          tipo_adiantamento_outro?: string | null
          updated_at?: string
          valor: number
          valor_parcela?: number | null
        }
        Update: {
          colaborador_id?: string
          conta_pagamento_id?: string | null
          created_at?: string
          created_by?: string
          data_adiantamento?: string
          forma_desconto?: string
          id?: string
          lancamento_financeiro_id?: string | null
          mes_inicio_desconto?: string | null
          numero_parcelas?: number | null
          observacoes?: string | null
          saldo_restante?: number
          status?: string
          tipo_adiantamento?: string
          tipo_adiantamento_outro?: string | null
          updated_at?: string
          valor?: number
          valor_parcela?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_adiantamentos_conta_pagamento_id_fkey"
            columns: ["conta_pagamento_id"]
            isOneToOne: false
            referencedRelation: "fin_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_cargo_salary_history: {
        Row: {
          alterado_por: string | null
          cargo_id: string
          created_at: string
          id: string
          valor_anterior: number
          valor_novo: number
        }
        Insert: {
          alterado_por?: string | null
          cargo_id: string
          created_at?: string
          id?: string
          valor_anterior: number
          valor_novo: number
        }
        Update: {
          alterado_por?: string | null
          cargo_id?: string
          created_at?: string
          id?: string
          valor_anterior?: number
          valor_novo?: number
        }
        Relationships: [
          {
            foreignKeyName: "rh_cargo_salary_history_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "rh_cargos"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_cargos: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          is_active: boolean | null
          nome: string
          tipo: string | null
          updated_at: string
          valor_base: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          tipo?: string | null
          updated_at?: string
          valor_base?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          tipo?: string | null
          updated_at?: string
          valor_base?: number
        }
        Relationships: []
      }
      rh_documentos: {
        Row: {
          arquivo_url: string
          colaborador_id: string
          created_at: string
          created_by: string | null
          id: string
          nome: string
          pasta_id: string | null
          tamanho_bytes: number | null
          tipo_arquivo: string | null
        }
        Insert: {
          arquivo_url: string
          colaborador_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          pasta_id?: string | null
          tamanho_bytes?: number | null
          tipo_arquivo?: string | null
        }
        Update: {
          arquivo_url?: string
          colaborador_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          pasta_id?: string | null
          tamanho_bytes?: number | null
          tipo_arquivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_rh_documentos_colaborador"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_rh_documentos_pasta"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "rh_pastas_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_documentos_medicos: {
        Row: {
          arquivo_url: string
          colaborador_id: string
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          tamanho_bytes: number | null
          tipo_arquivo: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          arquivo_url: string
          colaborador_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tamanho_bytes?: number | null
          tipo_arquivo?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          arquivo_url?: string
          colaborador_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tamanho_bytes?: number | null
          tipo_arquivo?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_documentos_medicos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_folgas: {
        Row: {
          colaborador_id: string
          created_at: string
          created_by: string | null
          data_folga: string
          id: string
          motivo: string | null
          observacoes: string | null
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          created_by?: string | null
          data_folga: string
          id?: string
          motivo?: string | null
          observacoes?: string | null
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          created_by?: string | null
          data_folga?: string
          id?: string
          motivo?: string | null
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_folgas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_folgas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_historico_salario: {
        Row: {
          colaborador_id: string
          created_at: string | null
          data_alteracao: string | null
          id: string
          observacao: string | null
          salario_anterior: number | null
          salario_novo: number | null
        }
        Insert: {
          colaborador_id: string
          created_at?: string | null
          data_alteracao?: string | null
          id?: string
          observacao?: string | null
          salario_anterior?: number | null
          salario_novo?: number | null
        }
        Update: {
          colaborador_id?: string
          created_at?: string | null
          data_alteracao?: string | null
          id?: string
          observacao?: string | null
          salario_anterior?: number | null
          salario_novo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_historico_salario_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_pagamento_itens: {
        Row: {
          created_at: string
          id: string
          observacao: string | null
          pagamento_id: string
          rubrica_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          observacao?: string | null
          pagamento_id: string
          rubrica_id: string
          valor?: number
        }
        Update: {
          created_at?: string
          id?: string
          observacao?: string | null
          pagamento_id?: string
          rubrica_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_rh_pagamento_itens_pagamento"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "rh_pagamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_rh_pagamento_itens_rubrica"
            columns: ["rubrica_id"]
            isOneToOne: false
            referencedRelation: "rh_rubricas"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_pagamentos: {
        Row: {
          colaborador_id: string
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          id: string
          lancamento_financeiro_id: string | null
          mes_referencia: string
          observacoes: string | null
          recibo_gerado: boolean | null
          recibo_url: string | null
          status: string | null
          total_descontos: number | null
          total_liquido: number | null
          total_vantagens: number | null
          updated_at: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          id?: string
          lancamento_financeiro_id?: string | null
          mes_referencia: string
          observacoes?: string | null
          recibo_gerado?: boolean | null
          recibo_url?: string | null
          status?: string | null
          total_descontos?: number | null
          total_liquido?: number | null
          total_vantagens?: number | null
          updated_at?: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          id?: string
          lancamento_financeiro_id?: string | null
          mes_referencia?: string
          observacoes?: string | null
          recibo_gerado?: boolean | null
          recibo_url?: string | null
          status?: string | null
          total_descontos?: number | null
          total_liquido?: number | null
          total_vantagens?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_rh_pagamentos_colaborador"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_pastas_documentos: {
        Row: {
          colaborador_id: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_rh_pastas_colaborador"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_promocoes: {
        Row: {
          cargo_anterior_id: string | null
          cargo_anterior_nome: string
          cargo_novo_id: string | null
          cargo_novo_nome: string
          colaborador_id: string
          created_at: string
          data_promocao: string
          id: string
          observacoes: string | null
          registrado_por: string
        }
        Insert: {
          cargo_anterior_id?: string | null
          cargo_anterior_nome: string
          cargo_novo_id?: string | null
          cargo_novo_nome: string
          colaborador_id: string
          created_at?: string
          data_promocao: string
          id?: string
          observacoes?: string | null
          registrado_por: string
        }
        Update: {
          cargo_anterior_id?: string | null
          cargo_anterior_nome?: string
          cargo_novo_id?: string | null
          cargo_novo_nome?: string
          colaborador_id?: string
          created_at?: string
          data_promocao?: string
          id?: string
          observacoes?: string | null
          registrado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_promocoes_cargo_anterior_id_fkey"
            columns: ["cargo_anterior_id"]
            isOneToOne: false
            referencedRelation: "rh_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_promocoes_cargo_novo_id_fkey"
            columns: ["cargo_novo_id"]
            isOneToOne: false
            referencedRelation: "rh_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_promocoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_rubrica_subcategoria_mapping: {
        Row: {
          created_at: string | null
          id: string
          rubrica_nome: string
          subcategoria_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          rubrica_nome: string
          subcategoria_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          rubrica_nome?: string
          subcategoria_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_rubrica_subcategoria_mapping_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "fin_subcategorias"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_rubricas: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_active: boolean | null
          nome: string
          ordem: number | null
          tipo: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          ordem?: number | null
          tipo: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          ordem?: number | null
          tipo?: string
        }
        Relationships: []
      }
      rh_sugestoes_valores: {
        Row: {
          colaborador_id: string
          id: string
          rubrica_id: string
          updated_at: string
          valor_sugerido: number | null
        }
        Insert: {
          colaborador_id: string
          id?: string
          rubrica_id: string
          updated_at?: string
          valor_sugerido?: number | null
        }
        Update: {
          colaborador_id?: string
          id?: string
          rubrica_id?: string
          updated_at?: string
          valor_sugerido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_rh_sugestoes_colaborador"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_rh_sugestoes_rubrica"
            columns: ["rubrica_id"]
            isOneToOne: false
            referencedRelation: "rh_rubricas"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jurisprudence: {
        Row: {
          category: string | null
          content: string
          court: string | null
          created_at: string
          id: string
          notes: string | null
          search_id: string | null
          source: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          court?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          search_id?: string | null
          source?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          court?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          search_id?: string | null
          source?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jurisprudence_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "jurisprudence_searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_jurisprudence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      senhas_uteis: {
        Row: {
          categoria: string | null
          created_at: string
          created_by: string | null
          id: string
          observacoes: string | null
          senha: string | null
          titulo: string
          updated_at: string
          url: string | null
          usuario: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          observacoes?: string | null
          senha?: string | null
          titulo: string
          updated_at?: string
          url?: string | null
          usuario?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          observacoes?: string | null
          senha?: string | null
          titulo?: string
          updated_at?: string
          url?: string | null
          usuario?: string | null
        }
        Relationships: []
      }
      sheets_advbox_sync: {
        Row: {
          advbox_customer_id: string
          client_name: string
          cpf: string
          created_at: string
          id: string
          sheet_row_id: number | null
          synced_at: string
        }
        Insert: {
          advbox_customer_id: string
          client_name: string
          cpf: string
          created_at?: string
          id?: string
          sheet_row_id?: number | null
          synced_at?: string
        }
        Update: {
          advbox_customer_id?: string
          client_name?: string
          cpf?: string
          created_at?: string
          id?: string
          sheet_row_id?: number | null
          synced_at?: string
        }
        Relationships: []
      }
      special_powers_templates: {
        Row: {
          created_at: string
          description: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      success_fee_templates: {
        Row: {
          created_at: string
          description: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      suggestion_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          suggestion_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          suggestion_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          suggestion_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_comments_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_tag_relations: {
        Row: {
          created_at: string
          id: string
          suggestion_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          suggestion_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          suggestion_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_tag_relations_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_tag_relations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "suggestion_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      suggestion_votes: {
        Row: {
          created_at: string
          id: string
          suggestion_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          suggestion_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          suggestion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_notifications: {
        Row: {
          created_at: string | null
          id: string
          lida: boolean | null
          mensagem: string
          read_at: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          mensagem: string
          read_at?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          mensagem?: string
          read_at?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      system_updates: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          title: string
          version: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          title: string
          version?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          title?: string
          version?: string | null
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: []
      }
      task_auto_rules: {
        Row: {
          created_at: string | null
          created_by: string
          days_to_deadline: number | null
          id: string
          is_active: boolean | null
          name: string
          responsible_user_id: string | null
          task_description_template: string | null
          task_title_template: string
          task_type_id: number
          trigger_type: string
          trigger_value: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          days_to_deadline?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          responsible_user_id?: string | null
          task_description_template?: string | null
          task_title_template: string
          task_type_id: number
          trigger_type: string
          trigger_value: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          days_to_deadline?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          responsible_user_id?: string | null
          task_description_template?: string | null
          task_title_template?: string
          task_type_id?: number
          trigger_type?: string
          trigger_value?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_notification_settings: {
        Row: {
          created_at: string
          email_notifications: boolean
          id: string
          notification_time: string
          notify_days_before: number
          notify_on_due_date: boolean
          notify_when_overdue: boolean
          push_notifications: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          notification_time?: string
          notify_days_before?: number
          notify_on_due_date?: boolean
          notify_when_overdue?: boolean
          push_notifications?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          notification_time?: string
          notify_days_before?: number
          notify_on_due_date?: boolean
          notify_when_overdue?: boolean
          push_notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_priorities: {
        Row: {
          created_at: string
          id: string
          priority: string
          set_by: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority: string
          set_by: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          priority?: string
          set_by?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_status_history: {
        Row: {
          changed_at: string
          changed_by: string
          created_at: string
          id: string
          new_status: string
          notes: string | null
          previous_status: string | null
          task_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          created_at?: string
          id?: string
          new_status: string
          notes?: string | null
          previous_status?: string | null
          task_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: string
          notes?: string | null
          previous_status?: string | null
          task_id?: string
        }
        Relationships: []
      }
      totp_accounts: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          secret_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          secret_key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          secret_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tribunal_links: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          created_at: string
          created_by: string | null
          id: string
          nome: string
          ordem: number | null
          sistema: string
          tribunal: string
          updated_at: string
          url: string
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          ordem?: number | null
          sistema: string
          tribunal: string
          updated_at?: string
          url: string
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          sistema?: string
          tribunal?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      tutorial_seen: {
        Row: {
          id: string
          page_key: string
          seen_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          page_key: string
          seen_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          page_key?: string
          seen_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      usage_history: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          tool_name: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tool_name: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tool_name?: string
          user_id?: string
        }
        Relationships: []
      }
      useful_documents: {
        Row: {
          created_at: string
          description: string | null
          file_url: string
          id: string
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_url: string
          id?: string
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_url?: string
          id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      user_access_tracking: {
        Row: {
          access_count: number
          created_at: string
          id: string
          last_accessed_at: string
          page_name: string
          page_path: string
          user_id: string
        }
        Insert: {
          access_count?: number
          created_at?: string
          id?: string
          last_accessed_at?: string
          page_name: string
          page_path: string
          user_id: string
        }
        Update: {
          access_count?: number
          created_at?: string
          id?: string
          last_accessed_at?: string
          page_name?: string
          page_path?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_read_updates: {
        Row: {
          id: string
          read_at: string | null
          update_id: string
          user_id: string
        }
        Insert: {
          id?: string
          read_at?: string | null
          update_id: string
          user_id: string
        }
        Update: {
          id?: string
          read_at?: string | null
          update_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_read_updates_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "system_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      utm_campaigns: {
        Row: {
          base_url: string
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
          utm_campaign: string
          utm_content: string | null
          utm_medium: string
          utm_source: string
          utm_term: string | null
          whatsapp_number: string | null
        }
        Insert: {
          base_url: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
          utm_campaign: string
          utm_content?: string | null
          utm_medium: string
          utm_source: string
          utm_term?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          base_url?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
          utm_campaign?: string
          utm_content?: string | null
          utm_medium?: string
          utm_source?: string
          utm_term?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      vacation_balance: {
        Row: {
          available_days: number
          created_at: string
          id: string
          total_days: number
          updated_at: string
          used_days: number
          user_id: string
          year: number
        }
        Insert: {
          available_days?: number
          created_at?: string
          id?: string
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id: string
          year: number
        }
        Update: {
          available_days?: number
          created_at?: string
          id?: string
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      vacation_requests: {
        Row: {
          acquisition_period_end: string | null
          acquisition_period_start: string | null
          approved_at: string | null
          approved_by: string | null
          business_days: number
          created_at: string
          end_date: string
          id: string
          notes: string | null
          rejection_reason: string | null
          sold_days: number | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acquisition_period_end?: string | null
          acquisition_period_start?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_days: number
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          sold_days?: number | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acquisition_period_end?: string | null
          acquisition_period_start?: string | null
          approved_at?: string | null
          approved_by?: string | null
          business_days?: number
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          sold_days?: number | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      viabilidade_clientes: {
        Row: {
          advbox_customer_id: string | null
          analise_realizada_em: string | null
          como_conheceu: string | null
          cpf: string
          created_at: string
          created_by: string
          data_nascimento: string | null
          descricao_caso: string | null
          documentos: Json | null
          email: string | null
          endereco: string | null
          estado_civil: string | null
          id: string
          nome: string
          observacoes: string | null
          parecer_viabilidade: string | null
          profissao: string | null
          rg: string | null
          status: string
          telefone: string | null
          tipo_acao: string | null
          tipo_pessoa: string | null
          titulo: string | null
          updated_at: string
        }
        Insert: {
          advbox_customer_id?: string | null
          analise_realizada_em?: string | null
          como_conheceu?: string | null
          cpf: string
          created_at?: string
          created_by: string
          data_nascimento?: string | null
          descricao_caso?: string | null
          documentos?: Json | null
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          parecer_viabilidade?: string | null
          profissao?: string | null
          rg?: string | null
          status?: string
          telefone?: string | null
          tipo_acao?: string | null
          tipo_pessoa?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          advbox_customer_id?: string | null
          analise_realizada_em?: string | null
          como_conheceu?: string | null
          cpf?: string
          created_at?: string
          created_by?: string
          data_nascimento?: string | null
          descricao_caso?: string | null
          documentos?: Json | null
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          parecer_viabilidade?: string | null
          profissao?: string | null
          rg?: string | null
          status?: string
          telefone?: string | null
          tipo_acao?: string | null
          tipo_pessoa?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_automation_rules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          interval_seconds: number
          is_active: boolean
          message_template: string
          name: string
          send_via: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          interval_seconds?: number
          is_active?: boolean
          message_template?: string
          name: string
          send_via?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          interval_seconds?: number
          is_active?: boolean
          message_template?: string
          name?: string
          send_via?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_comment_mentions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          mentioned_user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          mentioned_user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          mentioned_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_internal_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_comment_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_assignees: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_assignees_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversation_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_tags: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          contact_name: string | null
          created_at: string
          id: string
          is_archived: boolean
          last_message_at: string | null
          last_message_text: string | null
          phone: string
          sector: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          last_message_at?: string | null
          last_message_text?: string | null
          phone: string
          sector?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          last_message_at?: string | null
          last_message_text?: string | null
          phone?: string
          sector?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_internal_comments: {
        Row: {
          author_id: string
          content: string
          conversation_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          content: string
          conversation_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_internal_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_internal_comments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string
          direction: string
          id: string
          is_from_me: boolean
          media_filename: string | null
          media_mime_type: string | null
          media_url: string | null
          message_type: string
          phone: string
          quoted_message_id: string | null
          sent_by: string | null
          status: string
          transcription: string | null
          zapi_message_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          is_from_me?: boolean
          media_filename?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          phone: string
          quoted_message_id?: string | null
          sent_by?: string | null
          status?: string
          transcription?: string | null
          zapi_message_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          is_from_me?: boolean
          media_filename?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          phone?: string
          quoted_message_id?: string | null
          sent_by?: string | null
          status?: string
          transcription?: string | null
          zapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_quoted_message_id_fkey"
            columns: ["quoted_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_product_numbers: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          phone_number: string
          product_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          phone_number: string
          product_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          phone_number?: string
          product_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_scheduled_messages: {
        Row: {
          contact_name: string | null
          content: string | null
          created_at: string
          created_by: string
          error_message: string | null
          id: string
          media_url: string | null
          message_type: string
          phone: string
          scheduled_at: string
          sent_at: string | null
          status: string
        }
        Insert: {
          contact_name?: string | null
          content?: string | null
          created_at?: string
          created_by: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          phone: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          contact_name?: string | null
          content?: string | null
          created_at?: string
          created_by?: string
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          phone?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      whatsapp_tags: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string
          id: string
          is_shared: boolean
          shortcut: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_shared?: boolean
          shortcut: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_shared?: boolean
          shortcut?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      zapi_messages_log: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string
          error_message: string | null
          id: string
          message_text: string
          message_type: string
          sent_at: string | null
          sent_by: string | null
          status: string
          zapi_message_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone: string
          error_message?: string | null
          id?: string
          message_text: string
          message_type?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          zapi_message_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string
          error_message?: string | null
          id?: string
          message_text?: string
          message_type?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          zapi_message_id?: string | null
        }
        Relationships: []
      }
      zapi_webhook_events: {
        Row: {
          battery_level: number | null
          broadcast: boolean | null
          caption: string | null
          chat_name: string | null
          connected: boolean | null
          created_at: string
          event_type: string
          id: string
          is_charging: boolean | null
          is_from_me: boolean | null
          is_group: boolean | null
          latitude: number | null
          link_description: string | null
          link_title: string | null
          link_url: string | null
          longitude: number | null
          media_mime_type: string | null
          media_url: string | null
          message_id: string | null
          message_text: string | null
          message_type: string | null
          moment_type: string | null
          phone: string | null
          processed: boolean | null
          processed_at: string | null
          quoted_message_id: string | null
          raw_payload: Json
          reaction_emoji: string | null
          received_at: string
          sender_name: string | null
          sender_phone: string | null
          status: string | null
          thumbnail_url: string | null
          zaap_id: string | null
        }
        Insert: {
          battery_level?: number | null
          broadcast?: boolean | null
          caption?: string | null
          chat_name?: string | null
          connected?: boolean | null
          created_at?: string
          event_type: string
          id?: string
          is_charging?: boolean | null
          is_from_me?: boolean | null
          is_group?: boolean | null
          latitude?: number | null
          link_description?: string | null
          link_title?: string | null
          link_url?: string | null
          longitude?: number | null
          media_mime_type?: string | null
          media_url?: string | null
          message_id?: string | null
          message_text?: string | null
          message_type?: string | null
          moment_type?: string | null
          phone?: string | null
          processed?: boolean | null
          processed_at?: string | null
          quoted_message_id?: string | null
          raw_payload?: Json
          reaction_emoji?: string | null
          received_at?: string
          sender_name?: string | null
          sender_phone?: string | null
          status?: string | null
          thumbnail_url?: string | null
          zaap_id?: string | null
        }
        Update: {
          battery_level?: number | null
          broadcast?: boolean | null
          caption?: string | null
          chat_name?: string | null
          connected?: boolean | null
          created_at?: string
          event_type?: string
          id?: string
          is_charging?: boolean | null
          is_from_me?: boolean | null
          is_group?: boolean | null
          latitude?: number | null
          link_description?: string | null
          link_title?: string | null
          link_url?: string | null
          longitude?: number | null
          media_mime_type?: string | null
          media_url?: string | null
          message_id?: string | null
          message_text?: string | null
          message_type?: string | null
          moment_type?: string | null
          phone?: string | null
          processed?: boolean | null
          processed_at?: string | null
          quoted_message_id?: string | null
          raw_payload?: Json
          reaction_emoji?: string | null
          received_at?: string
          sender_name?: string | null
          sender_phone?: string | null
          status?: string | null
          thumbnail_url?: string | null
          zaap_id?: string | null
        }
        Relationships: []
      }
      zapsign_documents: {
        Row: {
          advbox_sync_at: string | null
          advbox_sync_triggered: boolean | null
          client_cpf: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          client_signer_status: string | null
          client_signer_token: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          document_name: string
          document_token: string
          document_type: string
          fin_contrato_id: string | null
          id: string
          marcos_signer_status: string | null
          marcos_signer_token: string | null
          office_signer_status: string | null
          office_signer_token: string | null
          original_file_url: string | null
          rafael_signer_status: string | null
          rafael_signer_token: string | null
          sign_url: string | null
          signed_at: string | null
          signed_file_url: string | null
          status: string
          updated_at: string
          witness1_name: string | null
          witness1_signer_status: string | null
          witness1_signer_token: string | null
          witness2_name: string | null
          witness2_signer_status: string | null
          witness2_signer_token: string | null
        }
        Insert: {
          advbox_sync_at?: string | null
          advbox_sync_triggered?: boolean | null
          client_cpf?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          client_signer_status?: string | null
          client_signer_token?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          document_name: string
          document_token: string
          document_type: string
          fin_contrato_id?: string | null
          id?: string
          marcos_signer_status?: string | null
          marcos_signer_token?: string | null
          office_signer_status?: string | null
          office_signer_token?: string | null
          original_file_url?: string | null
          rafael_signer_status?: string | null
          rafael_signer_token?: string | null
          sign_url?: string | null
          signed_at?: string | null
          signed_file_url?: string | null
          status?: string
          updated_at?: string
          witness1_name?: string | null
          witness1_signer_status?: string | null
          witness1_signer_token?: string | null
          witness2_name?: string | null
          witness2_signer_status?: string | null
          witness2_signer_token?: string | null
        }
        Update: {
          advbox_sync_at?: string | null
          advbox_sync_triggered?: boolean | null
          client_cpf?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          client_signer_status?: string | null
          client_signer_token?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          document_name?: string
          document_token?: string
          document_type?: string
          fin_contrato_id?: string | null
          id?: string
          marcos_signer_status?: string | null
          marcos_signer_token?: string | null
          office_signer_status?: string | null
          office_signer_token?: string | null
          original_file_url?: string | null
          rafael_signer_status?: string | null
          rafael_signer_token?: string | null
          sign_url?: string | null
          signed_at?: string | null
          signed_file_url?: string | null
          status?: string
          updated_at?: string
          witness1_name?: string | null
          witness1_signer_status?: string | null
          witness1_signer_token?: string | null
          witness2_name?: string | null
          witness2_signer_status?: string | null
          witness2_signer_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapsign_documents_fin_contrato_id_fkey"
            columns: ["fin_contrato_id"]
            isOneToOne: false
            referencedRelation: "fin_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_adiantamentos_pendentes: {
        Args: { p_colaborador_id: string }
        Returns: {
          data_adiantamento: string
          id: string
          mes_inicio_desconto: string
          saldo_restante: number
          tipo_adiantamento: string
          valor_original: number
        }[]
      }
      get_admin_permission: {
        Args: { _feature: string; _user_id: string }
        Returns: string
      }
      get_totp_permission: { Args: { user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_socio: { Args: { user_id: string }; Returns: boolean }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_rafael: { Args: { _user_id: string }; Returns: boolean }
      is_socio: { Args: { user_id: string }; Returns: boolean }
      is_socio_or_rafael: { Args: { _user_id: string }; Returns: boolean }
      log_integration_sync: {
        Args: {
          p_action: string
          p_details?: Json
          p_source_id: string
          p_source_table: string
          p_target_id: string
          p_target_table: string
        }
        Returns: string
      }
      registrar_atualizacao_intranet: {
        Args: {
          p_categoria?: string
          p_created_by?: string
          p_descricao: string
          p_titulo: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
      approval_status: "pending" | "approved" | "rejected"
      elimination_reason:
        | "sem_interesse_candidato"
        | "sem_interesse_escritorio"
        | "reprovado_entrevista"
        | "reprovado_prova"
        | "reprovado_entrevista_presencial"
        | "outro"
      position_type:
        | "socio"
        | "advogado"
        | "estagiario"
        | "comercial"
        | "administrativo"
      recruitment_stage:
        | "curriculo_recebido"
        | "entrevista_agendada"
        | "entrevista_realizada"
        | "aguardando_prova"
        | "prova_realizada"
        | "entrevista_presencial_agendada"
        | "entrevista_presencial_realizada"
        | "contratado"
        | "eliminado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      approval_status: ["pending", "approved", "rejected"],
      elimination_reason: [
        "sem_interesse_candidato",
        "sem_interesse_escritorio",
        "reprovado_entrevista",
        "reprovado_prova",
        "reprovado_entrevista_presencial",
        "outro",
      ],
      position_type: [
        "socio",
        "advogado",
        "estagiario",
        "comercial",
        "administrativo",
      ],
      recruitment_stage: [
        "curriculo_recebido",
        "entrevista_agendada",
        "entrevista_realizada",
        "aguardando_prova",
        "prova_realizada",
        "entrevista_presencial_agendada",
        "entrevista_presencial_realizada",
        "contratado",
        "eliminado",
      ],
    },
  },
} as const
