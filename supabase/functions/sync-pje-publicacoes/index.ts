import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const DATAJUD_API_KEY = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=='

// Mapa de segmento do processo → endpoint DataJud
function getEndpointForProcess(numProcesso: string): { sigla: string; url: string } | null {
  // Formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO
  // J = justiça (8=estadual, 4=federal, 5=trabalho)
  // TR = tribunal
  const match = numProcesso.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/)
  if (!match) return null

  const justica = match[1]
  const tribunal = match[2]

  if (justica === '8') {
    // Justiça Estadual
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
    // Justiça Federal
    const trfMap: Record<string, string> = {
      '01': 'trf1', '02': 'trf2', '03': 'trf3', '04': 'trf4', '05': 'trf5', '06': 'trf6',
    }
    const alias = trfMap[tribunal]
    if (!alias) return null
    return { sigla: alias.toUpperCase(), url: `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search` }
  }

  if (justica === '5') {
    // Justiça do Trabalho
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

  // Guarda service-role: só pg_cron pode disparar sync pesado de publicações.
  const authHeader = req.headers.get('Authorization')
  const expectedToken = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
  if (authHeader !== expectedToken) {
    console.error('Tentativa não autorizada em sync-pje-publicacoes')
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('=== Sync Publicações via DataJud ===')

    // Buscar todos os processos do ADVBox
    const { data: processos, error: procError } = await supabase
      .from('advbox_tasks')
      .select('process_number')
      .not('process_number', 'is', null)
      .neq('process_number', '')

    if (procError) throw procError

    // Deduplica números de processo
    const numerosUnicos = [...new Set((processos || []).map((p: any) => p.process_number))]
    console.log(`Processos únicos no ADVBox: ${numerosUnicos.length}`)

    // Agrupa processos por tribunal/endpoint
    const porEndpoint = new Map<string, { endpoint: { sigla: string; url: string }; numeros: string[] }>()
    let semEndpoint = 0

    for (const num of numerosUnicos) {
      const ep = getEndpointForProcess(num)
      if (!ep) {
        semEndpoint++
        continue
      }
      if (!porEndpoint.has(ep.url)) {
        porEndpoint.set(ep.url, { endpoint: ep, numeros: [] })
      }
      porEndpoint.get(ep.url)!.numeros.push(num.replace(/[.-]/g, '')) // Remove formatação para busca
    }

    console.log(`Tribunais identificados: ${porEndpoint.size}, processos sem endpoint: ${semEndpoint}`)

    const toInsert: any[] = []
    const errors: string[] = []
    let processosConsultados = 0

    // Para cada tribunal, busca os processos em lotes
    for (const [url, { endpoint, numeros }] of porEndpoint) {
      // Processar em lotes de 20 processos
      for (let i = 0; i < numeros.length; i += 20) {
        const batch = numeros.slice(i, i + 20)
        
        const query = {
          size: 20,
          query: {
            terms: {
              "numeroProcesso": batch,
            }
          },
          _source: ["numeroProcesso", "classe", "orgaoJulgador", "dataAjuizamento", "movimentos", "assuntos", "tribunal"],
        }

        const result = await searchDataJud(url, query)
        
        if (!result.ok) {
          errors.push(`${endpoint.sigla}: ${(result.error || '').substring(0, 100)}`)
          continue
        }

        const hits = result.data?.hits?.hits || []
        processosConsultados += hits.length

        // Extrair movimentações recentes (últimos 7 dias)
        const limiteData = new Date()
        limiteData.setDate(limiteData.getDate() - 7)

        for (const hit of hits) {
          const proc = hit._source
          const numFormatado = numerosUnicos.find(n => n.replace(/[.-]/g, '') === proc.numeroProcesso) || proc.numeroProcesso
          const movimentos = proc.movimentos || []

          for (const mov of movimentos) {
            const dataHora = mov.dataHora ? new Date(mov.dataHora) : null
            if (!dataHora || dataHora < limiteData) continue

            const nomeMovimento = mov.nome || ''
            const isRelevante = /intima|cita|notifica|publica|expedi|despacho|decisão|sentença|julgamento|acórdão|audiência|petiç/i.test(nomeMovimento)
            if (!isRelevante) continue

            const complementos = (mov.complementosTabelados || [])
              .map((c: any) => `${c.nome || ''}: ${c.valor || c.descricao || ''}`)
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
              destinatario: '',
              meio: 'DataJud',
              nome_advogado: 'Rafael Egg Nunes',
              numero_comunicacao: '',
              hash,
              raw_data: { processo: { numeroProcesso: numFormatado, classe: proc.classe, orgaoJulgador: proc.orgaoJulgador }, movimento: mov },
            })
          }
        }
      }

      console.log(`${endpoint.sigla}: ${numeros.length} processos consultados`)
    }

    console.log(`Processos encontrados no DataJud: ${processosConsultados}`)
    console.log(`Movimentações relevantes (7d): ${toInsert.length}`)

    // === Enriquecer DataJud com nomes de clientes do AdvBox ANTES de inserir ===
    if (toInsert.length > 0) {
      const processNumbersDataJud = [...new Set(toInsert.map((r: any) => r.numero_processo))]
      const clienteMapDJ = new Map<string, string>()

      for (let i = 0; i < processNumbersDataJud.length; i += 100) {
        const batch = processNumbersDataJud.slice(i, i + 100)
        const { data: advboxData } = await supabase
          .from('advbox_tasks')
          .select('process_number, raw_data')
          .in('process_number', batch)

        for (const item of (advboxData || [])) {
          if (item.raw_data?.lawsuit?.customers) {
            const customers = item.raw_data.lawsuit.customers as any[]
            const nomes = customers.map((c: any) => c.name).filter(Boolean).join(', ')
            if (nomes) clienteMapDJ.set(item.process_number, nomes)
          }
        }
      }

      console.log(`Mapa de clientes AdvBox para DataJud: ${clienteMapDJ.size} processos com nome`)

      // Preencher destinatario nos registros antes do upsert
      for (const record of toInsert) {
        const cliente = clienteMapDJ.get(record.numero_processo)
        if (cliente) {
          record.destinatario = cliente
        }
      }
    }

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

      // === Corrigir registros DataJud existentes sem nome de cliente ===
      try {
        const { data: pubsSemCliente } = await supabase
          .from('publicacoes_dje')
          .select('id, numero_processo')
          .eq('meio', 'DataJud')
          .or('destinatario.is.null,destinatario.eq.')

        if (pubsSemCliente && pubsSemCliente.length > 0) {
          const processosParaEnriquecer = [...new Set(pubsSemCliente.map((p: any) => p.numero_processo))]
          const clienteMapRetro = new Map<string, string>()

          for (let i = 0; i < processosParaEnriquecer.length; i += 100) {
            const batch = processosParaEnriquecer.slice(i, i + 100)
            const { data: advboxData } = await supabase
              .from('advbox_tasks')
              .select('process_number, raw_data')
              .in('process_number', batch)

            for (const item of (advboxData || [])) {
              if (item.raw_data?.lawsuit?.customers) {
                const customers = item.raw_data.lawsuit.customers as any[]
                const nomes = customers.map((c: any) => c.name).filter(Boolean).join(', ')
                if (nomes) clienteMapRetro.set(item.process_number, nomes)
              }
            }
          }

          let retroFixed = 0
          for (const pub of pubsSemCliente) {
            const cliente = clienteMapRetro.get(pub.numero_processo)
            if (cliente) {
              await supabase.from('publicacoes_dje').update({ destinatario: cliente }).eq('id', pub.id)
              retroFixed++
            }
          }
          console.log(`Enriquecimento retroativo DataJud: ${retroFixed} registros corrigidos`)
        }
      } catch (retroErr: any) {
        console.error('Erro no enriquecimento retroativo DataJud:', retroErr.message)
      }
    }


    // === COMUNICA PJE ===
    console.log('=== Iniciando busca Comunica PJe ===')

    const ADVOGADOS = [
      { nome: 'RAFAEL EGG NUNES', display: 'Rafael Egg Nunes' },
      { nome: 'GUILHERME ZARDO ROCHA', display: 'Guilherme Zardo Rocha' },
    ]

    const hoje = new Date()
    const dataInicioCP = new Date(hoje)
    dataInicioCP.setDate(dataInicioCP.getDate() - 7)
    const dataInicioBusca = dataInicioCP.toISOString().split('T')[0]
    const dataFimBusca = hoje.toISOString().split('T')[0]

    const comunicaPjeInserts: any[] = []
    const comunicaPjeErrors: string[] = []

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

        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'User-Agent': BROWSER_UA },
          })

          if (!response.ok) {
            const errText = await response.text()
            comunicaPjeErrors.push(`${advogado.display}: HTTP ${response.status} - ${errText.substring(0, 100)}`)
            break
          }

          const result = await response.json()
          const items = result.items || []
          const count = result.count || 0
          totalPages = Math.ceil(count / 100)

          for (const item of items) {
            const numProcesso = item.numeroprocessocommascara || ''
            const numProcessoLimpo = numProcesso.replace(/[.-]/g, '')
            const texto = item.texto || ''
            const dataDisp = item.data_disponibilizacao || ''
            const hashTexto = texto.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '')
            const hash = `cpje-${numProcessoLimpo}-${dataDisp}-${hashTexto}`

            comunicaPjeInserts.push({
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

          console.log(`ComunicaPJe ${advogado.display}: página ${pagina}/${totalPages}, ${items.length} itens`)
        } catch (err: any) {
          comunicaPjeErrors.push(`${advogado.display}: ${err.message}`)
          break
        }

        pagina++
      }
    }

    console.log(`ComunicaPJe: ${comunicaPjeInserts.length} publicações encontradas`)

    let novasComunicaPje = 0
    if (comunicaPjeInserts.length > 0) {
      const existingHashesCP = new Set<string>()
      const hashesCP = comunicaPjeInserts.map((r: any) => r.hash)
      for (let i = 0; i < hashesCP.length; i += 100) {
        const batch = hashesCP.slice(i, i + 100)
        const { data: rows } = await supabase.from('publicacoes_dje').select('hash').in('hash', batch)
        for (const row of (rows || [])) existingHashesCP.add(row.hash)
      }
      novasComunicaPje = comunicaPjeInserts.filter((r: any) => !existingHashesCP.has(r.hash)).length

      for (let i = 0; i < comunicaPjeInserts.length; i += 50) {
        const batch = comunicaPjeInserts.slice(i, i + 50)
        const { error: upsertError } = await supabase
          .from('publicacoes_dje')
          .upsert(batch, { onConflict: 'hash', ignoreDuplicates: true })
        if (upsertError) console.error('Erro upsert ComunicaPJe:', upsertError.message)
      }
    }

    // === Enriquecimento automático: preencher nomes de clientes via AdvBox ===
    if (novasComunicaPje > 0) {
      try {
        console.log('Enriquecendo publicações ComunicaPJe com dados do AdvBox...')
        const processNumbers = [...new Set(comunicaPjeInserts.map((r: any) => r.numero_processo))]
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

        // Fallback: extract party names from ComunicaPJe HTML content
        let htmlExtracted = 0
        const { data: pubsSemClienteHTML } = await supabase
          .from('publicacoes_dje')
          .select('id, conteudo, raw_data')
          .eq('meio', 'ComunicaPJe')
          .in('numero_processo', processNumbers)
          .or('destinatario.is.null,destinatario.eq.')

        for (const pub of (pubsSemClienteHTML || [])) {
          const html = pub.conteudo || (pub.raw_data as any)?.texto || ''
          if (!html) continue
          const partyPatterns = [
            /(?:REQUERENTE|AUTOR(?:A)?|RECLAMANTE|IMPETRANTE|EXEQUENTE|AGRAVANTE|APELANTE|EMBARGANTE)\s*(?:<\/td>)?\s*(?:<td>)?\s*:?\s*(?:<\/td>)?\s*(?:<td>)?\s*:?\s*([A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ][A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\s]+)/gi,
          ]
          const names = new Set<string>()
          for (const pattern of partyPatterns) {
            let match
            while ((match = pattern.exec(html)) !== null) {
              const name = match[1].trim().replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
              if (name.length > 3 && !/^(CPF|OAB|ADVOGADO|RÉU|REQUERIDO|CNPJ)/.test(name)) {
                names.add(name)
              }
            }
          }
          if (names.size > 0) {
            const nomeCliente = [...names].join(', ')
            await supabase.from('publicacoes_dje').update({ destinatario: nomeCliente }).eq('id', pub.id)
            htmlExtracted++
          }
        }

        console.log(`Enriquecimento ComunicaPJe: ${enriched} via AdvBox, ${htmlExtracted} via HTML`)
      } catch (enrichErr: any) {
        console.error('Erro no enriquecimento:', enrichErr.message)
      }
    }

    const totalNovas = novasPublicacoes + novasComunicaPje

    // Notificar Rafael se houver novas (DataJud + ComunicaPJe)
    if (totalNovas > 0) {
      const { data: rafaelProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', 'rafael@eggnunes.com.br')
        .single()

      if (rafaelProfile) {
        await supabase.from('user_notifications').insert({
          user_id: rafaelProfile.id,
          title: `📋 ${totalNovas} nova(s) movimentação(ões) processual(is)`,
          message: `Encontradas ${novasPublicacoes} via DataJud e ${novasComunicaPje} via Comunica PJe.`,
          type: 'publicacao_dje',
          action_url: '/publicacoes-dje',
        })
        console.log('Notificação criada para Rafael')
      }
    }

    console.log('=== Sync concluído ===')

    return new Response(JSON.stringify({
      success: true,
      processos_advbox: numerosUnicos.length,
      processos_consultados: processosConsultados,
      movimentacoes_datajud: toInsert.length,
      novas_datajud: novasPublicacoes,
      movimentacoes_comunicapje: comunicaPjeInserts.length,
      novas_comunicapje: novasComunicaPje,
      errors: [...errors, ...comunicaPjeErrors].length > 0 ? [...errors, ...comunicaPjeErrors] : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Erro:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
