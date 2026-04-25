import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import pdf from "https://esm.sh/pdf-parse@1.1.1";
import mammoth from "https://esm.sh/mammoth@1.8.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth obrigatória: sem isso, qualquer caller com a anon key
    // exfiltra CRM (contacts, deals, profiles) via service role abaixo.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Só usuários aprovados podem usar os agentes (evita que alguém
    // cadastrado mas não aprovado exfiltre dados via esse endpoint).
    const { data: approved, error: approvedError } = await supabase.rpc(
      "is_approved",
      { _user_id: user.id }
    );
    if (approvedError || !approved) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { agentId, messages, attachments } = await req.json();

    const { data: agent, error: agentError } = await supabase
      .from("intranet_agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) throw new Error("Agent not found");

    const { data: files } = await supabase
      .from("intranet_agent_files")
      .select("file_name, file_type, file_url")
      .eq("agent_id", agentId);

    let systemPrompt = `Você é "${agent.name}".

## REGRA CRÍTICA
- NUNCA invente, fabrique ou suponha informações que não foram fornecidas.
- Quando o usuário anexar um documento, sua resposta DEVE ser baseada EXCLUSIVAMENTE no conteúdo desse documento.
- Se não conseguir ler ou interpretar o conteúdo do documento, informe isso claramente ao usuário em vez de inventar uma resposta.
- Se a informação solicitada não estiver presente no documento, diga explicitamente que não encontrou essa informação.

## Objetivo
${agent.objective}

## Instruções
${agent.instructions}`;

    if (agent.function_role) {
      systemPrompt += `\n\n## Função/Especialidade\n${agent.function_role}`;
    }

    if (files && files.length > 0) {
      systemPrompt += `\n\n## Base de Conhecimento\nVocê tem acesso aos seguintes documentos/recursos:\n`;
      for (const file of files) {
        systemPrompt += `- ${file.file_name} (${file.file_type})${file.file_type === 'link' ? `: ${file.file_url}` : ''}\n`;
      }
      systemPrompt += `\nUse essas informações como referência para suas respostas quando relevante.`;
    }

    // Inject system data based on data_access permissions
    const dataAccess: string[] = agent.data_access || [];
    if (dataAccess.length > 0) {
      const hasAccess = (key: string) => dataAccess.includes('all') || dataAccess.includes(key);
      const dataBlocks: string[] = [];

      if (hasAccess('leads')) {
        const { data: deals } = await supabase.from("crm_deals").select("name, value, status, won, product_name, created_at").order("created_at", { ascending: false }).limit(30);
        const { data: contacts } = await supabase.from("crm_contacts").select("name, email, phone, source, created_at").order("created_at", { ascending: false }).limit(30);
        if (deals?.length || contacts?.length) {
          let block = "### Leads / CRM\n";
          if (contacts?.length) block += `**Contatos recentes (${contacts.length}):**\n${contacts.map(c => `- ${c.name} | ${c.email || ''} | ${c.phone || ''} | Fonte: ${c.source || 'N/A'}`).join('\n')}\n\n`;
          if (deals?.length) block += `**Deals recentes (${deals.length}):**\n${deals.map(d => `- ${d.name} | R$ ${d.value || 0} | ${d.status} | ${d.won ? 'Ganho' : 'Aberto'} | Produto: ${d.product_name || 'N/A'}`).join('\n')}\n`;
          dataBlocks.push(block);
        }
      }

      if (hasAccess('colaboradores')) {
        const { data: profiles } = await supabase.from("profiles").select("full_name, email, position, department, is_active").eq("is_active", true).eq("approval_status", "approved").limit(50);
        if (profiles?.length) {
          dataBlocks.push(`### Colaboradores Ativos (${profiles.length})\n${profiles.map(p => `- ${p.full_name} | ${p.email} | Cargo: ${p.position || 'N/A'} | Setor: ${p.department || 'N/A'}`).join('\n')}`);
        }
      }

      if (hasAccess('intimacoes')) {
        const { data: pubs } = await supabase.from("publicacoes_dje").select("titulo, conteudo_resumo, data_publicacao, processo_numero, responsavel").order("data_publicacao", { ascending: false }).limit(20);
        if (pubs?.length) {
          dataBlocks.push(`### Publicações DJE Recentes (${pubs.length})\n${pubs.map(p => `- ${p.data_publicacao} | Proc: ${p.processo_numero || 'N/A'} | ${p.titulo || ''} | Resp: ${p.responsavel || 'N/A'}`).join('\n')}`);
        }
      }

      if (hasAccess('financeiro')) {
        const { data: lancamentos } = await supabase.from("fin_lancamentos").select("tipo, valor, status, descricao, data_vencimento").is("deleted_at", null).order("data_vencimento", { ascending: false }).limit(30);
        if (lancamentos?.length) {
          const receitas = lancamentos.filter(l => l.tipo === 'receita').reduce((s, l) => s + (l.valor || 0), 0);
          const despesas = lancamentos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + (l.valor || 0), 0);
          dataBlocks.push(`### Financeiro (últimos ${lancamentos.length} lançamentos)\n**Resumo:** Receitas: R$ ${receitas.toFixed(2)} | Despesas: R$ ${despesas.toFixed(2)} | Saldo: R$ ${(receitas - despesas).toFixed(2)}\n${lancamentos.slice(0, 15).map(l => `- ${l.data_vencimento} | ${l.tipo} | R$ ${l.valor} | ${l.status} | ${l.descricao?.slice(0, 60) || ''}`).join('\n')}`);
        }
      }

      if (hasAccess('campanhas')) {
        const { data: campaigns } = await supabase.from("crm_campaigns").select("name, status, type, start_date, end_date, budget").order("created_at", { ascending: false }).limit(20);
        if (campaigns?.length) {
          dataBlocks.push(`### Campanhas de Marketing (${campaigns.length})\n${campaigns.map(c => `- ${c.name} | ${c.status} | Tipo: ${c.type || 'N/A'} | Orçamento: R$ ${c.budget || 0}`).join('\n')}`);
        }
      }

      if (hasAccess('tarefas')) {
        const { data: tasks } = await supabase.from("advbox_tasks").select("title, status, due_date, assigned_users, process_number").in("status", ["pending", "in_progress"]).order("due_date", { ascending: true }).limit(30);
        if (tasks?.length) {
          dataBlocks.push(`### Tarefas Pendentes (${tasks.length})\n${tasks.map(t => `- ${t.title} | ${t.status} | Venc: ${t.due_date || 'N/A'} | Resp: ${t.assigned_users || 'N/A'} | Proc: ${t.process_number || 'N/A'}`).join('\n')}`);
        }
      }

      if (hasAccess('processos')) {
        const { data: cache } = await supabase.from("advbox_dashboard_cache").select("total_lawsuits, total_movements, metadata").limit(1).single();
        if (cache) {
          dataBlocks.push(`### Processos (Advbox)\n**Total de processos:** ${cache.total_lawsuits || 0}\n**Total de movimentações:** ${cache.total_movements || 0}`);
        }
      }

      if (hasAccess('teams_documents')) {
        try {
          const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
          const tenantId = Deno.env.get("MICROSOFT_TENANT_ID");
          const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");

          if (clientId && tenantId && clientSecret) {
            // Get Microsoft Graph token
            const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                scope: "https://graph.microsoft.com/.default",
                grant_type: "client_credentials",
              }),
            });
            const tokenData = await tokenRes.json();
            const accessToken = tokenData.access_token;

            if (accessToken) {
              const graphHeaders = { Authorization: `Bearer ${accessToken}` };

              // Find "Jurídico" site
              const sitesRes = await fetch("https://graph.microsoft.com/v1.0/sites?search=Jurídico", { headers: graphHeaders });
              const sitesData = await sitesRes.json();
              const juridico = sitesData.value?.find((s: any) => s.displayName?.toLowerCase().includes("jurídico"));

              if (juridico) {
                // Get drives
                const drivesRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${juridico.id}/drives`, { headers: graphHeaders });
                const drivesData = await drivesRes.json();
                const docsDrive = drivesData.value?.find((d: any) => d.name === "Documentos" || d.name === "Documents") || drivesData.value?.[0];

                if (docsDrive) {
                  // List "Operacional - Clientes" folder
                  const folderRes = await fetch(
                    `https://graph.microsoft.com/v1.0/drives/${docsDrive.id}/root:/Operacional - Clientes:/children?$top=50&$select=name,folder,lastModifiedDateTime`,
                    { headers: graphHeaders }
                  );
                  const folderData = await folderRes.json();
                  const clientFolders = folderData.value?.filter((item: any) => item.folder) || [];

                  if (clientFolders.length > 0) {
                    let teamsBlock = `### Documentos do Teams (Pastas de Clientes)\n**Total de pastas:** ${clientFolders.length}\n\n`;

                    // For each client folder, list files (limit to first 30 folders for prompt size)
                    const foldersToList = clientFolders.slice(0, 30);
                    for (const folder of foldersToList) {
                      try {
                        const filesRes = await fetch(
                          `https://graph.microsoft.com/v1.0/drives/${docsDrive.id}/root:/Operacional - Clientes/${encodeURIComponent(folder.name)}:/children?$top=20&$select=name,size,lastModifiedDateTime,file`,
                          { headers: graphHeaders }
                        );
                        const filesData = await filesRes.json();
                        const files = filesData.value || [];
                        const fileItems = files.filter((f: any) => f.file);

                        teamsBlock += `**📁 ${folder.name}** (${fileItems.length} arquivo${fileItems.length !== 1 ? 's' : ''})\n`;
                        for (const file of fileItems) {
                          const date = file.lastModifiedDateTime ? new Date(file.lastModifiedDateTime).toLocaleDateString('pt-BR') : 'N/A';
                          const sizeKB = file.size ? Math.round(file.size / 1024) : 0;
                          teamsBlock += `  - ${file.name} | ${date} | ${sizeKB}KB\n`;
                        }
                        teamsBlock += '\n';
                      } catch (_e) { /* skip individual folder errors */ }
                    }

                    if (clientFolders.length > 30) {
                      teamsBlock += `\n... e mais ${clientFolders.length - 30} pastas de clientes.\n`;
                    }

                    dataBlocks.push(teamsBlock);
                  }
                }
              }
            }
          }
        } catch (teamsErr) {
          console.error("Error fetching Teams documents for agent:", teamsErr);
          // Silently skip - don't block the agent
        }
      }

      if (dataBlocks.length > 0) {
        systemPrompt += `\n\n## Dados do Sistema (consulta em tempo real)\nAbaixo estão dados atualizados do sistema que você pode usar para responder perguntas:\n\n${dataBlocks.join('\n\n')}`;
      }
    }

    // Process attachments - extract content from documents
    const processedMessages = [...messages];
    if (attachments && attachments.length > 0) {
      const lastMsg = processedMessages[processedMessages.length - 1];
      if (lastMsg && lastMsg.role === "user") {
        let attachmentContext = "\n\n[Arquivos anexados pelo usuário:]\n";
        for (const att of attachments) {
          attachmentContext += `- ${att.name} (${att.type})\n`;
          const fileName = att.name?.toLowerCase() || '';
          const fileType = att.type?.toLowerCase() || '';
          
          try {
            if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
              // Extract text from PDF
              const binaryData = Uint8Array.from(atob(att.base64), (c: string) => c.charCodeAt(0));
              const pdfData = await pdf({ data: binaryData });
              const extractedText = pdfData.text?.slice(0, 80000) || '';
              if (extractedText.trim()) {
                attachmentContext += `\nConteúdo extraído de ${att.name}:\n\`\`\`\n${extractedText}\n\`\`\`\n`;
              } else {
                attachmentContext += `\n[Não foi possível extrair texto de ${att.name} - o PDF pode ser uma imagem escaneada]\n`;
              }
            } else if (fileType.includes('wordprocessingml') || fileType.includes('msword') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
              // Extract text from DOCX
              const binaryData = Uint8Array.from(atob(att.base64), (c: string) => c.charCodeAt(0));
              const result = await mammoth.extractRawText({ buffer: binaryData.buffer });
              const extractedText = result.value?.slice(0, 80000) || '';
              if (extractedText.trim()) {
                attachmentContext += `\nConteúdo extraído de ${att.name}:\n\`\`\`\n${extractedText}\n\`\`\`\n`;
              } else {
                attachmentContext += `\n[Não foi possível extrair texto de ${att.name}]\n`;
              }
            } else if (
              fileType.includes('text') || 
              fileName.endsWith('.txt') || fileName.endsWith('.csv') ||
              fileName.endsWith('.json') || fileName.endsWith('.xml') ||
              fileName.endsWith('.md') || fileName.endsWith('.html') ||
              fileName.endsWith('.htm') || fileName.endsWith('.yaml') ||
              fileName.endsWith('.yml')
            ) {
              // Decode text-based files
              const decoded = atob(att.base64);
              attachmentContext += `\nConteúdo de ${att.name}:\n\`\`\`\n${decoded.slice(0, 80000)}\n\`\`\`\n`;
            } else {
              attachmentContext += `\n[Arquivo ${att.name} anexado, mas não foi possível extrair o conteúdo deste formato]\n`;
            }
          } catch (extractError) {
            console.error(`Error extracting content from ${att.name}:`, extractError);
            attachmentContext += `\n[Erro ao tentar extrair conteúdo de ${att.name}: ${extractError instanceof Error ? extractError.message : 'erro desconhecido'}]\n`;
          }
        }
        lastMsg.content += attachmentContext;
      }
    }

    const model = agent.model || "google/gemini-3-flash-preview";

    if (model.startsWith("anthropic/")) {
      return await handleAnthropic(systemPrompt, processedMessages, model);
    } else if (model.startsWith("perplexity/")) {
      return await handlePerplexity(systemPrompt, processedMessages, model);
    } else {
      return await handleLovableGateway(systemPrompt, processedMessages, model);
    }
  } catch (e) {
    console.error("chat-with-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleAnthropic(systemPrompt: string, messages: any[], model: string) {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  const anthropicModel = model === "anthropic/claude-sonnet" ? "claude-sonnet-4-20250514" : "claude-sonnet-4-20250514";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 8192,
      system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const t = await response.text();
    console.error("Anthropic error:", response.status, t);
    throw new Error(`Anthropic error: ${response.status}`);
  }

  const transformStream = new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            return;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              const openaiFormat = { choices: [{ delta: { content: parsed.delta.text } }] };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openaiFormat)}\n\n`));
            } else if (parsed.type === "message_stop") {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            }
          } catch { /* skip */ }
        }
      }
    }
  });

  const transformed = response.body!.pipeThrough(transformStream);
  return new Response(transformed, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

async function handlePerplexity(systemPrompt: string, messages: any[], _model: string) {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY not configured");

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new Error(`Perplexity error: ${response.status}`);
  }

  return new Response(response.body, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

async function handleLovableGateway(systemPrompt: string, messages: any[], model: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Payment required" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const t = await response.text();
    console.error("Gateway error:", response.status, t);
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  return new Response(response.body, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}
