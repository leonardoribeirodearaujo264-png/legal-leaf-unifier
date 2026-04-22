import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Chave pública do DataJud (CNJ) — antes estava hardcoded. Agora vem
// de env var pra não ficar vazando via git/supabase logs e pra poder
// rotacionar sem redeploy de código.
const DATAJUD_API_KEY = Deno.env.get('DATAJUD_API_KEY') ?? ''
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function getEndpointForProcess(numProcesso: string): { sigla: string; url: string } | null {
  const match = numProcesso.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/)
  if (!match) return null
  const justica = match[1]
  const tribunal = match[2]

  if (justica === '8') {
    const tjMap: Record<string, string> = {
      '01': 'tjac', '02': 'tjal', '03': 'tjap', '04': 'tjam', '05': 'tjba',
      '06': 'tjce', '07': 'tjdf', '08': 'tjes', '09': 'tjgo', '10': 'tjma',
      '11': 'tjmt', '12': 'tjms', '13': 'tjmg', '14': 'tjpa', '15': 'tjpb',
      '16': 'tjpr', '17': 'tjpe', '18': 'tjpi', '19': 'tjrj', '20': 'tjrn',
      '21': 'tjrs', '22': 'tjro', '23': 'tjrr', '24': 'tjsc', '25': 'tjsp',
      '26': 'tjse', '27': 'tjto',
    }
    const alias = tjMap[tribunal]
    if (!alias) return null
    return { sigla: alias.toUpperCase(), url: `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search` }
  }
  if (justica === '4') {
    const trfMap: Record<string, string> = {
      '01': 'trf1', '02': 'trf2', '03': 'trf3', '04': 'trf4', '05': 'trf5', '06': 'trf6',
    }
    const alias = trfMap[tribunal]
    if (!alias) return null
    return { sigla: alias.toUpperCase(), url: `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search` }
  }
  if (justica === '5') {
    const trtMap: Record<string, string> = {
      '01': 'trt1', '02': 'trt2', '03': 'trt3', '04': 'trt4', '05': 'trt5',
      '06': 'trt6', '07': 'trt7', '08': 'trt8', '09': 'trt9', '10': 'trt10',
      '11': 'trt11', '12': 'trt12', '13': 'trt13', '14': 'trt14', '15': 'trt15',
      '16': 'trt16', '17': 'trt17', '18': 'trt18', '19': 'trt19', '20': 'trt20',
      '21': 'trt21', '22': 'trt22', '23': 'trt23', '24': 'trt24',
    }
    const alias = trtMap[tribunal]
    if (!alias) return null
    return { sigla: alias.toUpperCase(), url: `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search` }
  }
  return null
}

async function searchDataJud(url: string, query: any): Promise<any> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `APIKey ${DATAJUD_API_KEY}`,
        'User-Agent': BROWSER_UA,
      },
      body: JSON.stringify(query),
    })
    if (!response.ok) {
      const text = await response.text()
      return { ok: false, status: response.status, error: text.substring(0, 200) }
    }
    return { ok: true, data: await response.json() }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { action, filters } = body

    // === CHECK CREDENTIALS (verifica conectividade com DataJud) ===
    if (action === 'check-credentials') {
      const testUrl = 'https://api-publica.datajud.cnj.jus.br/api_publica_tjmg/_search'
      const result = await searchDataJud(testUrl, { size: 1, query: { match_all: {} } })
      return new Response(JSON.stringify({ configured: true, accessible: result.ok }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // === SEARCH LOCAL ===
    if (action === 'search-local') {
      const page = filters?.page || 1
      const pageSize = filters?.pageSize || 500
      let query = supabase
        .from('publicacoes_dje')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)

      if (filters?.numeroProcesso) query = query.ilike('numero_processo', `%${filters.numeroProcesso}%`)
      if (filters?.tribunal) query = query.ilike('tribunal', `%${filters.tribunal}%`)
      if (filters?.dataInicio) query = query.gte('data_disponibilizacao', filters.dataInicio)
      if (filters?.dataFim) query = query.lte('data_disponibilizacao', filters.dataFim + 'T23:59:59')
      if (filters?.tipoComunicacao) query = query.eq('tipo_comunicacao', filters.tipoComunicacao)
      if (filters?.nomeAdvogado) query = query.ilike('nome_advogado', `%${filters.nomeAdvogado}%`)

      const { data, error, count } = await query
      if (error) throw error

      const pubIds = (data || []).map((p: any) => p.id)
      let reads: any[] = []
      if (pubIds.length > 0) {
        const { data: readsData } = await supabase
          .from('publicacoes_dje_reads')
          .select('publicacao_id')
          .eq('user_id', user.id)
          .in('publicacao_id', pubIds)
        reads = readsData || []
      }

      const readIds = new Set(reads.map((r: any) => r.publicacao_id))
      const enriched = (data || []).map((p: any) => ({ ...p, lida: readIds.has(p.id) }))

      return new Response(JSON.stringify({ data: enriched, totalCount: count || enriched.length, page, pageSize }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // === SEARCH API (DataJud) ===
    if (action === 'search-api') {
      console.log('=== Busca DataJud via botão ===')

      // Buscar processos do ADVBox com raw_data para extrair clientes
      const { data: processos, error: procError } = await supabase
        .from('advbox_tasks')
        .select('process_number, raw_data')
        .not('process_number', 'is', null)
        .neq('process_number', '')

      if (procError) throw procError

      const numerosUnicos = [...new Set((processos || []).map((p: any) => p.process_number))]
      console.log(`Processos únicos: ${numerosUnicos.length}`)

      if (numerosUnicos.length === 0) {
        return new Response(JSON.stringify({
          data: [],
          total: 0,
          cached: 0,
          novas: 0,
          message: 'Nenhum processo cadastrado na base do escritório.',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Montar mapa processo -> nome do cliente
      const clientesPorProcesso = new Map<string, string>()
      for (const p of (processos || [])) {
        if (p.raw_data?.lawsuit?.customers) {
          const customers = p.raw_data.lawsuit.customers as any[]
          const nomes = customers.map((c: any) => c.name).filter(Boolean).join(', ')
          if (nomes) clientesPorProcesso.set(p.process_number, nomes)
        }
      }
      console.log(`Clientes mapeados: ${clientesPorProcesso.size}`)

      // Agrupar por endpoint
      const porEndpoint = new Map<string, { endpoint: { sigla: string; url: string }; numeros: string[] }>()
      for (const num of numerosUnicos) {
        const ep = getEndpointForProcess(num)
        if (!ep) continue
        if (filters?.tribunal && ep.sigla !== filters.tribunal) continue
        if (!porEndpoint.has(ep.url)) {
          porEndpoint.set(ep.url, { endpoint: ep, numeros: [] })
        }
        porEndpoint.get(ep.url)!.numeros.push(num.replace(/[.-]/g, ''))
      }

      const toInsert: any[] = []
      const errors: string[] = []
      let processosConsultados = 0

      const limiteData = new Date()
      if (filters?.dataInicio) {
        limiteData.setTime(new Date(filters.dataInicio).getTime())
      } else {
        limiteData.setDate(limiteData.getDate() - 30)
      }

      for (const [url, { endpoint, numeros }] of porEndpoint) {
        for (let i = 0; i < numeros.length; i += 20) {
          const batch = numeros.slice(i, i + 20)
          const query = {
            size: 20,
            query: { terms: { "numeroProcesso": batch } },
            _source: ["numeroProcesso", "classe", "orgaoJulgador", "dataAjuizamento", "movimentos", "assuntos", "tribunal"],
          }

          const result = await searchDataJud(url, query)
          if (!result.ok) {
            errors.push(`${endpoint.sigla}: ${(result.error || '').substring(0, 100)}`)
            continue
          }

          const hits = result.data?.hits?.hits || []
          processosConsultados += hits.length

          for (const hit of hits) {
            const proc = hit._source
            const numFormatado = numerosUnicos.find(n => n.replace(/[.-]/g, '') === proc.numeroProcesso) || proc.numeroProcesso
            const movimentos = proc.movimentos || []
            const clienteNome = clientesPorProcesso.get(numFormatado) || ''

            for (const mov of movimentos) {
              const dataHora = mov.dataHora ? new Date(mov.dataHora) : null
              if (!dataHora || dataHora < limiteData) continue
              if (filters?.dataFim && dataHora > new Date(filters.dataFim + 'T23:59:59')) continue

              const nomeMovimento = mov.nome || ''
              const isRelevante = /intima|cita|notifica|publica|expedi|despacho|decisão|sentença|julgamento|acórdão|audiência|petiç/i.test(nomeMovimento)
              if (!isRelevante) continue

              if (filters?.tipoComunicacao) {
                if (filters.tipoComunicacao === 'IN' && !/intima/i.test(nomeMovimento)) continue
                if (filters.tipoComunicacao === 'CI' && !/cita/i.test(nomeMovimento)) continue
                if (filters.tipoComunicacao === 'NT' && !/notifica/i.test(nomeMovimento)) continue
              }

              const complementos = (mov.complementosTabelados || [])
                .map((c: any) => {
                  const label = (c.descricao || '').replace(/_/g, ' ').trim()
                  const valor = (c.nome || '').trim()
                  if (label && valor) return `${label}: ${valor}`
                  return label || valor || ''
                })
                .filter(Boolean)
                .join('; ')

              const hash = `dj-${proc.numeroProcesso}-${mov.dataHora}-${nomeMovimento.substring(0, 40)}`
              let tipoCom = 'NT'
              if (/intima/i.test(nomeMovimento)) tipoCom = 'IN'
              else if (/cita/i.test(nomeMovimento)) tipoCom = 'CI'

              toInsert.push({
                numero_processo: numFormatado,
                tribunal: proc.orgaoJulgador?.nome || endpoint.sigla,
                tipo_comunicacao: tipoCom,
                data_disponibilizacao: mov.dataHora,
                data_publicacao: mov.dataHora,
                conteudo: `${nomeMovimento}${complementos ? ` | ${complementos}` : ''} | ${proc.classe?.nome || ''}`,
                destinatario: clienteNome,
                meio: 'DataJud',
                nome_advogado: 'Rafael Egg Nunes',
                numero_comunicacao: '',
                hash,
                raw_data: {
                  processo: { numeroProcesso: numFormatado, classe: proc.classe, orgaoJulgador: proc.orgaoJulgador, assuntos: proc.assuntos },
                  movimento: mov,
                  cliente: clienteNome,
                },
              })
            }
          }
        }
        console.log(`${endpoint.sigla}: ${numeros.length} processos`)
      }

      console.log(`Processos encontrados: ${processosConsultados}, Movimentações: ${toInsert.length}`)

      let novasPublicacoes = 0
      if (toInsert.length > 0) {
        const existingHashes = new Set<string>()
        const hashes = toInsert.map((r: any) => r.hash)
        for (let i = 0; i < hashes.length; i += 100) {
          const batch = hashes.slice(i, i + 100)
          const { data: rows } = await supabase.from('publicacoes_dje').select('hash').in('hash', batch)
          for (const row of (rows || [])) existingHashes.add(row.hash)
        }
        novasPublicacoes = toInsert.filter((r: any) => !existingHashes.has(r.hash)).length

        for (let i = 0; i < toInsert.length; i += 50) {
          const batch = toInsert.slice(i, i + 50)
          const { error: upsertError } = await supabase
            .from('publicacoes_dje')
            .upsert(batch, { onConflict: 'hash', ignoreDuplicates: true })
          if (upsertError) console.error('Erro upsert:', upsertError.message)
        }
      }

      return new Response(JSON.stringify({
        success: true,
        total: toInsert.length,
        cached: novasPublicacoes,
        processos_consultados: processosConsultados,
        processos_total: numerosUnicos.length,
        errors: errors.length > 0 ? errors : undefined,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // === ENRICH EXISTING (preencher nomes de clientes e tribunal nos registros existentes) ===
    if (action === 'enrich-existing') {
      // === Fix tribunal for ComunicaPJe records missing nomeOrgao ===
      let tribunalFixed = 0
      const { data: pubsComunicaPje } = await supabase
        .from('publicacoes_dje')
        .select('id, tribunal, raw_data')
        .eq('meio', 'ComunicaPJe')
        .not('raw_data', 'is', null)
        .limit(2000)

      for (const pub of (pubsComunicaPje || [])) {
        const rawItem = pub.raw_data as any
        if (rawItem?.nomeOrgao && pub.tribunal && !pub.tribunal.includes(' - ')) {
          const novoTribunal = `${rawItem.siglaTribunal || pub.tribunal} - ${rawItem.nomeOrgao}`
          const { error: updateErr } = await supabase
            .from('publicacoes_dje')
            .update({ tribunal: novoTribunal })
            .eq('id', pub.id)
          if (!updateErr) tribunalFixed++
        }
      }
      console.log(`Tribunal corrigido: ${tribunalFixed} registros`)

      // Buscar publicações sem cliente
      const { data: pubsSemCliente, error: pubErr } = await supabase
        .from('publicacoes_dje')
        .select('id, numero_processo')
        .or('destinatario.is.null,destinatario.eq.')
        .limit(2000)

      if (pubErr) throw pubErr

      if (!pubsSemCliente || pubsSemCliente.length === 0) {
        return new Response(JSON.stringify({ success: true, updated: 0, tribunal_fixed: tribunalFixed, message: 'Todos os registros já possuem cliente.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Buscar processos do advbox com dados de clientes
      const processNumbers = [...new Set(pubsSemCliente.map((p: any) => p.numero_processo))]
      const { data: advboxData } = await supabase
        .from('advbox_tasks')
        .select('process_number, raw_data')
        .in('process_number', processNumbers)

      const clienteMap = new Map<string, string>()
      for (const item of (advboxData || [])) {
        if (item.raw_data?.lawsuit?.customers) {
          const customers = item.raw_data.lawsuit.customers as any[]
          const nomes = customers.map((c: any) => c.name).filter(Boolean).join(', ')
          if (nomes) clienteMap.set(item.process_number, nomes)
        }
      }

      // Also fix conteudo for records with numeric codes
      const { data: pubsComConteudoAntigo } = await supabase
        .from('publicacoes_dje')
        .select('id, raw_data, conteudo')
        .not('raw_data', 'is', null)
        .limit(2000)

      let conteudoFixed = 0
      for (const pub of (pubsComConteudoAntigo || [])) {
        const mov = (pub.raw_data as any)?.movimento
        const proc = (pub.raw_data as any)?.processo
        if (!mov) continue
        // Detect old format: numeric codes like ": 9" or ": 185"
        if (pub.conteudo && /:\s*\d{1,4}(?:;|$|\s*\|)/.test(pub.conteudo)) {
          const nomeMovimento = mov.nome || ''
          const complementos = (mov.complementosTabelados || [])
            .map((c: any) => {
              const label = (c.descricao || '').replace(/_/g, ' ').trim()
              const valor = (c.nome || '').trim()
              if (label && valor) return `${label}: ${valor}`
              return label || valor || ''
            })
            .filter(Boolean)
            .join('; ')
          const classeNome = proc?.classe?.nome || ''
          const novoConteudo = `${nomeMovimento}${complementos ? ` | ${complementos}` : ''}${classeNome ? ` | ${classeNome}` : ''}`
          
          const { error: updateErr } = await supabase
            .from('publicacoes_dje')
            .update({ conteudo: novoConteudo })
            .eq('id', pub.id)
          if (!updateErr) conteudoFixed++
        }
      }

      let updated = 0
      for (const pub of pubsSemCliente) {
        const cliente = clienteMap.get(pub.numero_processo)
        if (cliente) {
          const { error: updateErr } = await supabase
            .from('publicacoes_dje')
            .update({ destinatario: cliente })
            .eq('id', pub.id)
          if (!updateErr) updated++
        }
      }

      // Fallback: extract party names from ComunicaPJe HTML content
      let htmlExtracted = 0
      const { data: pubsSemClienteCPJe } = await supabase
        .from('publicacoes_dje')
        .select('id, conteudo, raw_data')
        .eq('meio', 'ComunicaPJe')
        .or('destinatario.is.null,destinatario.eq.')
        .limit(2000)

      for (const pub of (pubsSemClienteCPJe || [])) {
        const html = pub.conteudo || (pub.raw_data as any)?.texto || ''
        if (!html) continue
        // Extract names after REQUERENTE, AUTOR, RECLAMANTE, etc.
        const partyPatterns = [
          /(?:REQUERENTE|AUTOR(?:A)?|RECLAMANTE|IMPETRANTE|EXEQUENTE|AGRAVANTE|APELANTE|EMBARGANTE)\s*(?:<\/td>)?\s*(?:<td>)?\s*:?\s*(?:<\/td>)?\s*(?:<td>)?\s*:?\s*([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ][A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]+)/gi,
        ]
        const names = new Set<string>()
        for (const pattern of partyPatterns) {
          let match
          while ((match = pattern.exec(html)) !== null) {
            const name = match[1].trim()
              .replace(/<[^>]+>/g, '')
              .replace(/\s+/g, ' ')
              .trim()
            // Filter out generic terms and short names
            if (name.length > 3 && !/^(CPF|OAB|ADVOGADO|RÉU|REQUERIDO|CNPJ)/.test(name)) {
              names.add(name)
            }
          }
        }
        if (names.size > 0) {
          const nomeCliente = [...names].join(', ')
          const { error: updateErr } = await supabase
            .from('publicacoes_dje')
            .update({ destinatario: nomeCliente })
            .eq('id', pub.id)
          if (!updateErr) htmlExtracted++
        }
      }

      return new Response(JSON.stringify({ success: true, updated, html_extracted: htmlExtracted, conteudo_fixed: conteudoFixed, tribunal_fixed: tribunalFixed, total: pubsSemCliente.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // === MARK READ ===
    if (action === 'mark-read') {
      const { publicacaoId } = body
      const { error } = await supabase
        .from('publicacoes_dje_reads')
        .upsert({ publicacao_id: publicacaoId, user_id: user.id }, { onConflict: 'publicacao_id,user_id' })
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // === MARK UNREAD ===
    if (action === 'mark-unread') {
      const { publicacaoId } = body
      const { error } = await supabase
        .from('publicacoes_dje_reads')
        .delete()
        .eq('publicacao_id', publicacaoId)
        .eq('user_id', user.id)
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // === SEARCH COMUNICA PJE ===
    if (action === 'search-comunicapje') {
      console.log('=== Busca Comunica PJe ===')

      const ADVOGADOS = [
        { nome: 'RAFAEL EGG NUNES', display: 'Rafael Egg Nunes' },
        { nome: 'GUILHERME ZARDO ROCHA', display: 'Guilherme Zardo Rocha' },
      ]

      const hoje = new Date()
      const dataInicioDefault = new Date(hoje)
      dataInicioDefault.setDate(dataInicioDefault.getDate() - 7)
      const dataInicioBusca = filters?.dataInicio || dataInicioDefault.toISOString().split('T')[0]
      const dataFimBusca = filters?.dataFim || hoje.toISOString().split('T')[0]

      const toInsert: any[] = []
      const errors: string[] = []
      let totalEncontrados = 0

      for (const advogado of ADVOGADOS) {
        let pagina = 1
        let totalPages = 1

        while (pagina <= totalPages) {
          const params = new URLSearchParams({
            nomeAdvogado: advogado.nome,
            dataDisponibilizacaoInicio: dataInicioBusca,
            dataDisponibilizacaoFim: dataFimBusca,
            itensPorPagina: '100',
            pagina: String(pagina),
          })

          const url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?${params.toString()}`
          console.log(`ComunicaPJe: Buscando ${advogado.display} página ${pagina}...`)

          try {
            const response = await fetch(url, {
              method: 'GET',
              headers: { 'User-Agent': BROWSER_UA },
            })

            if (!response.ok) {
              const errText = await response.text()
              errors.push(`ComunicaPJe ${advogado.display}: HTTP ${response.status} - ${errText.substring(0, 100)}`)
              break
            }

            const result = await response.json()
            const items = result.items || []
            const count = result.count || 0
            totalEncontrados += items.length

            // Calculate total pages
            totalPages = Math.ceil(count / 100)

            for (const item of items) {
              const numProcesso = item.numeroprocessocommascara || ''
              const numProcessoLimpo = numProcesso.replace(/[.-]/g, '')
              const texto = item.texto || ''
              const dataDisp = item.data_disponibilizacao || ''
              const hashTexto = texto.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '')
              const hash = `cpje-${numProcessoLimpo}-${dataDisp}-${hashTexto}`

              toInsert.push({
                numero_processo: numProcesso,
                tribunal: item.nomeOrgao ? `${item.siglaTribunal} - ${item.nomeOrgao}` : (item.siglaTribunal || ''),
                tipo_comunicacao: item.tipoComunicacao || 'NT',
                data_disponibilizacao: dataDisp,
                data_publicacao: dataDisp,
                conteudo: texto,
                destinatario: item.nomeDestinatario || '',
                meio: 'ComunicaPJe',
                nome_advogado: advogado.display,
                numero_comunicacao: item.numeroComunicacao || '',
                hash,
                raw_data: item,
              })
            }

            console.log(`ComunicaPJe ${advogado.display}: página ${pagina}/${totalPages}, ${items.length} itens (total API: ${count})`)
          } catch (err: any) {
            errors.push(`ComunicaPJe ${advogado.display}: ${err.message}`)
            break
          }

          pagina++
        }
      }

      console.log(`ComunicaPJe total encontrados: ${totalEncontrados}, para inserir: ${toInsert.length}`)

      let novasPublicacoes = 0
      if (toInsert.length > 0) {
        const existingHashes = new Set<string>()
        const hashes = toInsert.map((r: any) => r.hash)
        for (let i = 0; i < hashes.length; i += 100) {
          const batch = hashes.slice(i, i + 100)
          const { data: rows } = await supabase.from('publicacoes_dje').select('hash').in('hash', batch)
          for (const row of (rows || [])) existingHashes.add(row.hash)
        }
        novasPublicacoes = toInsert.filter((r: any) => !existingHashes.has(r.hash)).length

        for (let i = 0; i < toInsert.length; i += 50) {
          const batch = toInsert.slice(i, i + 50)
          const { error: upsertError } = await supabase
            .from('publicacoes_dje')
            .upsert(batch, { onConflict: 'hash', ignoreDuplicates: true })
          if (upsertError) console.error('Erro upsert ComunicaPJe:', upsertError.message)
        }
      }

      // === Enriquecimento automático: preencher nomes de clientes via AdvBox ===
      if (novasPublicacoes > 0) {
        try {
          console.log('Enriquecendo publicações com dados do AdvBox...')
          const processNumbers = [...new Set(toInsert.map((r: any) => r.numero_processo))]
          const { data: advboxData } = await supabase
            .from('advbox_tasks')
            .select('process_number, raw_data')
            .in('process_number', processNumbers)

          const clienteMap = new Map<string, string>()
          for (const item of (advboxData || [])) {
            if (item.raw_data?.lawsuit?.customers) {
              const customers = item.raw_data.lawsuit.customers as any[]
              const nomes = customers.map((c: any) => c.name).filter(Boolean).join(', ')
              if (nomes) clienteMap.set(item.process_number, nomes)
            }
          }

          let enriched = 0
          if (clienteMap.size > 0) {
            const { data: pubsSemCliente } = await supabase
              .from('publicacoes_dje')
              .select('id, numero_processo')
              .in('numero_processo', processNumbers)
              .or('destinatario.is.null,destinatario.eq.')

            for (const pub of (pubsSemCliente || [])) {
              const cliente = clienteMap.get(pub.numero_processo)
              if (cliente) {
                await supabase.from('publicacoes_dje').update({ destinatario: cliente }).eq('id', pub.id)
                enriched++
              }
            }
          }
          console.log(`Enriquecimento: ${enriched} publicações atualizadas com nomes de clientes`)
        } catch (enrichErr: any) {
          console.error('Erro no enriquecimento:', enrichErr.message)
        }
      }

      return new Response(JSON.stringify({
        success: true,
        total: toInsert.length,
        novas: novasPublicacoes,
        errors: errors.length > 0 ? errors : undefined,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
