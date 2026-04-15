// Advbox Integration Edge Function - Complete Data Fetch

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';
const ADVBOX_TOKEN = Deno.env.get('ADVBOX_API_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Cache simples em memória (válido durante a vida da instância)
const cache = new Map<string, { data: any; timestamp: number; fromCache?: boolean; rateLimited?: boolean }>();

// Status de operações em andamento
const fetchStatus = new Map<string, { inProgress: boolean; startedAt: number; progress: string; error?: string }>();

// Valores padrão caso não consiga buscar do banco
let CACHE_TTL = 5 * 60 * 1000; // 5 minutos
let DELAY_BETWEEN_REQUESTS = 2000; // 2s entre cada request (API permite 30 GETs/min = 1 a cada 2s)

// Buscar configurações do banco
async function loadSettings() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/advbox_settings?select=*&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        CACHE_TTL = data[0].cache_ttl_minutes * 60 * 1000;
        DELAY_BETWEEN_REQUESTS = Math.max(data[0].delay_between_requests_ms, 2000); // Mínimo 2s
        console.log(`Settings loaded: cache_ttl=${CACHE_TTL}ms, delay=${DELAY_BETWEEN_REQUESTS}ms`);
      }
    }
  } catch (error) {
    console.warn('Failed to load settings, using defaults:', error);
  }
}

// Helper: Save dashboard cache to DB (non-blocking, uses service_role)
async function saveDashboardCacheToDb(updates: Record<string, any>) {
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('No service role key, skipping dashboard cache save');
      return;
    }
    const body: Record<string, any> = { id: 'singleton', updated_at: new Date().toISOString(), ...updates };
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/advbox_dashboard_cache?id=eq.singleton`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(body),
      }
    );
    if (!response.ok) {
      console.warn('Failed to save dashboard cache:', response.status, await response.text());
    } else {
      console.log('Dashboard cache saved to DB:', Object.keys(updates));
    }
  } catch (err) {
    console.warn('Error saving dashboard cache to DB:', err);
  }
}

// Helper: Save/read settings cache from DB
async function saveSettingsCacheToDb(settingKey: string, data: any) {
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) return;
    const body = {
      setting_key: settingKey,
      data: JSON.stringify(data),
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Upsert by setting_key
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/advbox_settings_cache?setting_key=eq.${settingKey}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ data, fetched_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      }
    );
    if (!response.ok || response.status === 404) {
      // Try insert if not found
      await fetch(`${SUPABASE_URL}/rest/v1/advbox_settings_cache`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ setting_key: settingKey, data, fetched_at: new Date().toISOString() }),
      });
    }
    console.log(`Settings cache saved for key: ${settingKey}`);
  } catch (err) {
    console.warn('Error saving settings cache:', err);
  }
}

async function getSettingsCacheFromDb(settingKey: string, maxAgeHours = 24): Promise<any | null> {
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) return null;
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/advbox_settings_cache?setting_key=eq.${settingKey}&select=data,fetched_at`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!response.ok) return null;
    const rows = await response.json();
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    const age = (Date.now() - new Date(row.fetched_at).getTime()) / (1000 * 60 * 60);
    if (age > maxAgeHours) {
      console.log(`Settings cache for ${settingKey} is stale (${age.toFixed(1)}h old)`);
      return null;
    }
    return row.data;
  } catch (err) {
    console.warn('Error reading settings cache:', err);
    return null;
  }
}

// Helper: Get full settings with DB cache fallback
async function getSettingsWithCache(forceRefresh = false): Promise<any> {
  const cacheKey = 'advbox-settings-full';
  
  // Check memory cache first
  const memCached = cache.get(cacheKey);
  if (!forceRefresh && memCached && (Date.now() - memCached.timestamp) < 60 * 60 * 1000) {
    return memCached.data;
  }
  
  // Check DB cache
  if (!forceRefresh) {
    const dbCached = await getSettingsCacheFromDb('settings');
    if (dbCached) {
      cache.set(cacheKey, { data: dbCached, timestamp: Date.now() });
      return dbCached;
    }
  }
  
  // Fetch from API
  try {
    const result = await makeAdvboxRequest({ endpoint: '/settings' });
    const settings = result.data || result;
    cache.set(cacheKey, { data: settings, timestamp: Date.now() });
    // Save to DB (non-blocking)
    saveSettingsCacheToDb('settings', settings).catch(() => {});
    return settings;
  } catch (error) {
    // Fall back to any available cache
    if (memCached) return memCached.data;
    const dbFallback = await getSettingsCacheFromDb('settings', 168); // 7 days fallback
    if (dbFallback) return dbFallback;
    throw error;
  }
}


function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface AdvboxRequestOptions {
  endpoint: string;
  method?: string;
  body?: Record<string, unknown>;
}

async function makeAdvboxRequest({ endpoint, method = 'GET', body }: AdvboxRequestOptions, retryCount = 0): Promise<any> {
  const url = `${ADVBOX_API_BASE}${endpoint}`;
  const maxRetries = 5;
  
  console.log(`Making ${method} request to Advbox:`, url);
  
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${ADVBOX_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    
    console.log('Response status:', response.status);
    
    // Se recebeu 429 (Too Many Requests), aguardar e tentar novamente
    if (response.status === 429 && retryCount < maxRetries) {
      const waitTime = Math.pow(2, retryCount) * 2000; // Exponential backoff: 2s, 4s, 8s, 16s, 32s
      console.log(`Rate limited. Waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}`);
      await sleep(waitTime);
      return makeAdvboxRequest({ endpoint, method, body }, retryCount + 1);
    }
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('Advbox API error:', response.status, responseText.substring(0, 200));
      throw new Error(`Advbox API error: ${response.status} - ${responseText.substring(0, 200)}`);
    }

    // Verificar se a resposta é JSON válido
    if (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('[')) {
      console.error('Response is not JSON:', responseText.substring(0, 200));
      throw new Error(`API retornou HTML em vez de JSON. Verifique o endpoint e o token de autenticação.`);
    }

    return JSON.parse(responseText);
  } catch (e) {
    if (e instanceof Error && e.message.includes('Advbox API error')) {
      throw e;
    }
    console.error('Failed to parse JSON:', e);
    throw new Error(`Falha ao fazer parse da resposta`);
  }
}

// Função para buscar todos os dados com paginação COMPLETA
// Função para buscar todos os dados com paginação COMPLETA
// IMPORTANTE: A API Advbox usa limit=100 máximo e offset para paginação (não page)
async function fetchAllPaginatedComplete(
  endpoint: string, 
  cacheKey: string,
  limit = 100, // API aceita máximo de 100
  maxIterations = 100
): Promise<{ items: any[]; totalCount: number; pagesLoaded: number }> {
  let allData: any[] = [];
  let offset = 0;
  let hasMore = true;
  let totalCount = 0;
  let iterations = 0;
  
  console.log(`Starting COMPLETE paginated fetch for: ${endpoint}`);
  fetchStatus.set(cacheKey, { inProgress: true, startedAt: Date.now(), progress: 'Iniciando...' });
  
  try {
    while (hasMore && iterations < maxIterations) {
      // Aguardar antes de cada request para evitar rate limit
      if (iterations > 0) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
      
      fetchStatus.set(cacheKey, { 
        inProgress: true, 
        startedAt: fetchStatus.get(cacheKey)?.startedAt || Date.now(), 
        progress: `Buscando (offset=${offset})... (${allData.length} itens carregados)` 
      });
      
      const response = await makeAdvboxRequest({ 
        endpoint: `${endpoint}${endpoint.includes('?') ? '&' : '?'}limit=${limit}&offset=${offset}` 
      });
      
      const items = response.data || [];
      totalCount = response.totalCount || totalCount || items.length;
      
      // Log all field names from first item to debug date fields
      if (iterations === 0 && items.length > 0) {
        console.log(`[DEBUG] Sample item fields:`, Object.keys(items[0]));
        console.log(`[DEBUG] Sample item date fields:`, JSON.stringify({
          process_date: items[0].process_date,
          created_at: items[0].created_at,
        }));
        // Log full first item to see all available fields
        console.log(`[DEBUG] Full first item:`, JSON.stringify(items[0]).substring(0, 2000));
      }
      
      console.log(`Iteration ${iterations + 1} (offset=${offset}): fetched ${items.length} items (total so far: ${allData.length + items.length}/${totalCount})`);
      
      if (items.length === 0) {
        hasMore = false;
      } else {
        allData = allData.concat(items);
        offset += items.length;
        iterations++;
        
        // Se retornou menos que o limite ou já temos todos, não há mais páginas
        if (items.length < limit || allData.length >= totalCount) {
          hasMore = false;
        }
      }
    }
    
    console.log(`COMPLETE fetch finished: ${allData.length} items in ${iterations} iterations`);
    fetchStatus.set(cacheKey, { 
      inProgress: false, 
      startedAt: fetchStatus.get(cacheKey)?.startedAt || Date.now(), 
      progress: `Completo: ${allData.length} itens carregados` 
    });
    
    return { items: allData, totalCount, pagesLoaded: iterations };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error during paginated fetch for ${cacheKey}:`, errorMsg);
    fetchStatus.set(cacheKey, { 
      inProgress: false, 
      startedAt: fetchStatus.get(cacheKey)?.startedAt || Date.now(), 
      progress: `Erro: ${errorMsg.substring(0, 100)}`,
      error: errorMsg
    });
    throw error;
  }
}

// Função para obter dados do cache ou buscar da API
async function getCachedOrFetch(
  cacheKey: string, 
  fetchFn: () => Promise<any>, 
  forceRefresh = false
): Promise<{ data: any; metadata: { fromCache: boolean; rateLimited: boolean; cacheAge: number } }> {
  const now = Date.now();
  const cached = cache.get(cacheKey);
  
  // Se forçar refresh, ignorar cache fresco e tentar buscar
  if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`Cache hit for: ${cacheKey}`);
    return {
      data: cached.data,
      metadata: {
        fromCache: true,
        rateLimited: false,
        cacheAge: Math.floor((now - cached.timestamp) / 1000),
      },
    };
  }
  
  // Tentar buscar da API
  console.log(`Cache miss or stale for: ${cacheKey}, fetching from API`);

  try {
    const data = await fetchFn();
    // Armazenar no cache com timestamp atual
    cache.set(cacheKey, { data, timestamp: now, fromCache: false, rateLimited: false });
    return {
      data,
      metadata: {
        fromCache: false,
        rateLimited: false,
        cacheAge: 0,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    // Verificar se é um erro transiente (rate limit ou erros de servidor)
    const isTransientError = 
      message.includes('429') || 
      message.includes('502') || 
      message.includes('503') || 
      message.includes('504') ||
      message.includes('500') ||
      message.includes('Bad gateway');

    if (isTransientError) {
      console.warn(`Transient error for ${cacheKey}: ${message.substring(0, 100)}`);
      // SEMPRE retornar cache se existir, independente da idade
      if (cached) {
        console.warn(`Returning cached data (age: ${Math.floor((now - cached.timestamp) / 1000)}s) for ${cacheKey} due to transient error.`);
        return {
          data: cached.data,
          metadata: {
            fromCache: true,
            rateLimited: true,
            cacheAge: Math.floor((now - cached.timestamp) / 1000),
          },
        };
      }
      console.warn(`No cache available for ${cacheKey}. Returning empty result.`);
      return {
        data: [],
        metadata: {
          fromCache: false,
          rateLimited: true,
          cacheAge: 0,
        },
      };
    }

    console.error(`Error fetching data for ${cacheKey}:`, message);
    // Para outros erros, também retornar cache se existir
    if (cached) {
      console.warn(`Returning cached data due to error for ${cacheKey}.`);
      return {
        data: cached.data,
        metadata: {
          fromCache: true,
          rateLimited: false,
          cacheAge: Math.floor((now - cached.timestamp) / 1000),
        },
      };
    }
    throw error;
  }
}

// Helper para extrair items de diferentes formatos de cache
function extractItems(cachedData: any): any[] {
  if (Array.isArray(cachedData)) return cachedData;
  if (Array.isArray(cachedData?.items)) return cachedData.items;
  if (Array.isArray(cachedData?.data)) return cachedData.data;
  return [];
}

// Helper para extrair totalCount de diferentes formatos
function extractTotalCount(cachedData: any, fallback: number): number {
  if (!cachedData) return fallback;
  return cachedData.totalCount ?? cachedData.total ?? cachedData.count ?? fallback;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Verify user is authenticated and approved
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify user with Supabase Auth
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY!,
      },
    });

    if (!userResponse.ok) {
      console.error('Failed to verify user token');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userData = await userResponse.json();
    const userId = userData.id;

    if (!userId) {
      console.error('No user ID in token');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is approved - use the user's token for RLS policies
    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=approval_status,is_active`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (profileResponse.ok) {
      const profiles = await profileResponse.json();
      if (profiles.length === 0) {
        console.error('User profile not found:', userId);
        return new Response(JSON.stringify({ error: 'Acesso não autorizado' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const profile = profiles[0];
      if (profile.approval_status !== 'approved' || !profile.is_active) {
        console.error('User not approved or inactive:', userId, profile.approval_status, profile.is_active);
        return new Response(JSON.stringify({ error: 'Acesso não autorizado. Aguarde aprovação do administrador.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.error('Failed to fetch user profile');
      return new Response(JSON.stringify({ error: 'Erro ao verificar permissões' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User verified:', userId);

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    const forceRefresh = url.searchParams.get('force_refresh') === 'true';

    console.log('Advbox integration called:', path, 'force_refresh:', forceRefresh);

    // Auto-populate settings cache in background on first request
    if (!cache.has('advbox-settings-full')) {
      getSettingsWithCache().catch(err => console.warn('Background settings cache population failed:', err));
    }

    switch (path) {
      // ========== REFRESH SETTINGS ==========
      case 'refresh-settings': {
        console.log('Force refreshing settings cache...');
        try {
          const settings = await getSettingsWithCache(true);
          return new Response(JSON.stringify({ 
            success: true, 
            data: settings,
            message: 'Settings cache atualizado com sucesso',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          return new Response(JSON.stringify({ 
            error: 'Falha ao atualizar cache de settings',
            details: error instanceof Error ? error.message : String(error),
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // ========== PROCESSOS (LAWSUITS) ==========
      
      // Endpoint COMPLETO - busca TODOS os processos com paginação
      case 'lawsuits-full': {
        console.log('Fetching ALL lawsuits with complete pagination...');
        const cacheKey = 'lawsuits-full';
        
        // Verificar se já temos dados completos em cache
        const cached = cache.get(cacheKey);
        const now = Date.now();
        
        if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL) {
          const items = extractItems(cached.data);
          const totalCount = extractTotalCount(cached.data, items.length);
          console.log(`Cache hit for lawsuits-full: ${items.length} items`);
          
          return new Response(JSON.stringify({
            data: items,
            totalCount,
            isComplete: items.length >= totalCount,
            metadata: {
              fromCache: true,
              rateLimited: false,
              cacheAge: Math.floor((now - cached.timestamp) / 1000),
            },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Buscar todos os processos com paginação completa
        try {
          const result = await fetchAllPaginatedComplete('/lawsuits', cacheKey, 1000, 50);
          
          // Salvar no cache em memória
          cache.set(cacheKey, { 
            data: { items: result.items, totalCount: result.totalCount },
            timestamp: now,
          });
          
          // Salvar no banco para cache persistente (non-blocking)
          saveDashboardCacheToDb({
            total_lawsuits: result.totalCount,
            lawsuits_data: result.items.map((l: any) => ({
              id: l.id, process_number: l.process_number, protocol_number: l.protocol_number,
              folder: l.folder, process_date: l.process_date, fees_expec: l.fees_expec,
              fees_money: l.fees_money, contingency: l.contingency, type_lawsuit_id: l.type_lawsuit_id,
              type: l.type, group_id: l.group_id, group: l.group, created_at: l.created_at,
              status_closure: l.status_closure, exit_production: l.exit_production,
              exit_execution: l.exit_execution, responsible_id: l.responsible_id,
              responsible: l.responsible, customers: l.customers,
            })),
            metadata: { fromCache: false, rateLimited: false, cacheAge: 0 },
          }).catch(() => {});
          
          return new Response(JSON.stringify({
            data: result.items,
            totalCount: result.totalCount,
            pagesLoaded: result.pagesLoaded,
            isComplete: result.items.length >= result.totalCount,
            metadata: {
              fromCache: false,
              rateLimited: false,
              cacheAge: 0,
            },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          // Se falhar, retornar cache existente se disponível
          if (cached) {
            const items = extractItems(cached.data);
            const totalCount = extractTotalCount(cached.data, items.length);
            return new Response(JSON.stringify({
              data: items,
              totalCount,
              isComplete: items.length >= totalCount,
              error: error instanceof Error ? error.message : 'Unknown error',
              metadata: {
                fromCache: true,
                rateLimited: true,
                cacheAge: Math.floor((now - cached.timestamp) / 1000),
              },
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw error;
        }
      }

      // Endpoint para buscar processos de um cliente específico
      case 'lawsuits-by-customer': {
        const customerId = url.searchParams.get('customer_id');
        if (!customerId) {
          return new Response(JSON.stringify({ error: 'customer_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`Fetching lawsuits for customer_id=${customerId}...`);

        try {
          const response = await makeAdvboxRequest({
            endpoint: `/lawsuits?customer_id=${customerId}&limit=100`,
          });

          const items = response.data || [];
          console.log(`Found ${items.length} lawsuits for customer ${customerId}`);

          return new Response(JSON.stringify({
            data: items,
            totalCount: response.totalCount || items.length,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Error fetching lawsuits by customer:', error);
          return new Response(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            data: [],
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Endpoint para buscar processos recentes por data
      // ESTRATÉGIA: Buscar TODOS os processos com paginação completa e filtrar
      // A API Advbox retorna processos ordenados por ID (mais antigo primeiro),
      // então precisamos buscar tudo para encontrar os recentes
      case 'lawsuits-recent': {
        const startDate = url.searchParams.get('start_date'); // formato: YYYY-MM-DD
        const endDate = url.searchParams.get('end_date'); // formato: YYYY-MM-DD (opcional)
        
        console.log(`Fetching RECENT lawsuits from ${startDate} to ${endDate || 'now'}...`);
        
        if (!startDate) {
          return new Response(JSON.stringify({ 
            error: 'start_date is required (format: YYYY-MM-DD)' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const now = Date.now();
        const startDateObj = new Date(startDate + 'T00:00:00Z');
        const endDateObj = endDate ? new Date(endDate + 'T23:59:59Z') : new Date();
        
        // PRIORIDADE 1: Usar cache completo se disponível
        const fullCacheKey = 'lawsuits-full';
        let allLawsuits: any[] = [];
        let apiTotalCount = 0;
        let fromCache = false;
        let cacheAge = 0;
        let dataSource = 'none';
        
        const fullCached = cache.get(fullCacheKey);
        
        // Verificar cache completo (pode ter mais dados)
        if (fullCached) {
          const cachedItems = extractItems(fullCached.data);
          // Usar cache se tiver dados significativos (mais de 5000 = provavelmente completo)
          if (cachedItems.length > 5000) {
            allLawsuits = cachedItems;
            apiTotalCount = extractTotalCount(fullCached.data, cachedItems.length);
            fromCache = true;
            cacheAge = Math.floor((now - fullCached.timestamp) / 1000);
            dataSource = 'full-cache';
            console.log(`Using lawsuits-full cache: ${allLawsuits.length} items (age: ${cacheAge}s)`);
          }
        }
        
        // PRIORIDADE 2: Se não tem cache completo, buscar TUDO da API
        if (allLawsuits.length === 0) {
          console.log('No complete cache found, fetching ALL lawsuits from API...');
          try {
            // Buscar todos os processos com paginação completa
            const result = await fetchAllPaginatedComplete('/lawsuits', 'lawsuits-recent-temp', 1000, 50);
            allLawsuits = result.items;
            apiTotalCount = result.totalCount;
            dataSource = 'api-full';
            console.log(`Fetched ALL ${allLawsuits.length} lawsuits from API`);
            
            // Salvar no cache completo para uso futuro
            cache.set(fullCacheKey, { 
              data: { items: allLawsuits, totalCount: apiTotalCount },
              timestamp: now,
            });
          } catch (error) {
            console.error('Error fetching all lawsuits:', error);
            // Fallback: tentar usar qualquer cache disponível
            if (fullCached) {
              allLawsuits = extractItems(fullCached.data);
              apiTotalCount = extractTotalCount(fullCached.data, allLawsuits.length);
              fromCache = true;
              cacheAge = Math.floor((now - fullCached.timestamp) / 1000);
              dataSource = 'full-cache-fallback';
            }
          }
        }
        
        // FILTRAR os processos pela data
        const filteredLawsuits = allLawsuits.filter((lawsuit: any) => {
          let processDate: Date | null = null;
          
          // Priorizar process_date (data real do processo)
          if (lawsuit.process_date) {
            const parsed = new Date(lawsuit.process_date);
            if (!isNaN(parsed.getTime())) processDate = parsed;
          }
          // Fallback para created_at
          if (!processDate && lawsuit.created_at) {
            const parsed = new Date(lawsuit.created_at.replace(' ', 'T'));
            if (!isNaN(parsed.getTime())) processDate = parsed;
          }
          
          if (!processDate) return false;
          
          return processDate >= startDateObj && processDate <= endDateObj;
        });
        
        console.log(`Filtered ${filteredLawsuits.length} lawsuits from ${startDate} to ${endDate || 'now'} (from ${allLawsuits.length} total, source: ${dataSource})`);
        
        // Log sample para debug
        if (filteredLawsuits.length > 0) {
          const sample = filteredLawsuits.slice(0, 5).map((item: any) => ({
            id: item.id,
            process_date: item.process_date,
            created_at: item.created_at,
          }));
          console.log('[DEBUG] Sample filtered lawsuits:', JSON.stringify(sample));
        } else {
          // Debug: mostrar distribuição de datas para entender o problema
          const dateDistribution: Record<string, number> = {};
          allLawsuits.forEach((l: any) => {
            const date = l.process_date || l.created_at;
            if (date) {
              const yearMonth = date.substring(0, 7);
              dateDistribution[yearMonth] = (dateDistribution[yearMonth] || 0) + 1;
            }
          });
          const recentMonths = Object.entries(dateDistribution)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 10);
          console.log('[DEBUG] Most recent months in data:', recentMonths);
        }
        
        return new Response(JSON.stringify({
          data: filteredLawsuits,
          totalCount: filteredLawsuits.length,
          apiTotalCount,
          startDate,
          endDate,
          dataSource,
          metadata: {
            fromCache,
            rateLimited: false,
            cacheAge,
            filteredFromTotal: allLawsuits.length,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Endpoint rápido - busca apenas primeira página (para carregamento inicial)
      // NOTA: A API tem limit máximo de 100, usamos offset para paginação
      case 'lawsuits': {
        console.log('Fetching lawsuits first page with totalCount...');
        const rawResult = await getCachedOrFetch(
          'lawsuits-first-page',
          async () => {
            // Buscar primeira página (limit=100 é o máximo da API)
            const response = await makeAdvboxRequest({ endpoint: '/lawsuits?limit=100&offset=0' });
            const items = Array.isArray(response.data) ? response.data : [];
            const totalCount = typeof response.totalCount === 'number' ? response.totalCount : items.length;
            return { items, totalCount };
          },
          forceRefresh
        );

        const items = extractItems(rawResult.data);
        const totalCount = extractTotalCount(rawResult.data, items.length);

        return new Response(JSON.stringify({
          data: items,
          metadata: rawResult.metadata,
          totalCount,
          isPartial: items.length < totalCount,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ========== MOVIMENTAÇÕES ==========
      
      // Endpoint para buscar TODAS as movimentações com paginação completa (paralelo)
      case 'movements-full': {
        console.log('Fetching ALL movements with PARALLEL pagination...');
        const dateStart = url.searchParams.get('date_start');
        const dateEnd = url.searchParams.get('date_end');
        const cacheKey = dateStart ? `movements-full-${dateStart}-${dateEnd || 'now'}` : 'movements-full';
        
        const cached = cache.get(cacheKey);
        const now = Date.now();
        
        if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL) {
          const items = extractItems(cached.data);
          const totalCount = extractTotalCount(cached.data, items.length);
          console.log(`Cache hit for ${cacheKey}: ${items.length} items`);
          
          return new Response(JSON.stringify({
            data: items,
            totalCount,
            isComplete: items.length >= totalCount,
            metadata: {
              fromCache: true,
              rateLimited: false,
              cacheAge: Math.floor((now - cached.timestamp) / 1000),
            },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        try {
          // Build endpoint with optional date filters (API v1.2.0)
          let movEndpoint = '/last_movements?limit=100&offset=0';
          if (dateStart) movEndpoint += `&date_start=${dateStart}`;
          if (dateEnd) movEndpoint += `&date_end=${dateEnd}`;
          
          const firstPage = await makeAdvboxRequest({ endpoint: movEndpoint });
          const firstItems = firstPage.data || [];
          const totalCount = firstPage.totalCount || firstItems.length;
          
          console.log(`movements-full: totalCount=${totalCount}, first page=${firstItems.length}`);
          
          let allItems = [...firstItems];
          
          if (firstItems.length >= 100 && allItems.length < totalCount) {
            // Calcular todas as páginas restantes
            const remainingPages: number[] = [];
            for (let offset = 100; offset < totalCount && remainingPages.length < 200; offset += 100) {
              remainingPages.push(offset);
            }
            
            // Buscar em lotes paralelos de 5
            const BATCH_SIZE = 3; // Reduced from 5 to comply with 30 GETs/min limit
            for (let i = 0; i < remainingPages.length; i += BATCH_SIZE) {
              const batch = remainingPages.slice(i, i + BATCH_SIZE);
              
              const batchPromises = batch.map(offset => {
                let batchEndpoint = `/last_movements?limit=100&offset=${offset}`;
                if (dateStart) batchEndpoint += `&date_start=${dateStart}`;
                if (dateEnd) batchEndpoint += `&date_end=${dateEnd}`;
                return makeAdvboxRequest({ endpoint: batchEndpoint })
                  .then(res => res.data || [])
                  .catch(err => {
                    console.warn(`Failed to fetch movements offset=${offset}:`, err.message);
                    return [];
                  });
              });
              
              const batchResults = await Promise.all(batchPromises);
              for (const items of batchResults) {
                allItems = allItems.concat(items);
              }
              
              console.log(`movements-full: loaded ${allItems.length}/${totalCount} (batch ${Math.floor(i/BATCH_SIZE)+1})`);
              
              // Small delay between batches to avoid rate limiting
              if (i + BATCH_SIZE < remainingPages.length) {
                await sleep(1000);
              }
            }
          }
          
          console.log(`movements-full: COMPLETE - ${allItems.length} items loaded`);
          
          cache.set(cacheKey, { 
            data: { items: allItems, totalCount },
            timestamp: now,
          });
          
          // Salvar movimentações no cache persistente do banco (non-blocking)
          saveDashboardCacheToDb({
            total_movements: totalCount,
            movements_data: allItems.map((m: any) => ({
              lawsuit_id: m.lawsuit_id, date: m.date, title: m.title,
              header: m.header, process_number: m.process_number,
              protocol_number: m.protocol_number, customers: m.customers,
            })),
          }).catch(() => {});
          
          return new Response(JSON.stringify({
            data: allItems,
            totalCount,
            pagesLoaded: Math.ceil(allItems.length / 100),
            isComplete: allItems.length >= totalCount,
            metadata: {
              fromCache: false,
              rateLimited: false,
              cacheAge: 0,
            },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          if (cached) {
            const items = extractItems(cached.data);
            const totalCount = extractTotalCount(cached.data, items.length);
            return new Response(JSON.stringify({
              data: items,
              totalCount,
              isComplete: items.length >= totalCount,
              error: error instanceof Error ? error.message : 'Unknown error',
              metadata: {
                fromCache: true,
                rateLimited: true,
                cacheAge: Math.floor((now - cached.timestamp) / 1000),
              },
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw error;
        }
      }
      
      // Dedicated count-only endpoint - returns ONLY the total count, no data
      case 'movements-count': {
        console.log('Fetching movements count only (limit=1)...');
        const cacheKey = 'movements-count';
        const cached = cache.get(cacheKey);
        const now = Date.now();
        const COUNT_CACHE_TTL = 3 * 60 * 1000; // 3 minutes for count

        if (!forceRefresh && cached && (now - cached.timestamp) < COUNT_CACHE_TTL) {
          console.log(`[movements-count] Cache hit: totalCount=${cached.data.totalCount}`);
          return new Response(JSON.stringify({ totalCount: cached.data.totalCount }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        try {
          const response = await makeAdvboxRequest({ endpoint: '/last_movements?limit=1&offset=0' });
          const totalCount = typeof response.totalCount === 'number' ? response.totalCount : 0;
          console.log(`[movements-count] API returned totalCount: ${totalCount}`);
          
          cache.set(cacheKey, { data: { totalCount }, timestamp: now });
          
          return new Response(JSON.stringify({ totalCount }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('[movements-count] Error:', error);
          if (cached) {
            return new Response(JSON.stringify({ totalCount: cached.data.totalCount, fromCache: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify({ totalCount: null, error: 'Failed to fetch count' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'last-movements': {
        console.log('Fetching movements first page with totalCount...');
        const rawResult = await getCachedOrFetch(
          'last-movements-first-page',
          async () => {
            // Buscar primeira página (limit=100 é o máximo da API)
            const response = await makeAdvboxRequest({ endpoint: '/last_movements?limit=100&offset=0' });
            const items = Array.isArray(response.data) ? response.data : [];
            const totalCount = typeof response.totalCount === 'number' ? response.totalCount : items.length;
            return { items, totalCount };
          },
          forceRefresh
        );

        const items = extractItems(rawResult.data);
        const totalCount = extractTotalCount(rawResult.data, items.length);

        console.log(`[last-movements] Returning ${items.length} items, totalCount: ${totalCount}`);

        return new Response(JSON.stringify({
          data: items,
          metadata: rawResult.metadata,
          totalCount,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'lawsuit-by-id': {
        let lawsuitId = url.searchParams.get('lawsuit_id') || url.searchParams.get('id');

        if (!lawsuitId && req.method !== 'OPTIONS') {
          try {
            const body = await req.json();
            if (body && typeof body === 'object' && 'lawsuit_id' in body) {
              lawsuitId = String((body as any).lawsuit_id);
            }
          } catch (err) {
            console.warn('Failed to parse body for lawsuit-by-id endpoint:', err);
          }
        }

        if (!lawsuitId) {
          return new Response(JSON.stringify({ error: 'lawsuit_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const data = await makeAdvboxRequest({ endpoint: `/lawsuits/${lawsuitId}` });
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'movements': {
        const lawsuitId = url.searchParams.get('lawsuit_id');
        if (!lawsuitId) {
          return new Response(JSON.stringify({ error: 'lawsuit_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const data = await makeAdvboxRequest({ endpoint: `/movements/${lawsuitId}` });
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ========== CLIENTES E ANIVERSÁRIOS ==========
      
      case 'customers': {
        console.log('Fetching ALL customers with complete pagination...');
        const cacheKey = 'customers-full';
        
        // Verificar se já temos dados completos em cache
        const cached = cache.get(cacheKey);
        const now = Date.now();
        
        if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL) {
          const items = extractItems(cached.data);
          const totalCount = extractTotalCount(cached.data, items.length);
          console.log(`Cache hit for customers: ${items.length} items`);
          
          return new Response(JSON.stringify({
            data: { items, totalCount },
            metadata: {
              fromCache: true,
              rateLimited: false,
              cacheAge: Math.floor((now - cached.timestamp) / 1000),
            },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Buscar todos os clientes com paginação completa
        try {
          const result = await fetchAllPaginatedComplete('/customers', cacheKey, 100, 100);
          
          // Salvar no cache
          cache.set(cacheKey, { 
            data: { items: result.items, totalCount: result.totalCount },
            timestamp: now,
          });
          
          return new Response(JSON.stringify({
            data: { items: result.items, totalCount: result.totalCount },
            pagesLoaded: result.pagesLoaded,
            isComplete: result.items.length >= result.totalCount,
            metadata: {
              fromCache: false,
              rateLimited: false,
              cacheAge: 0,
            },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          // Se falhar, retornar cache existente se disponível
          if (cached) {
            const items = extractItems(cached.data);
            const totalCount = extractTotalCount(cached.data, items.length);
            return new Response(JSON.stringify({
              data: { items, totalCount },
              error: error instanceof Error ? error.message : 'Unknown error',
              metadata: {
                fromCache: true,
                rateLimited: true,
                cacheAge: Math.floor((now - cached.timestamp) / 1000),
              },
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw error;
        }
      }

      case 'customer-birthdays': {
        const result = await getCachedOrFetch('customer-birthdays', async () => {
          return await makeAdvboxRequest({ endpoint: '/customers/birthdays' });
        }, forceRefresh);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ========== PUBLICAÇÕES ==========
      
      case 'recent-publications': {
        console.log('Fetching recent publications from movements...');
        const result = await getCachedOrFetch('last-movements', async () => {
          // Buscar com paginação para ter mais publicações
          const response = await makeAdvboxRequest({ endpoint: '/last_movements?limit=1000&page=1' });
          return response.data || [];
        }, forceRefresh);
        
        // Filtrar apenas movimentações do tipo publicação
        const allData = extractItems(result.data);
        const publications = allData.filter((movement: any) => 
          movement.type === 'publication' || 
          movement.description?.toLowerCase().includes('publicação') ||
          movement.description?.toLowerCase().includes('publicacao')
        );
        
        return new Response(JSON.stringify({ 
          data: publications, 
          metadata: result.metadata 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'publications': {
        let lawsuitId = url.searchParams.get('lawsuit_id');

        if (!lawsuitId && req.method !== 'OPTIONS') {
          try {
            const body = await req.json();
            if (body && typeof body === 'object' && 'lawsuit_id' in body) {
              lawsuitId = String((body as any).lawsuit_id);
            }
          } catch (err) {
            console.warn('Failed to parse body for publications endpoint:', err);
          }
        }

        if (!lawsuitId) {
          return new Response(JSON.stringify({ error: 'lawsuit_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const data = await makeAdvboxRequest({ endpoint: `/publications/${lawsuitId}` });
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ========== TAREFAS (POSTS) ==========
      
      case 'tasks': {
        console.log('Fetching ALL tasks with complete pagination...');
        const cacheKey = 'tasks-full';
        
        // Verificar se já temos dados completos em cache
        const cached = cache.get(cacheKey);
        const now = Date.now();
        
        if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL) {
          const items = extractItems(cached.data);
          const totalCount = extractTotalCount(cached.data, items.length);
          console.log(`Cache hit for tasks: ${items.length} items`);
          
          return new Response(JSON.stringify({
            data: items,
            totalCount,
            isComplete: items.length >= totalCount,
            metadata: {
              fromCache: true,
              rateLimited: false,
              cacheAge: Math.floor((now - cached.timestamp) / 1000),
            },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Buscar todas as tarefas com paginação completa
        try {
          const result = await fetchAllPaginatedComplete('/posts', cacheKey, 100, 100);
          
          // Salvar no cache
          cache.set(cacheKey, { 
            data: { items: result.items, totalCount: result.totalCount },
            timestamp: now,
          });
          
          return new Response(JSON.stringify({
            data: result.items,
            totalCount: result.totalCount,
            pagesLoaded: result.pagesLoaded,
            isComplete: result.items.length >= result.totalCount,
            metadata: {
              fromCache: false,
              rateLimited: false,
              cacheAge: 0,
            },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          // Se falhar, retornar cache existente se disponível
          if (cached) {
            const items = extractItems(cached.data);
            const totalCount = extractTotalCount(cached.data, items.length);
            return new Response(JSON.stringify({
              data: items,
              totalCount,
              isComplete: items.length >= totalCount,
              error: error instanceof Error ? error.message : 'Unknown error',
              metadata: {
                fromCache: true,
                rateLimited: true,
                cacheAge: Math.floor((now - cached.timestamp) / 1000),
              },
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw error;
        }
      }
      
      // Endpoint para buscar tarefas por usuário (para perfil do colaborador)
      case 'tasks-by-user': {
        const userName = url.searchParams.get('user_name');
        const userId = url.searchParams.get('user_id');
        
        console.log(`Fetching tasks for user: ${userName || userId}`);
        
        // Buscar todas as tarefas primeiro
        const cacheKey = 'tasks-full';
        const cached = cache.get(cacheKey);
        const now = Date.now();
        
        let allTasks: any[] = [];
        
        if (cached && (now - cached.timestamp) < CACHE_TTL) {
          allTasks = extractItems(cached.data);
        } else {
          try {
            const result = await fetchAllPaginatedComplete('/posts', cacheKey, 100, 100);
            allTasks = result.items;
            cache.set(cacheKey, { 
              data: { items: result.items, totalCount: result.totalCount },
              timestamp: now,
            });
          } catch (error) {
            if (cached) {
              allTasks = extractItems(cached.data);
            } else {
              throw error;
            }
          }
        }
        
        // Filtrar tarefas pelo usuário
        const userTasks = allTasks.filter((task: any) => {
          // Verificar várias formas de identificar o responsável
          const assignedTo = (task.assigned_to || task.responsible || task.user_name || '').toLowerCase();
          const responsibleId = task.responsible_id || task.user_id || task.assigned_user_id;
          
          if (userId && responsibleId && String(responsibleId) === String(userId)) {
            return true;
          }
          
          if (userName) {
            const searchName = userName.toLowerCase();
            const firstName = searchName.split(' ')[0];
            return assignedTo.includes(firstName) || assignedTo.includes(searchName);
          }
          
          return false;
        });
        
        // Agrupar por mês para estatísticas
        const porMes: Record<string, { concluidas: number; total: number; pontos: number }> = {};
        
        userTasks.forEach((task: any) => {
          const dueDate = task.due_date || task.deadline || task.date || task.created_at;
          if (!dueDate) return;
          
          try {
            const date = new Date(dueDate);
            if (isNaN(date.getTime())) return;
            
            const mesKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!porMes[mesKey]) {
              porMes[mesKey] = { concluidas: 0, total: 0, pontos: 0 };
            }
            porMes[mesKey].total++;
            
            const status = (task.status || task.situation || '').toLowerCase();
            const isConcluida = ['concluída', 'concluido', 'completed', 'done', 'finalizada', 'finalizado'].some(s => status.includes(s));
            
            if (isConcluida) {
              porMes[mesKey].concluidas++;
              // Calcular pontos (pode variar por tipo de tarefa)
              const pontos = task.points || task.score || 1;
              porMes[mesKey].pontos += pontos;
            }
          } catch (e) {
            console.warn('Error parsing date:', dueDate);
          }
        });
        
        // Converter para array ordenado
        const estatisticasMensais = Object.entries(porMes)
          .map(([mesKey, dados]) => ({
            mes: mesKey,
            tarefas_concluidas: dados.concluidas,
            tarefas_atribuidas: dados.total,
            pontos: dados.pontos,
            percentual_conclusao: dados.total > 0 ? Math.round((dados.concluidas / dados.total) * 100) : 0
          }))
          .sort((a, b) => a.mes.localeCompare(b.mes));
        
        return new Response(JSON.stringify({
          data: {
            tarefas: userTasks,
            estatisticas_mensais: estatisticasMensais,
            total_tarefas: userTasks.length,
            total_concluidas: userTasks.filter((t: any) => {
              const status = (t.status || t.situation || '').toLowerCase();
              return ['concluída', 'concluido', 'completed', 'done', 'finalizada', 'finalizado'].some(s => status.includes(s));
            }).length,
          },
          metadata: {
            fromCache: cached ? (now - cached.timestamp) < CACHE_TTL : false,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'task-types': {
        // A API Advbox não tem endpoint específico para tipos de tarefa
        // Tentamos buscar do endpoint /settings que pode conter configurações
        console.log('Fetching task types from settings...');
        try {
          const settingsResult = await makeAdvboxRequest({ endpoint: '/settings' });
          console.log('Settings response keys:', Object.keys(settingsResult));
          
          // Verificar se settings contém tasks ou task_types
          const settings = settingsResult.data || settingsResult;
          let taskTypes: { id: number | string; name: string }[] = [];
          
          // Tentar extrair tipos de tarefa de diferentes locais possíveis
          if (settings.tasks && Array.isArray(settings.tasks)) {
            console.log('Found tasks in settings, count:', settings.tasks.length);
            // Log sample item to debug structure
            if (settings.tasks.length > 0) {
              console.log('Sample task type from settings:', JSON.stringify(settings.tasks[0]));
              console.log('All task type keys:', Object.keys(settings.tasks[0]));
            }
            
            // Map task types correctly - Advbox settings.tasks usa campo 'id' como identificador
            // mas pode ter outro campo como o identificador real de tipo
            taskTypes = settings.tasks.map((t: any) => {
              // Priorizar tasks_id se existir, senão usar id
              const taskTypeId = t.tasks_id ?? t.task_id ?? t.id;
              return {
                id: taskTypeId,
                name: t.task || t.name || t.title || `Tipo ${taskTypeId}`,
              };
            }).filter((t: any) => t.id != null && t.name);
            
            console.log('Mapped task types (first 5):', JSON.stringify(taskTypes.slice(0, 5)));
          } else if (settings.task_types && Array.isArray(settings.task_types)) {
            console.log('Found task_types in settings');
            taskTypes = settings.task_types.map((t: any) => ({
              id: t.tasks_id ?? t.task_id ?? t.id,
              name: t.task || t.name || t.title || `Tipo ${t.id}`,
            })).filter((t: any) => t.id != null && t.name);
          } else if (settings.account?.tasks) {
            console.log('Found account.tasks in settings');
            const accountTasks = Array.isArray(settings.account.tasks) ? settings.account.tasks : [];
            taskTypes = accountTasks.map((t: any) => ({
              id: t.tasks_id ?? t.task_id ?? t.id,
              name: t.task || t.name || t.title || `Tipo ${t.id}`,
            })).filter((t: any) => t.id != null && t.name);
          } else if (settings.account) {
            console.log('Settings account keys:', Object.keys(settings.account));
          }
          
          if (taskTypes.length > 0) {
            return new Response(JSON.stringify({ data: taskTypes, source: 'settings' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          // Se não encontrou em settings, tentar extrair de tarefas existentes
          console.log('No task types in settings, extracting from existing posts...');
          const postsResult = await getCachedOrFetch('tasks', async () => {
            return await makeAdvboxRequest({ endpoint: '/posts' });
          }, false);
          
          const posts = postsResult.data?.data || postsResult.data || [];
          const uniqueTaskTypes = new Map();
          
          if (Array.isArray(posts) && posts.length > 0) {
            // Log first post structure for debugging
            const firstPost = posts[0];
            console.log('First post keys:', Object.keys(firstPost));
            console.log('First post preview:', JSON.stringify(firstPost).substring(0, 500));
            
            posts.forEach((post: any) => {
              // Tentar várias formas de extrair o tipo de tarefa
              if (post.tasks_id && post.task_name) {
                uniqueTaskTypes.set(String(post.tasks_id), {
                  id: String(post.tasks_id),
                  name: post.task_name,
                });
              } else if (post.task?.id && post.task?.name) {
                uniqueTaskTypes.set(String(post.task.id), {
                  id: String(post.task.id),
                  name: post.task.name,
                });
              } else if (post.tasks_id && post.task) {
                uniqueTaskTypes.set(String(post.tasks_id), {
                  id: String(post.tasks_id),
                  name: post.task,
                });
              } else if (post.type_id && post.type_name) {
                uniqueTaskTypes.set(String(post.type_id), {
                  id: String(post.type_id),
                  name: post.type_name,
                });
              }
            });
          }
          
          const extractedTypes = Array.from(uniqueTaskTypes.values());
          console.log(`Extracted ${extractedTypes.length} unique task types from ${posts.length} posts`);
          
          return new Response(JSON.stringify({ 
            data: extractedTypes, 
            source: 'posts',
            totalPosts: posts.length,
            samplePostKeys: Array.isArray(posts) && posts.length > 0 ? Object.keys(posts[0]) : [],
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Error fetching task types:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to fetch task types', 
            details: error instanceof Error ? error.message : String(error),
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'settings': {
        // Endpoint para buscar configurações da conta (com cache persistente)
        const settings = await getSettingsWithCache(forceRefresh);
        return new Response(JSON.stringify({ data: settings }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'users': {
        // Buscar usuários do Advbox via settings
        console.log('Fetching users from settings...');
        try {
          const settingsResult = await getCachedOrFetch('settings', async () => {
            return await makeAdvboxRequest({ endpoint: '/settings' });
          }, forceRefresh);
          
          const settings = settingsResult.data?.data || settingsResult.data || settingsResult;
          console.log('Settings keys for users:', Object.keys(settings));
          
          let users: any[] = [];
          
          // Tentar extrair usuários de diferentes locais possíveis
          if (settings.users && Array.isArray(settings.users)) {
            users = settings.users;
            console.log(`Found ${users.length} users in settings.users`);
          } else if (settings.account?.users && Array.isArray(settings.account.users)) {
            users = settings.account.users;
            console.log(`Found ${users.length} users in settings.account.users`);
          } else if (settings.members && Array.isArray(settings.members)) {
            users = settings.members;
            console.log(`Found ${users.length} users in settings.members`);
          } else if (settings.account?.members && Array.isArray(settings.account.members)) {
            users = settings.account.members;
            console.log(`Found ${users.length} users in settings.account.members`);
          } else if (settings.responsibles && Array.isArray(settings.responsibles)) {
            users = settings.responsibles;
            console.log(`Found ${users.length} users in settings.responsibles`);
          } else {
            // Log available keys for debugging
            console.log('No users array found. Available settings keys:', 
              JSON.stringify(Object.keys(settings)).substring(0, 500));
            if (settings.account) {
              console.log('Account keys:', JSON.stringify(Object.keys(settings.account)).substring(0, 500));
            }
          }
          
          // Normalizar formato dos usuários
          const normalizedUsers = users.map((u: any) => ({
            id: u.id || u.user_id || u.member_id,
            name: u.name || u.full_name || u.nome || u.email || `Usuário ${u.id || u.user_id}`,
            email: u.email,
          })).filter((u: any) => u.id);
          
          return new Response(JSON.stringify({ 
            data: normalizedUsers, 
            source: 'settings',
            rawCount: users.length,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Error fetching users:', error);
          return new Response(JSON.stringify({ 
            error: 'Failed to fetch users',
            details: error instanceof Error ? error.message : String(error),
            data: [],
          }), {
            status: 200, // Return 200 with empty array so frontend can fallback
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      case 'create-task': {
        const body = await req.json();
        console.log('Creating task with body:', JSON.stringify(body));
        
        // Validar campos obrigatórios conforme API v1.2.0
        if (!body.from) {
          // Tentar buscar o primeiro usuário do settings cache como fallback
          try {
            const settings = await getSettingsWithCache();
            const users = settings.users || settings.account?.users || [];
            if (users.length > 0) {
              body.from = users[0].id;
              console.log('Auto-assigned from user:', body.from);
            }
          } catch (e) {
            console.warn('Could not auto-assign from user:', e);
          }
        }

        if (!body.tasks_id) {
          return new Response(JSON.stringify({ error: 'tasks_id é obrigatório (tipo da tarefa)' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!body.lawsuits_id) {
          return new Response(JSON.stringify({ error: 'lawsuits_id é obrigatório (processo vinculado)' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Formatar start_date se necessário (API espera DD/MM/YYYY)
        if (body.start_date && body.start_date.includes('-')) {
          const [y, m, d] = body.start_date.split('-');
          body.start_date = `${d}/${m}/${y}`;
        }
        if (!body.start_date) {
          const now = new Date();
          body.start_date = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        }

        // Garantir guests como array
        if (!body.guests) {
          body.guests = body.from ? [body.from] : [];
        } else if (!Array.isArray(body.guests)) {
          body.guests = [body.guests];
        }

        // Formatar date_deadline se presente
        if (body.date_deadline && body.date_deadline.includes('-')) {
          const [y, m, d] = body.date_deadline.split('-');
          body.date_deadline = `${d}/${m}/${y}`;
        }
        
        const data = await makeAdvboxRequest({ 
          endpoint: '/posts', 
          method: 'POST',
          body 
        });
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update-task': {
        const body = await req.json();
        const { task_id, ...updateData } = body;
        
        if (!task_id) {
          return new Response(JSON.stringify({ error: 'Task ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const data = await makeAdvboxRequest({ 
          endpoint: `/posts/${task_id}`, 
          method: 'PUT',
          body: updateData 
        });
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'complete-task': {
        // A API do ADVBox não possui endpoint para concluir/atualizar tarefas.
        // A conclusão deve ser feita localmente na tabela advbox_tasks.
        return new Response(JSON.stringify({ 
          error: 'A API do ADVBox não possui endpoint para concluir tarefas. Use a atualização local na tabela advbox_tasks.',
          limitation: true 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ========== TRANSAÇÕES FINANCEIRAS ==========
      // Security: Financial endpoints require 'financial' permission (view or edit)
      
      case 'transactions': {
        // Check financial permission before allowing access
        const permCheckTransactions = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/get_admin_permission`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ _user_id: userId, _feature: 'financial' }),
          }
        );
        
        if (permCheckTransactions.ok) {
          const permission = await permCheckTransactions.json();
          if (permission !== 'edit' && permission !== 'view') {
            console.log('User lacks financial permission:', userId, permission);
            return new Response(JSON.stringify({ error: 'Permissão negada para dados financeiros' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        
        // Aceitar parâmetros de data para filtrar transações recentes
        let startDate = url.searchParams.get('start_date');
        let endDate = url.searchParams.get('end_date');
        
        // Tentar ler do body se não veio na URL
        if (!startDate && req.method === 'POST') {
          try {
            const body = await req.json();
            startDate = body.start_date;
            endDate = body.end_date;
          } catch (e) {
            // Ignorar erro de parse
          }
        }
        
        // Se não tem filtro de data, usar padrão de 12 meses
        if (!startDate) {
          const now = new Date();
          const oneYearAgo = new Date(now);
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          startDate = oneYearAgo.toISOString().split('T')[0];
          endDate = now.toISOString().split('T')[0];
        }
        
        console.log(`Fetching transactions from ${startDate} to ${endDate || 'now'}`);
        
        const cacheKey = `transactions-${startDate}-${endDate || 'now'}`;
        
        const result = await getCachedOrFetch(cacheKey, async () => {
          // Usar filtros de data na API do Advbox
          let endpoint = '/transactions?limit=1000';
          if (startDate) {
            endpoint += `&date_due_start=${startDate}`;
          }
          if (endDate) {
            endpoint += `&date_due_end=${endDate}`;
          }
          console.log('Transactions endpoint:', endpoint);
          return await makeAdvboxRequest({ endpoint });
        }, forceRefresh);
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Endpoint para transações recentes (últimos N meses) - COM PAGINAÇÃO COMPLETA
      case 'transactions-recent': {
        // Check financial permission before allowing access
        const permCheckRecent = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/get_admin_permission`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ _user_id: userId, _feature: 'financial' }),
          }
        );
        
        if (permCheckRecent.ok) {
          const permission = await permCheckRecent.json();
          if (permission !== 'edit' && permission !== 'view') {
            console.log('User lacks financial permission for transactions-recent:', userId, permission);
            return new Response(JSON.stringify({ error: 'Permissão negada para dados financeiros' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        
        const months = parseInt(url.searchParams.get('months') || '12');
        const now = new Date();
        const startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - months);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = now.toISOString().split('T')[0];
        
        console.log(`Fetching transactions for last ${months} months: ${startDateStr} to ${endDateStr}`);
        
        const cacheKey = `transactions-recent-${months}m`;
        
        const result = await getCachedOrFetch(cacheKey, async () => {
          // Fazer paginação COMPLETA para buscar TODAS as transações do período
          let allTransactions: any[] = [];
          let offset = 0;
          const limit = 100; // API Advbox aceita máximo de 100 por página
          let hasMore = true;
          let totalCount = 0;
          let iterations = 0;
          const maxIterations = 100; // Máximo de 10.000 transações
          
          console.log('Starting paginated fetch for transactions...');
          
          while (hasMore && iterations < maxIterations) {
            // Delay entre requests para evitar rate limit
            if (iterations > 0) {
              await sleep(DELAY_BETWEEN_REQUESTS);
            }
            
            const endpoint = `/transactions?limit=${limit}&offset=${offset}&date_due_start=${startDateStr}&date_due_end=${endDateStr}`;
            console.log(`Transactions fetch iteration ${iterations + 1}: offset=${offset}`);
            
            const response = await makeAdvboxRequest({ endpoint });
            const items = response?.data || [];
            totalCount = response?.totalCount || totalCount;
            
            if (items.length === 0) {
              hasMore = false;
            } else {
              allTransactions = [...allTransactions, ...items];
              offset += limit;
              
              // Se retornou menos que o limit, não há mais páginas
              if (items.length < limit) {
                hasMore = false;
              }
            }
            
            iterations++;
            console.log(`Loaded ${allTransactions.length} transactions so far (totalCount: ${totalCount})`);
          }
          
          console.log(`[TRANSACTIONS] Finished loading ${allTransactions.length} transactions in ${iterations} iterations`);
          
          // Debug: log sample transaction
          if (allTransactions.length > 0) {
            console.log('[DEBUG] First transaction keys:', Object.keys(allTransactions[0]));
            console.log('[DEBUG] Sample transaction fields:', JSON.stringify({
              id: allTransactions[0].id,
              name: allTransactions[0].name,
              identification: allTransactions[0].identification,
              customer_name: allTransactions[0].customer_name,
              description: allTransactions[0].description,
              date_due: allTransactions[0].date_due,
              date_payment: allTransactions[0].date_payment,
              amount: allTransactions[0].amount,
              category: allTransactions[0].category,
            }));
          }
          
          return {
            data: allTransactions,
            totalCount: allTransactions.length,
            offset: 0,
            limit: allTransactions.length,
          };
        }, forceRefresh);
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ========== STATUS E CONTROLE ==========
      
      case 'fetch-status': {
        const statusKey = url.searchParams.get('key') || 'lawsuits-full';
        const status = fetchStatus.get(statusKey);
        return new Response(JSON.stringify({
          key: statusKey,
          status: status || { inProgress: false, progress: 'Nenhuma operação em andamento' },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ========== BUSCA DE RESPONSÁVEIS POR CLIENTE ==========
      case 'find-responsibles': {
        console.log('Finding responsibles for client names...');
        
        let clientNames: string[] = [];
        
        // Ler nomes do body
        if (req.method === 'POST') {
          try {
            const body = await req.json();
            clientNames = body.client_names || [];
          } catch (e) {
            console.error('Error parsing body:', e);
          }
        }
        
        if (clientNames.length === 0) {
          return new Response(JSON.stringify({ error: 'client_names array is required in body' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        console.log(`Searching responsibles for ${clientNames.length} clients`);
        
        // Buscar todos os processos do cache ou da API
        const fullCacheKey = 'lawsuits-full';
        const cached = cache.get(fullCacheKey);
        const now = Date.now();
        
        let allLawsuits: any[] = [];
        
        if (cached && (now - cached.timestamp) < CACHE_TTL * 10) { // Cache mais longo para essa busca
          allLawsuits = extractItems(cached.data);
          console.log(`Using cached lawsuits: ${allLawsuits.length} items`);
        } else {
          try {
            const result = await fetchAllPaginatedComplete('/lawsuits', fullCacheKey, 1000, 50);
            allLawsuits = result.items;
            cache.set(fullCacheKey, { 
              data: { items: allLawsuits, totalCount: result.totalCount },
              timestamp: now,
            });
          } catch (error) {
            console.error('Error fetching lawsuits:', error);
            if (cached) {
              allLawsuits = extractItems(cached.data);
            }
          }
        }
        
        console.log(`Total lawsuits available: ${allLawsuits.length}`);
        
        // Normalizar função para comparação de nomes
        const normalizeString = (str: string) => {
          return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        };
        
        // Buscar responsáveis para cada cliente
        const results: Array<{
          client_name: string;
          found: boolean;
          lawsuit_id?: string;
          lawsuit_number?: string;
          responsible_name?: string;
          responsible_id?: string;
        }> = [];
        
        for (const clientName of clientNames) {
          const normalizedClientName = normalizeString(clientName);
          
          // Buscar processo que contenha o nome do cliente
          const matchingLawsuit = allLawsuits.find((lawsuit: any) => {
            // Tentar várias propriedades que podem conter o nome do cliente
            const lawsuitClientName = lawsuit.customer_name || lawsuit.client_name || lawsuit.name || '';
            const normalizedLawsuitClient = normalizeString(lawsuitClientName);
            
            // Match exato ou parcial
            return normalizedLawsuitClient.includes(normalizedClientName) || 
                   normalizedClientName.includes(normalizedLawsuitClient);
          });
          
          if (matchingLawsuit) {
            // Extrair nome do responsável
            const responsibleName = matchingLawsuit.responsible_name || 
                                   matchingLawsuit.responsible || 
                                   matchingLawsuit.user_name ||
                                   matchingLawsuit.lawyer_name ||
                                   matchingLawsuit.attorney_name ||
                                   (matchingLawsuit.responsible_user && matchingLawsuit.responsible_user.name) ||
                                   'Não identificado';
            
            results.push({
              client_name: clientName,
              found: true,
              lawsuit_id: matchingLawsuit.id,
              lawsuit_number: matchingLawsuit.number || matchingLawsuit.process_number,
              responsible_name: responsibleName,
              responsible_id: matchingLawsuit.responsible_id || matchingLawsuit.user_id,
            });
          } else {
            results.push({
              client_name: clientName,
              found: false,
            });
          }
        }
        
        // Log sample lawsuit fields for debugging
        if (allLawsuits.length > 0) {
          console.log('[DEBUG] Sample lawsuit keys:', Object.keys(allLawsuits[0]));
          const sample = allLawsuits[0];
          console.log('[DEBUG] Sample lawsuit responsible fields:', JSON.stringify({
            responsible_name: sample.responsible_name,
            responsible: sample.responsible,
            user_name: sample.user_name,
            lawyer_name: sample.lawyer_name,
            responsible_id: sample.responsible_id,
            responsible_user: sample.responsible_user,
            customer_name: sample.customer_name,
          }));
        }
        
        const foundCount = results.filter(r => r.found).length;
        console.log(`Found responsibles for ${foundCount}/${clientNames.length} clients`);
        
        return new Response(JSON.stringify({
          data: results,
          summary: {
            total: clientNames.length,
            found: foundCount,
            notFound: clientNames.length - foundCount,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update-customer': {
        const body = await req.json();
        const { customer_id, ...updateData } = body;
        
        if (!customer_id) {
          return new Response(JSON.stringify({ error: 'customer_id é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`Updating customer ${customer_id} in ADVBox:`, JSON.stringify(updateData));
        
        const result = await makeAdvboxRequest({
          endpoint: `/customers/${customer_id}`,
          method: 'PUT',
          body: updateData,
        });

        return new Response(JSON.stringify({ success: true, data: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create-customer': {
        const body = await req.json();
        
        if (!body.name) {
          return new Response(JSON.stringify({ error: 'Nome é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`Creating new customer in ADVBox:`, body.name);

        // Map form fields to ADVBox API fields
        const advboxPayload: Record<string, any> = {
          name: body.name,
        };

        // Campos obrigatórios: users_id e customers_origins_id
        // Buscar do settings cache se não fornecidos
        if (!body.users_id || !body.customers_origins_id) {
          try {
            const settings = await getSettingsWithCache();
            if (!body.users_id) {
              const users = settings.users || settings.account?.users || [];
              if (users.length > 0) {
                advboxPayload.users_id = users[0].id;
                console.log('Auto-assigned users_id:', advboxPayload.users_id);
              }
            } else {
              advboxPayload.users_id = body.users_id;
            }
            if (!body.customers_origins_id) {
              const origins = settings.origins || settings.customers_origins || settings.account?.origins || [];
              if (origins.length > 0) {
                advboxPayload.customers_origins_id = origins[0].id;
                console.log('Auto-assigned customers_origins_id:', advboxPayload.customers_origins_id);
              }
            } else {
              advboxPayload.customers_origins_id = body.customers_origins_id;
            }
          } catch (e) {
            console.warn('Could not auto-assign required fields from settings:', e);
          }
        } else {
          advboxPayload.users_id = body.users_id;
          advboxPayload.customers_origins_id = body.customers_origins_id;
        }
        if (body.email) advboxPayload.email = body.email;
        if (body.phone) advboxPayload.cellphone = body.phone;
        if (body.cpf) advboxPayload.identification = body.cpf;
        if (body.cnpj) advboxPayload.company_registration = body.cnpj;
        if (body.rg) advboxPayload.document = body.rg;
        if (body.orgao_emissor) advboxPayload.issuing_body = body.orgao_emissor;
        if (body.birthday) advboxPayload.birthdate = body.birthday;
        if (body.profissao) advboxPayload.occupation = body.profissao;
        if (body.estado_civil) advboxPayload.marital_status = body.estado_civil;
        if (body.nacionalidade) advboxPayload.nationality = body.nacionalidade;
        if (body.naturalidade) advboxPayload.birthplace = body.naturalidade;
        if (body.sexo) advboxPayload.gender = body.sexo;
        if (body.endereco) advboxPayload.street = body.endereco;
        if (body.numero) advboxPayload.number = body.numero;
        if (body.complemento) advboxPayload.complement = body.complemento;
        if (body.bairro) advboxPayload.neighborhood = body.bairro;
        if (body.cidade) advboxPayload.city = body.cidade;
        if (body.estado) advboxPayload.state = body.estado;
        if (body.cep) {
          // Formatar CEP com hífen (obrigatório: 99999-999)
          let cep = body.cep.replace(/\D/g, '');
          if (cep.length === 8 && !cep.includes('-')) {
            cep = cep.substring(0, 5) + '-' + cep.substring(5);
          }
          advboxPayload.postalcode = cep;
        }
        if (body.telefone_fixo) advboxPayload.phone = body.telefone_fixo;
        if (body.celular) advboxPayload.cellphone = body.celular;
        if (body.telefone_comercial) advboxPayload.business_phone = body.telefone_comercial;
        if (body.nome_mae) advboxPayload.mother_name = body.nome_mae;
        if (body.nome_pai) advboxPayload.father_name = body.nome_pai;
        if (body.observacoes) advboxPayload.observations = body.observacoes;
        if (body.origem) advboxPayload.origin = body.origem;

        try {
          const result = await makeAdvboxRequest({
            endpoint: '/customers',
            method: 'POST',
            body: advboxPayload,
          });

          const createdCustomer = result.data || result;
          const advboxId = createdCustomer.id;

          if (advboxId) {
            // Save locally using service role
            const localRecord = {
              advbox_id: advboxId,
              name: body.name,
              email: body.email || null,
              phone: body.phone || body.celular || null,
              cpf: body.cpf || null,
              cnpj: body.cnpj || null,
              rg: body.rg || null,
              orgao_emissor: body.orgao_emissor || null,
              birthday: body.birthday || null,
              profissao: body.profissao || null,
              estado_civil: body.estado_civil || null,
              nacionalidade: body.nacionalidade || null,
              naturalidade: body.naturalidade || null,
              sexo: body.sexo || null,
              endereco: body.endereco || null,
              numero: body.numero || null,
              complemento: body.complemento || null,
              bairro: body.bairro || null,
              cidade: body.cidade || null,
              estado: body.estado || null,
              cep: body.cep || null,
              telefone_fixo: body.telefone_fixo || null,
              celular: body.celular || null,
              telefone_comercial: body.telefone_comercial || null,
              nome_mae: body.nome_mae || null,
              nome_pai: body.nome_pai || null,
              observacoes: body.observacoes || null,
              origem: body.origem || null,
              raw_data: createdCustomer,
              synced_at: new Date().toISOString(),
            };

            const insertResp = await fetch(
              `${SUPABASE_URL}/rest/v1/advbox_customers`,
              {
                method: 'POST',
                headers: {
                  'apikey': SUPABASE_SERVICE_ROLE_KEY!,
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=representation',
                },
                body: JSON.stringify(localRecord),
              }
            );

            const localData = insertResp.ok ? await insertResp.json() : null;

            return new Response(JSON.stringify({ 
              success: true, 
              advbox_id: advboxId,
              local_record: localData?.[0] || null,
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          return new Response(JSON.stringify({ success: true, data: createdCustomer }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Error creating customer in ADVBox:', error);
          return new Response(JSON.stringify({ 
            error: error instanceof Error ? error.message : 'Erro ao criar cliente no ADVBox',
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // ========== NOVOS ENDPOINTS (API v1.2.0) ==========

      case 'update-lawsuit': {
        const body = await req.json();
        const { lawsuit_id, ...updateData } = body;
        
        if (!lawsuit_id) {
          return new Response(JSON.stringify({ error: 'lawsuit_id é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Validar campos permitidos pela API v1.2.0
        const allowedFields = ['stages_id', 'responsible_id', 'fees_expec', 'fees_money', 'contingency', 'exit_production', 'exit_execution', 'status_closure'];
        const filteredData: Record<string, any> = {};
        for (const key of allowedFields) {
          if (updateData[key] !== undefined) {
            filteredData[key] = updateData[key];
          }
        }

        console.log(`Updating lawsuit ${lawsuit_id}:`, JSON.stringify(filteredData));
        
        const data = await makeAdvboxRequest({
          endpoint: `/lawsuits/${lawsuit_id}`,
          method: 'PUT',
          body: filteredData,
        });

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update-transaction': {
        // Check financial permission
        const permCheckUpdateTx = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/get_admin_permission`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ _user_id: userId, _feature: 'financial' }),
          }
        );
        
        if (permCheckUpdateTx.ok) {
          const perm = await permCheckUpdateTx.json();
          if (perm !== 'edit') {
            return new Response(JSON.stringify({ error: 'Permissão negada. Necessário permissão de edição financeira.' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        const body = await req.json();
        const { transaction_id, ...txUpdateData } = body;
        
        if (!transaction_id) {
          return new Response(JSON.stringify({ error: 'transaction_id é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Campos permitidos pela API v1.2.0 para PUT /transactions/{id}
        const allowedTxFields = ['date_due', 'date_payment', 'amount', 'description', 'debit_account', 'categories_id', 'cost_centers_id'];
        const filteredTxData: Record<string, any> = {};
        for (const key of allowedTxFields) {
          if (txUpdateData[key] !== undefined) {
            filteredTxData[key] = txUpdateData[key];
          }
        }

        console.log(`Updating transaction ${transaction_id}:`, JSON.stringify(filteredTxData));
        
        const data = await makeAdvboxRequest({
          endpoint: `/transactions/${transaction_id}`,
          method: 'PUT',
          body: filteredTxData,
        });

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create-movement': {
        const body = await req.json();
        const { lawsuit_id, date, description } = body;
        
        if (!lawsuit_id || !date || !description) {
          return new Response(JSON.stringify({ error: 'lawsuit_id, date e description são obrigatórios' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (description.length < 10) {
          return new Response(JSON.stringify({ error: 'description deve ter no mínimo 10 caracteres' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`Creating movement for lawsuit ${lawsuit_id}:`, date, description.substring(0, 50));
        
        const data = await makeAdvboxRequest({
          endpoint: '/lawsuits/movement',
          method: 'POST',
          body: { lawsuit_id, date, description },
        });

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create-transaction': {
        // Check financial permission
        const permCheckCreateTx = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/get_admin_permission`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ _user_id: userId, _feature: 'financial' }),
          }
        );
        
        if (permCheckCreateTx.ok) {
          const perm = await permCheckCreateTx.json();
          if (perm !== 'edit') {
            return new Response(JSON.stringify({ error: 'Permissão negada. Necessário permissão de edição financeira.' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        const body = await req.json();
        
        // Campos obrigatórios pela API v1.2.0
        if (!body.date_due || !body.amount || !body.debit_account || !body.categories_id || !body.cost_centers_id) {
          return new Response(JSON.stringify({ 
            error: 'Campos obrigatórios: date_due, amount, debit_account, categories_id, cost_centers_id' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`Creating transaction:`, JSON.stringify(body).substring(0, 200));
        
        const data = await makeAdvboxRequest({
          endpoint: '/transactions',
          method: 'POST',
          body,
        });

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'task-history': {
        const lawsuitId = url.searchParams.get('lawsuit_id');
        const status = url.searchParams.get('status') || 'all'; // pending, completed, all
        
        if (!lawsuitId) {
          return new Response(JSON.stringify({ error: 'lawsuit_id é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`Fetching task history for lawsuit ${lawsuitId}, status: ${status}`);
        
        const data = await makeAdvboxRequest({
          endpoint: `/history/${lawsuitId}?status=${status}`,
        });

        return new Response(JSON.stringify({ data: data.data || data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error in advbox-integration:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
