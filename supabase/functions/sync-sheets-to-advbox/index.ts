// Sync Google Sheets clients to ADVBox Edge Function
// Cadastra automaticamente novos clientes do formulário comercial no ADVBox

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADVBOX_API_BASE = 'https://app.advbox.com.br/api/v1';
const ADVBOX_TOKEN = Deno.env.get('ADVBOX_API_TOKEN');
const GOOGLE_SHEETS_API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const SPREADSHEET_ID = '1FG3o6BL91Ox9WcaqSpmW2Yhl0vBG-V-6iH-1FQztiUM';
const SHEET_NAME = 'Respostas ao formulário 1';

const DEFAULT_RESPONSIBLE_NAME = 'mariana';

interface ClientData {
  id: number;
  timestamp: string;
  nomeCompleto: string;
  cpf: string;
  documentoIdentidade?: string;
  dataNascimento?: string;
  estadoCivil?: string;
  profissao?: string;
  telefone: string;
  email: string;
  cep?: string;
  cidade?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  estado?: string;
  comoConheceu?: string;
}

interface SyncedClient {
  cpf: string;
  advbox_customer_id: string;
  synced_at: string;
  client_name: string;
  sheet_row_id: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeAdvboxRequest(
  endpoint: string, 
  method = 'GET', 
  body?: Record<string, unknown>,
  retryCount = 0
): Promise<any> {
  const url = `${ADVBOX_API_BASE}${endpoint}`;
  const maxRetries = 3;
  
  // Re-read token at request time to ensure it's loaded
  const token = Deno.env.get('ADVBOX_API_TOKEN');
  
  if (!token) {
    throw new Error('ADVBOX_API_TOKEN não configurado');
  }
  
  console.log(`Making ${method} request to Advbox:`, url);
  console.log('Token present:', !!token, 'Token length:', token.length);
  
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    
    if (response.status === 429 && retryCount < maxRetries) {
      const waitTime = Math.pow(2, retryCount) * 2000;
      console.log(`Rate limited. Waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}`);
      await sleep(waitTime);
      return makeAdvboxRequest(endpoint, method, body, retryCount + 1);
    }
    
    const responseText = await response.text();
    
    if (!response.ok) {
      throw new Error(`Advbox API error: ${response.status} - ${responseText.substring(0, 200)}`);
    }

    if (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('[')) {
      throw new Error(`API retornou HTML em vez de JSON`);
    }

    return JSON.parse(responseText);
  } catch (e) {
    if (e instanceof Error && e.message.includes('Advbox API error')) {
      throw e;
    }
    throw new Error(`Falha ao fazer parse da resposta`);
  }
}

async function fetchClientsFromSheets(): Promise<ClientData[]> {
  const encodedSheetName = encodeURIComponent(SHEET_NAME);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedSheetName}?key=${GOOGLE_SHEETS_API_KEY}`;
  
  console.log('Fetching data from Google Sheets...');
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Erro ao acessar Google Sheets: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.values || data.values.length === 0) {
    return [];
  }

  const headers = data.values[0];
  const rows = data.values.slice(1);

  const clients = rows.map((row: string[], rowIndex: number) => {
    const getValue = (columnName: string) => {
      const index = headers.findIndex((h: string) => 
        h.toLowerCase().includes(columnName.toLowerCase())
      );
      return index >= 0 ? (row[index] || '') : '';
    };

    return {
      id: rowIndex + 1,
      timestamp: row[0] || '',
      nomeCompleto: getValue('nome completo'),
      cpf: getValue('cpf'),
      documentoIdentidade: getValue('documento de identidade'),
      comoConheceu: getValue('como conheceu'),
      dataNascimento: getValue('data de nascimento'),
      estadoCivil: getValue('estado civil'),
      profissao: getValue('profissão'),
      telefone: getValue('telefone'),
      email: getValue('e-mail'),
      cep: getValue('cep'),
      cidade: getValue('cidade'),
      rua: getValue('rua'),
      numero: getValue('número da sua residência'),
      complemento: getValue('complemento'),
      bairro: getValue('bairro'),
      estado: getValue('estado fica'),
    };
  });

  return clients;
}

async function getSyncedClients(): Promise<SyncedClient[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/sheets_advbox_sync?select=*`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  if (!response.ok) {
    console.error('Error fetching synced clients:', await response.text());
    return [];
  }

  return await response.json();
}

async function markClientAsSynced(
  cpf: string, 
  advboxCustomerId: string, 
  clientName: string,
  sheetRowId: number
): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/sheets_advbox_sync`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        cpf: cpf.replace(/\D/g, ''),
        advbox_customer_id: advboxCustomerId,
        client_name: clientName,
        sheet_row_id: sheetRowId,
      }),
    }
  );

  if (!response.ok) {
    console.error('Error marking client as synced:', await response.text());
  }
}

async function getAdvboxSettings(comoConheceu?: string): Promise<{
  defaultUserId?: string;
  defaultOriginId?: string;
}> {
  const result: { defaultUserId?: string; defaultOriginId?: string } = {};
  
  try {
    // Buscar settings (contém usuários e origens) - mesmo endpoint usado por advbox-integration
    console.log('Fetching settings from ADVBox...');
    const settingsResponse = await makeAdvboxRequest('/settings');
    const settings = settingsResponse.data || settingsResponse;
    
    console.log('Settings keys:', Object.keys(settings));
    
    // Extrair usuários de diferentes locais possíveis
    let users: any[] = [];
    if (settings.users && Array.isArray(settings.users)) {
      users = settings.users;
    } else if (settings.account?.users && Array.isArray(settings.account.users)) {
      users = settings.account.users;
    } else if (settings.members && Array.isArray(settings.members)) {
      users = settings.members;
    } else if (settings.account?.members && Array.isArray(settings.account.members)) {
      users = settings.account.members;
    } else if (settings.responsibles && Array.isArray(settings.responsibles)) {
      users = settings.responsibles;
    }
    
    console.log(`Found ${users.length} users in settings`);
    
    if (users.length > 0) {
      const normalizedUsers = users.map((u: any) => ({
        id: String(u.id || u.user_id || u.users_id),
        name: u.name || u.full_name || u.nome || u.email,
      })).filter((u: any) => u.id && u.id !== 'undefined');
      
      // Buscar Mariana como responsável padrão
      const mariana = normalizedUsers.find((u: { id: string; name: string }) => 
        u.name?.toLowerCase().includes(DEFAULT_RESPONSIBLE_NAME.toLowerCase())
      );
      
      if (mariana) {
        result.defaultUserId = mariana.id;
        console.log(`Found Mariana as default user: ${mariana.id}`);
      } else if (normalizedUsers.length > 0) {
        result.defaultUserId = normalizedUsers[0].id;
        console.log(`Using first user as default: ${normalizedUsers[0].id}`);
      }
    }
    
    // Extrair origens de diferentes locais possíveis
    let origins: any[] = [];
    if (settings.customers_origins && Array.isArray(settings.customers_origins)) {
      origins = settings.customers_origins;
    } else if (settings.origins && Array.isArray(settings.origins)) {
      origins = settings.origins;
    } else if (settings.account?.customers_origins && Array.isArray(settings.account.customers_origins)) {
      origins = settings.account.customers_origins;
    }
    
    console.log(`Found ${origins.length} origins in settings`);
    
    if (origins.length > 0) {
      const normalizedOrigins = origins.map((o: any) => ({
        id: String(o.id || o.customers_origins_id),
        name: o.name || o.origin || o.origem,
      })).filter((o: any) => o.id && o.id !== 'undefined');
      
      // Tentar mapear pelo campo "Como conheceu"
      if (comoConheceu && comoConheceu.trim() !== '') {
        const comoConheceuLower = comoConheceu.toLowerCase();
        const matchedOrigin = normalizedOrigins.find((o: { id: string; name: string }) => 
          o.name?.toLowerCase().includes(comoConheceuLower) ||
          comoConheceuLower.includes(o.name?.toLowerCase() || '')
        );
        
        if (matchedOrigin) {
          result.defaultOriginId = matchedOrigin.id;
          console.log(`Matched origin "${matchedOrigin.name}" for "${comoConheceu}"`);
        }
      }
      
      // Fallback para "Não Informado"
      if (!result.defaultOriginId) {
        const naoInformadoOrigin = normalizedOrigins.find((o: { id: string; name: string }) => 
          o.name?.toLowerCase().includes('não informado') || 
          o.name?.toLowerCase().includes('nao informado')
        );
        
        if (naoInformadoOrigin) {
          result.defaultOriginId = naoInformadoOrigin.id;
          console.log(`Using "Não Informado" as default origin: ${naoInformadoOrigin.id}`);
        } else if (normalizedOrigins.length > 0) {
          result.defaultOriginId = normalizedOrigins[0].id;
          console.log(`Using first origin as default: ${normalizedOrigins[0].id}`);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching Advbox settings:', error);
  }
  
  return result;
}

async function findExistingCustomer(cpf: string, name: string): Promise<any | null> {
  try {
    const response = await makeAdvboxRequest('/customers?limit=1000');
    const customers = response.data || [];
    
    const cpfClean = cpf.replace(/\D/g, '');
    let found = customers.find((c: any) => {
      const customerCpf = (c.cpf || c.document || '').replace(/\D/g, '');
      return customerCpf === cpfClean;
    });
    
    if (found) return found;
    
    const nameLower = name.toLowerCase().trim();
    found = customers.find((c: any) => {
      const customerName = (c.name || c.full_name || '').toLowerCase().trim();
      return customerName === nameLower;
    });
    
    return found || null;
  } catch (error) {
    console.error('Error searching for existing customer:', error);
    return null;
  }
}

// Mapeamento de nomes de estados para siglas
const STATE_MAP: Record<string, string> = {
  'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amapa': 'AP', 'amazonas': 'AM',
  'bahia': 'BA', 'ceará': 'CE', 'ceara': 'CE', 'distrito federal': 'DF', 'espírito santo': 'ES',
  'espirito santo': 'ES', 'goiás': 'GO', 'goias': 'GO', 'maranhão': 'MA', 'maranhao': 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG',
  'pará': 'PA', 'para': 'PA', 'paraíba': 'PB', 'paraiba': 'PB', 'paraná': 'PR', 'parana': 'PR',
  'pernambuco': 'PE', 'piauí': 'PI', 'piaui': 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', 'rondônia': 'RO', 'rondonia': 'RO',
  'roraima': 'RR', 'santa catarina': 'SC', 'são paulo': 'SP', 'sao paulo': 'SP',
  'sergipe': 'SE', 'tocantins': 'TO'
};

function normalizeState(estado?: string): string {
  if (!estado) return 'MG'; // Default
  
  const estadoLower = estado.toLowerCase().trim();
  
  // Se já for uma sigla de 2 caracteres
  if (estadoLower.length === 2) {
    return estadoLower.toUpperCase();
  }
  
  // Buscar no mapa
  if (STATE_MAP[estadoLower]) {
    return STATE_MAP[estadoLower];
  }
  
  // Tentar encontrar parcial
  for (const [name, code] of Object.entries(STATE_MAP)) {
    if (estadoLower.includes(name) || name.includes(estadoLower)) {
      return code;
    }
  }
  
  return 'MG'; // Default se não encontrar
}

function formatStreet(rua?: string, numero?: string): string {
  if (!rua) return 'Endereço não informado, S/N';
  
  const ruaClean = rua.trim();
  const numeroClean = numero?.trim() || 'S/N';
  
  if (/,\s*\d+/.test(ruaClean) || /\s+\d+$/.test(ruaClean)) {
    return ruaClean;
  }
  
  return `${ruaClean}, ${numeroClean}`;
}

async function createCustomer(
  client: ClientData, 
  settings: { defaultUserId?: string; defaultOriginId?: string }
): Promise<{ id: string } | null> {
  try {
    if (!settings.defaultUserId || !settings.defaultOriginId) {
      throw new Error('Configurações do Advbox incompletas');
    }
    
    let birthDate = null;
    if (client.dataNascimento) {
      const parts = client.dataNascimento.split('/');
      if (parts.length === 3) {
        birthDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else {
        birthDate = client.dataNascimento;
      }
    }
    
    const formattedStreet = formatStreet(client.rua, client.numero);
    
    const customerData: Record<string, any> = {
      name: client.nomeCompleto,
      cpf: client.cpf?.replace(/\D/g, ''),
      rg: client.documentoIdentidade,
      birth_date: birthDate,
      marital_status: client.estadoCivil,
      profession: client.profissao,
      phone: client.telefone?.replace(/\D/g, ''),
      email: client.email,
      zip_code: client.cep?.replace(/\D/g, ''),
      city: client.cidade || 'Não informado',
      street: formattedStreet,
      complement: client.complemento,
      neighborhood: client.bairro || 'Não informado',
      state: normalizeState(client.estado),
      type: 'person',
      users_id: settings.defaultUserId,
      customers_origins_id: settings.defaultOriginId,
    };
    
    console.log('Creating customer:', client.nomeCompleto);
    
    const response = await makeAdvboxRequest('/customers', 'POST', customerData);
    
    if (response && (response.id || response.data?.id)) {
      return { id: String(response.id || response.data?.id) };
    }
    
    return null;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth obrigatória: aceita service role (cron) ou JWT de usuário autenticado.
    // Antes: se authHeader fosse null, o código pulava a checagem e seguia.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isCronCall = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

    if (!isCronCall) {
      const token = authHeader.replace('Bearer ', '');

      const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY!,
        },
      });

      if (!userResponse.ok) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!ADVBOX_TOKEN) {
      return new Response(JSON.stringify({ error: 'Token ADVBox não configurado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!GOOGLE_SHEETS_API_KEY) {
      return new Response(JSON.stringify({ error: 'API Key do Google Sheets não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting sync from Google Sheets to ADVBox...');

    // 1. Buscar clientes do Google Sheets
    const sheetsClients = await fetchClientsFromSheets();
    console.log(`Found ${sheetsClients.length} clients in Google Sheets`);

    // 2. Buscar clientes já sincronizados
    const syncedClients = await getSyncedClients();
    const syncedCPFs = new Set(syncedClients.map(c => c.cpf));
    console.log(`Already synced: ${syncedClients.length} clients`);

    // 3. Filtrar clientes que ainda não foram sincronizados e ordenar por mais recentes primeiro
    const clientsToSync = sheetsClients.filter(client => {
      const cpfClean = client.cpf?.replace(/\D/g, '');
      return cpfClean && cpfClean.length >= 11 && !syncedCPFs.has(cpfClean);
    }).reverse(); // Mais recentes primeiro (final da planilha = preenchimento mais recente)
    
    console.log(`Clients to sync: ${clientsToSync.length}`);

    if (clientsToSync.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Nenhum cliente novo para sincronizar',
        total_in_sheets: sheetsClients.length,
        already_synced: syncedClients.length,
        synced_now: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Buscar configurações do ADVBox (uma vez)
    const advboxSettings = await getAdvboxSettings();
    
    if (!advboxSettings.defaultUserId || !advboxSettings.defaultOriginId) {
      return new Response(JSON.stringify({ 
        error: 'Configurações do ADVBox incompletas. Verifique usuários e origens.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Sincronizar clientes (máximo 10 por execução para evitar timeout)
    const maxPerRun = 10;
    const clientsThisRun = clientsToSync.slice(0, maxPerRun);
    
    const results = {
      synced: [] as string[],
      existing: [] as string[],
      errors: [] as { name: string; error: string }[],
    };

    for (const client of clientsThisRun) {
      try {
        await sleep(1500); // Delay para evitar rate limit
        
        // Verificar se já existe no ADVBox (por CPF ou nome)
        const existingCustomer = await findExistingCustomer(client.cpf, client.nomeCompleto);
        
        if (existingCustomer) {
          // Já existe, apenas marcar como sincronizado
          await markClientAsSynced(
            client.cpf, 
            String(existingCustomer.id), 
            client.nomeCompleto,
            client.id
          );
          results.existing.push(client.nomeCompleto);
          console.log(`Client already exists in ADVBox: ${client.nomeCompleto}`);
        } else {
          // Criar no ADVBox com a origem correta
          try {
            const settingsWithOrigin = await getAdvboxSettings(client.comoConheceu);
            const newCustomer = await createCustomer(client, settingsWithOrigin);
            
            if (newCustomer) {
              await markClientAsSynced(
                client.cpf, 
                newCustomer.id, 
                client.nomeCompleto,
                client.id
              );
              results.synced.push(client.nomeCompleto);
              console.log(`Created new customer in ADVBox: ${client.nomeCompleto} (ID: ${newCustomer.id})`);
            }
          } catch (createError) {
            const errorMsg = createError instanceof Error ? createError.message : String(createError);
            
            // Se for erro de duplicado, tratar como existente
            if (errorMsg.includes('duplicate') || errorMsg.includes('already exists')) {
              // Tentar buscar novamente o cliente (pode ter sido criado entre verificação e criação)
              const retryExisting = await findExistingCustomer(client.cpf, client.nomeCompleto);
              if (retryExisting) {
                await markClientAsSynced(
                  client.cpf,
                  String(retryExisting.id),
                  client.nomeCompleto,
                  client.id
                );
                results.existing.push(client.nomeCompleto);
                console.log(`Client found after duplicate error: ${client.nomeCompleto}`);
              } else {
                // Marcar como sincronizado mesmo sem ID (para não tentar novamente)
                await markClientAsSynced(
                  client.cpf,
                  'unknown-duplicate',
                  client.nomeCompleto,
                  client.id
                );
                results.existing.push(client.nomeCompleto);
                console.log(`Marked as existing (duplicate): ${client.nomeCompleto}`);
              }
            } else {
              throw createError;
            }
          }
        }
        
        await sleep(1000);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.errors.push({ name: client.nomeCompleto, error: errorMsg });
        console.error(`Error syncing ${client.nomeCompleto}:`, errorMsg);
      }
    }

    const response = {
      success: true,
      message: `Sincronização concluída`,
      total_in_sheets: sheetsClients.length,
      already_synced: syncedClients.length,
      pending: clientsToSync.length - clientsThisRun.length,
      this_run: {
        synced: results.synced.length,
        existing: results.existing.length,
        errors: results.errors.length,
      },
      details: results,
    };

    console.log('Sync completed:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Error in sync-sheets-to-advbox:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
