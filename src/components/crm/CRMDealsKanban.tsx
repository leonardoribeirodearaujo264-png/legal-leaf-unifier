import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, User, DollarSign, Calendar, ChevronDown, Phone, Mail, RefreshCw, GripVertical, Eye, Building, MapPin, Globe, Linkedin, Twitter, Facebook, Tag, FileText, Package, Target, Edit2, Save, X, History, UserCircle, CheckCircle, Circle, Video, MessageSquare, Filter, ArrowUpDown, SortAsc, SortDesc, LayoutGrid, List, Star } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CRMDealsListView } from './CRMDealsListView';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface DealStage {
  id: string;
  name: string;
  order_index: number;
  is_won: boolean;
  is_lost: boolean;
  pipeline_id: string;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lead_score: number | null;
  // Traffic source fields (Fonte, Campanha from RD Station)
  traffic_source: string | null;
  traffic_medium: string | null;
  traffic_campaign: string | null;
  // UTM parameters
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  website: string | null;
  linkedin: string | null;
  twitter: string | null;
  facebook: string | null;
  birthday: string | null;
  first_conversion: string | null;
  last_conversion: string | null;
  notes: string | null;
  rd_station_id: string | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface Deal {
  id: string;
  name: string;
  value: number;
  stage_id: string;
  contact_id: string | null;
  owner_id: string | null;
  expected_close_date: string | null;
  created_at: string;
  updated_at: string;
  product_name: string | null;
  campaign_name: string | null;
  notes: string | null;
  rd_station_id: string | null;
  custom_fields: Record<string, unknown> | null;
  won: boolean | null;
  closed_at: string | null;
  loss_reason: string | null;
  contact?: Contact;
  owner?: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  created_by: string | null;
  owner_id: string | null;
  owner?: {
    full_name: string;
  };
  creator?: {
    full_name: string;
  };
}

interface CRMDealsKanbanProps {
  syncEnabled: boolean;
}

type SortOption = 'name_asc' | 'name_desc' | 'created_asc' | 'created_desc' | 'value_asc' | 'value_desc' | 'updated_desc';
type FilterQualification = 'all' | 'qualified' | 'not_qualified';

interface FilterState {
  sortBy: SortOption;
  qualification: FilterQualification;
  ownerId: string;
  productName: string;
  campaignName: string;
  utmSource: string;
}

// Componente de card arrastável
const DraggableDealCard = ({ 
  deal, 
  stage, 
  stages, 
  onMove, 
  onView,
  movingDeal,
  formatCurrency,
  profiles
}: { 
  deal: Deal; 
  stage: DealStage;
  stages: DealStage[];
  onMove: (dealId: string, newStageId: string, currentStageId: string) => void;
  onView: (deal: Deal) => void;
  movingDeal: string | null;
  formatCurrency: (value: number) => string;
  profiles: Record<string, { full_name: string; email: string }>;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal, stageId: stage.id }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style}
      className={`hover:shadow-lg transition-all duration-200 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 hover:border-primary/50 rounded-lg ${isDragging ? 'shadow-xl ring-2 ring-primary' : ''}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div 
            {...attributes} 
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
          >
            <GripVertical className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onView(deal)}>
            <p className="font-semibold text-sm leading-tight break-words hover:text-primary">{deal.name}</p>
            {deal.contact && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">{deal.contact.name}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onView(deal)}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
            
            {/* Dropdown to move */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                  Mover
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 z-50">
                {stages
                  .filter(s => s.id !== stage.id)
                  .map(targetStage => (
                    <DropdownMenuItem
                      key={targetStage.id}
                      onClick={() => onMove(deal.id, targetStage.id, stage.id)}
                      disabled={movingDeal === deal.id}
                    >
                      Mover para {targetStage.name}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
          {deal.product_name && (
            <div className="flex items-center gap-1.5 text-xs">
              <Package className="h-3 w-3 text-violet-600 shrink-0" />
              <span className="truncate text-violet-600 font-medium">{deal.product_name}</span>
            </div>
          )}

          {deal.value > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <DollarSign className="h-3 w-3 text-emerald-600 shrink-0" />
              <span className="font-semibold text-emerald-600">
                {formatCurrency(deal.value)}
              </span>
            </div>
          )}
          
          {deal.expected_close_date && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>
                {new Date(deal.expected_close_date).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}

          {deal.contact?.phone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate">{deal.contact.phone}</span>
            </div>
          )}

          {deal.contact?.email && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{deal.contact.email}</span>
            </div>
          )}

          {/* Responsável */}
          {deal.owner_id && profiles[deal.owner_id] && (
            <div className="flex items-center gap-1.5 text-xs">
              <UserCircle className="h-3 w-3 text-blue-600 shrink-0" />
              <span className="truncate text-blue-600 font-medium">{profiles[deal.owner_id].full_name}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Componente de coluna droppable
const DroppableColumn = ({ 
  stage, 
  index,
  children,
  stageDeals,
  stageValue,
  getStageHeaderColor,
  getStageColumnColor,
  formatCurrency,
}: { 
  stage: DealStage; 
  index: number;
  children: React.ReactNode;
  stageDeals: Deal[];
  stageValue: number;
  getStageHeaderColor: (stage: DealStage, index: number) => string;
  getStageColumnColor: (stage: DealStage) => string;
  formatCurrency: (value: number) => string;
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-80 flex-shrink-0 rounded-xl border-2 shadow-sm transition-all duration-200 ${getStageColumnColor(stage)} ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
    >
      {/* Header colorido */}
      <div className={`p-4 rounded-t-lg ${getStageHeaderColor(stage, index)}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm uppercase tracking-wide truncate mr-2">{stage.name}</h3>
          <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 shrink-0">
            {stageDeals.length}
          </Badge>
        </div>
        <p className="text-sm mt-1 opacity-90">
          {formatCurrency(stageValue)}
        </p>
      </div>

      <div className="h-[calc(100vh-400px)] min-h-[400px] overflow-y-auto">
        <div className="p-3 space-y-3">
          {children}
          {stageDeals.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma oportunidade
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const CRMDealsKanban = ({ syncEnabled }: CRMDealsKanbanProps) => {
  const { user } = useAuth();
  const [stages, setStages] = useState<DealStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingDeal, setMovingDeal] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Deal & { contact?: Partial<Contact> }>>({});
  const [saving, setSaving] = useState(false);
  const [dealActivities, setDealActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string; email: string }>>({});
  const [filters, setFilters] = useState<FilterState>({
    sortBy: 'created_desc',
    qualification: 'all',
    ownerId: 'all',
    productName: 'all',
    campaignName: 'all',
    utmSource: 'all',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(() => {
    return (localStorage.getItem('crm-view-mode') as 'kanban' | 'list') || 'kanban';
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchData();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('crm-deals-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_deals' },
        () => fetchDeals()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchStages(), fetchDeals(), fetchProfiles()]);
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email');
    
    if (error) {
      console.error('Error fetching profiles:', error);
      return;
    }
    
    const profileMap: Record<string, { full_name: string; email: string }> = {};
    data?.forEach(p => {
      profileMap[p.id] = { full_name: p.full_name, email: p.email };
    });
    setProfiles(profileMap);
  };

  const fetchStages = async () => {
    const { data, error } = await supabase
      .from('crm_deal_stages')
      .select('*')
      .order('order_index');
    
    if (error) {
      console.error('Error fetching stages:', error);
      return;
    }
    setStages(data || []);
  };

  const fetchDeals = async () => {
    let allDeals: Deal[] = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: dealsBatch, error } = await supabase
        .from('crm_deals')
        .select(`
          *,
          contact:crm_contacts(*)
        `)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        console.error('Error fetching deals:', error);
        break;
      }
      
      if (!dealsBatch || dealsBatch.length === 0) break;
      
      allDeals = [...allDeals, ...dealsBatch as Deal[]];
      
      if (dealsBatch.length < pageSize) break;
      page++;
      
      if (page > 20) break;
    }
    
    setDeals(allDeals);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStageHeaderColor = (stage: DealStage, index: number) => {
    if (stage.is_won) return 'bg-emerald-600 text-white';
    if (stage.is_lost) return 'bg-red-600 text-white';
    
    const colors = [
      'bg-blue-600 text-white',
      'bg-violet-600 text-white',
      'bg-amber-500 text-white',
      'bg-cyan-600 text-white',
      'bg-pink-600 text-white',
      'bg-indigo-600 text-white',
      'bg-orange-500 text-white',
      'bg-teal-600 text-white',
      'bg-rose-600 text-white',
      'bg-sky-600 text-white',
    ];
    return colors[index % colors.length];
  };

  const getStageColumnColor = (stage: DealStage) => {
    if (stage.is_won) return 'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700';
    if (stage.is_lost) return 'bg-red-100 dark:bg-red-950/50 border-red-300 dark:border-red-700';
    return 'bg-slate-200/70 dark:bg-slate-800/70 border-slate-300 dark:border-slate-600';
  };

  const getStageDeals = (stageId: string) => {
    let filtered = deals.filter(deal => {
      const matchesStage = deal.stage_id === stageId;
      const matchesSearch = searchTerm === '' || 
        deal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.product_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filter by owner
      const matchesOwner = filters.ownerId === 'all' || deal.owner_id === filters.ownerId;
      
      // Filter by product
      const matchesProduct = filters.productName === 'all' || deal.product_name === filters.productName;
      
      // Filter by campaign
      const matchesCampaign = filters.campaignName === 'all' || deal.campaign_name === filters.campaignName;
      
      // Filter by UTM source
      const matchesUtmSource = filters.utmSource === 'all' || deal.contact?.utm_source === filters.utmSource;
      
      // Filter by qualification (lead_score)
      let matchesQualification = true;
      if (filters.qualification === 'qualified') {
        matchesQualification = (deal.contact?.lead_score || 0) > 0;
      } else if (filters.qualification === 'not_qualified') {
        matchesQualification = !deal.contact?.lead_score || deal.contact.lead_score === 0;
      }
      
      return matchesStage && matchesSearch && matchesOwner && matchesProduct && matchesCampaign && matchesUtmSource && matchesQualification;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'created_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'value_asc':
          return (a.value || 0) - (b.value || 0);
        case 'value_desc':
          return (b.value || 0) - (a.value || 0);
        case 'updated_desc':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  };

  // Get unique values for filters
  const uniqueOwners = [...new Set(deals.map(d => d.owner_id).filter(Boolean))];
  const uniqueProducts = [...new Set(deals.map(d => d.product_name).filter(Boolean))];
  const uniqueCampaigns = [...new Set(deals.map(d => d.campaign_name).filter(Boolean))];
  const uniqueUtmSources = [...new Set(deals.map(d => d.contact?.utm_source).filter(Boolean))];

  const getStageValue = (stageId: string) => {
    return getStageDeals(stageId).reduce((sum, deal) => sum + (Number(deal.value) || 0), 0);
  };

  const fetchDealActivities = async (dealId: string, contactId: string | null) => {
    setLoadingActivities(true);
    try {
      let query = supabase
        .from('crm_activities')
        .select('*')
        .order('created_at', { ascending: false });

      // Get activities for deal OR contact
      if (contactId) {
        query = query.or(`deal_id.eq.${dealId},contact_id.eq.${contactId}`);
      } else {
        query = query.eq('deal_id', dealId);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching activities:', error);
        setDealActivities([]);
      } else {
        setDealActivities(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
      setDealActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleViewDeal = async (deal: Deal) => {
    setSelectedDeal(deal);
    setIsEditing(false);
    setDealActivities([]);
    fetchDealActivities(deal.id, deal.contact_id);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'meeting':
        return <Video className="h-4 w-4" />;
      case 'task':
        return <CheckCircle className="h-4 w-4" />;
      case 'note':
        return <FileText className="h-4 w-4" />;
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Circle className="h-4 w-4" />;
    }
  };

  const getActivityTypeName = (type: string) => {
    const types: Record<string, string> = {
      call: 'Ligação',
      email: 'E-mail',
      meeting: 'Reunião',
      task: 'Tarefa',
      note: 'Nota',
      whatsapp: 'WhatsApp'
    };
    return types[type] || type;
  };

  const handleEditClick = () => {
    if (selectedDeal) {
      setEditForm({ 
        ...selectedDeal,
        contact: selectedDeal.contact ? { ...selectedDeal.contact } : undefined
      });
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSave = async () => {
    if (!selectedDeal) return;
    setSaving(true);

    try {
      // Update deal
      const { error: dealError } = await supabase
        .from('crm_deals')
        .update({
          name: editForm.name,
          value: editForm.value,
          notes: editForm.notes,
          expected_close_date: editForm.expected_close_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedDeal.id);

      if (dealError) throw dealError;

      // Update contact if exists
      if (selectedDeal.contact_id && editForm.contact) {
        const { error: contactError } = await supabase
          .from('crm_contacts')
          .update({
            name: editForm.contact.name,
            email: editForm.contact.email,
            phone: editForm.contact.phone,
            company: editForm.contact.company,
            job_title: editForm.contact.job_title,
            address: editForm.contact.address,
            city: editForm.contact.city,
            state: editForm.contact.state,
            country: editForm.contact.country,
            website: editForm.contact.website,
            linkedin: editForm.contact.linkedin,
            twitter: editForm.contact.twitter,
            facebook: editForm.contact.facebook,
            notes: editForm.contact.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedDeal.contact_id);

        if (contactError) {
          console.error('Error updating contact:', contactError);
        }
      }

      // Sync to RD Station if enabled
      if (syncEnabled && selectedDeal.rd_station_id) {
        await supabase.functions.invoke('crm-sync', {
          body: {
            action: 'update_deal',
            data: {
              deal_id: selectedDeal.id,
              updates: {
                name: editForm.name,
                value: editForm.value,
                notes: editForm.notes,
                expected_close_date: editForm.expected_close_date
              }
            }
          }
        });

        if (selectedDeal.contact?.rd_station_id && editForm.contact) {
          await supabase.functions.invoke('crm-sync', {
            body: {
              action: 'update_contact',
              data: {
                contact_id: selectedDeal.contact_id,
                rd_station_id: selectedDeal.contact.rd_station_id,
                updates: editForm.contact
              }
            }
          });
        }
      }

      toast.success('Dados salvos com sucesso');
      fetchDeals();
      setSelectedDeal(null);
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error saving:', error);
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveToStage = async (dealId: string, newStageId: string, currentStageId: string) => {
    if (newStageId === currentStageId) return;

    setMovingDeal(dealId);

    // Optimistic update
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage_id: newStageId } : d));

    try {
      if (syncEnabled) {
        const { data, error } = await supabase.functions.invoke('crm-sync', {
          body: {
            action: 'update_deal_stage',
            data: {
              deal_id: dealId,
              stage_id: newStageId,
              user_id: user?.id
            }
          }
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erro ao sincronizar');

        toast.success(`Oportunidade movida para ${data.stage_name}`);
      } else {
        const { error } = await supabase
          .from('crm_deals')
          .update({ stage_id: newStageId })
          .eq('id', dealId);

        if (error) throw error;

        await supabase.from('crm_deal_history').insert({
          deal_id: dealId,
          from_stage_id: currentStageId,
          to_stage_id: newStageId,
          changed_by: user?.id
        });

        const targetStage = stages.find(s => s.id === newStageId);
        toast.success(`Oportunidade movida para ${targetStage?.name || 'nova etapa'}`);
      }

      fetchDeals();
    } catch (error: any) {
      console.error('Error moving deal:', error);
      // Revert optimistic update
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage_id: currentStageId } : d));
      toast.error(error?.message || 'Erro ao mover oportunidade');
    } finally {
      setMovingDeal(null);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const deal = deals.find(d => d.id === active.id);
    if (deal) {
      setActiveDeal(deal);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) return;

    const dealId = active.id as string;
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    const newStageId = over.id as string;
    const currentStageId = deal.stage_id;

    if (newStageId !== currentStageId && stages.some(s => s.id === newStageId)) {
      handleMoveToStage(dealId, newStageId, currentStageId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Nenhum pipeline configurado. Clique em "Sincronizar RD Station" para importar.
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentStage = selectedDeal ? stages.find(s => s.id === selectedDeal.stage_id) : null;

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      {/* View Toggle + Search */}
      <div className="space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => { if (v) { setViewMode(v as 'kanban' | 'list'); localStorage.setItem('crm-view-mode', v); } }}>
            <ToggleGroupItem value="kanban" aria-label="Visão de Funil" className="gap-1.5 px-3">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Funil</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Visão de Lista" className="gap-1.5 px-3">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Lista</span>
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar oportunidades..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>

          <Select
            value={filters.sortBy}
            onValueChange={(value: SortOption) => setFilters({ ...filters, sortBy: value })}
          >
            <SelectTrigger className="w-[200px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_desc">Mais recentes</SelectItem>
              <SelectItem value="created_asc">Mais antigos</SelectItem>
              <SelectItem value="name_asc">Nome A-Z</SelectItem>
              <SelectItem value="name_desc">Nome Z-A</SelectItem>
              <SelectItem value="value_desc">Maior valor</SelectItem>
              <SelectItem value="value_asc">Menor valor</SelectItem>
              <SelectItem value="updated_desc">Última atualização</SelectItem>
            </SelectContent>
          </Select>
          
          {syncEnabled && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
              <RefreshCw className="h-3 w-3 mr-1" />
              Sync bidirecional
            </Badge>
          )}
        </div>

        {/* Filter Row */}
        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap p-3 bg-muted/50 rounded-lg">
            <Select
              value={filters.ownerId}
              onValueChange={(value) => setFilters({ ...filters, ownerId: value })}
            >
              <SelectTrigger className="w-[180px]">
                <UserCircle className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos responsáveis</SelectItem>
                {uniqueOwners.map(ownerId => (
                  <SelectItem key={ownerId} value={ownerId as string}>
                    {profiles[ownerId as string]?.full_name || 'Sem nome'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.qualification}
              onValueChange={(value: FilterQualification) => setFilters({ ...filters, qualification: value })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Qualificação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="qualified">Qualificados</SelectItem>
                <SelectItem value="not_qualified">Não qualificados</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.productName}
              onValueChange={(value) => setFilters({ ...filters, productName: value })}
            >
              <SelectTrigger className="w-[180px]">
                <Package className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos produtos</SelectItem>
                {uniqueProducts.map(product => (
                  <SelectItem key={product} value={product as string}>
                    {product}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.campaignName}
              onValueChange={(value) => setFilters({ ...filters, campaignName: value })}
            >
              <SelectTrigger className="w-[180px]">
                <Tag className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas campanhas</SelectItem>
                {uniqueCampaigns.map(campaign => (
                  <SelectItem key={campaign} value={campaign as string}>
                    {campaign}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.utmSource}
              onValueChange={(value) => setFilters({ ...filters, utmSource: value })}
            >
              <SelectTrigger className="w-[180px]">
                <Globe className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Fonte UTM" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas fontes</SelectItem>
                {uniqueUtmSources.map(source => (
                  <SelectItem key={source} value={source as string}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({
                sortBy: 'created_desc',
                qualification: 'all',
                ownerId: 'all',
                productName: 'all',
                campaignName: 'all',
                utmSource: 'all',
              })}
            >
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <CRMDealsListView
          deals={deals.filter(deal => {
            if (!searchTerm) return true;
            return deal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              deal.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              deal.product_name?.toLowerCase().includes(searchTerm.toLowerCase());
          }) as any}
          stages={stages as any}
          profiles={profiles}
          formatCurrency={formatCurrency}
          onMoveDeal={handleMoveToStage}
          onViewDeal={handleViewDeal as any}
          onRefresh={fetchDeals}
        />
      )}

      {/* Kanban Board with DnD */}
      {viewMode === 'kanban' && (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Container do Kanban com scroll horizontal */}
        <div 
          id="crm-kanban-scroll"
          className="kanban-scroll-container"
          style={{
            width: 'calc(100% + 2rem)',
            marginLeft: '-1rem',
            overflowX: 'auto',
            overflowY: 'hidden',
            paddingLeft: '1rem',
            paddingRight: '1rem',
            paddingBottom: '1rem',
          }}
        >
          <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
            {stages.map((stage, index) => {
              const stageDeals = getStageDeals(stage.id);
              const stageValue = getStageValue(stage.id);
              return (
                <DroppableColumn
                  key={stage.id}
                  stage={stage}
                  index={index}
                  stageDeals={stageDeals}
                  stageValue={stageValue}
                  getStageHeaderColor={getStageHeaderColor}
                  getStageColumnColor={getStageColumnColor}
                  formatCurrency={formatCurrency}
                >
                  {stageDeals.map(deal => (
                    <DraggableDealCard
                      key={deal.id}
                      deal={deal}
                      stage={stage}
                      stages={stages}
                      onMove={handleMoveToStage}
                      onView={handleViewDeal}
                      movingDeal={movingDeal}
                      formatCurrency={formatCurrency}
                      profiles={profiles}
                    />
                  ))}
                </DroppableColumn>
              );
            })}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeDeal ? (
            <Card className="w-72 shadow-2xl border-2 border-primary bg-background rounded-lg opacity-90">
              <CardContent className="p-3">
                <p className="font-semibold text-sm">{activeDeal.name}</p>
                {activeDeal.contact && (
                  <p className="text-xs text-muted-foreground mt-1">{activeDeal.contact.name}</p>
                )}
                {activeDeal.value > 0 && (
                  <p className="text-xs font-semibold mt-1">{formatCurrency(activeDeal.value)}</p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {/* Deal Detail Modal */}
      <Dialog open={!!selectedDeal} onOpenChange={() => { setSelectedDeal(null); setIsEditing(false); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{isEditing ? 'Editar Oportunidade' : selectedDeal?.name}</DialogTitle>
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={handleEditClick}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
          </DialogHeader>

          {selectedDeal && !isEditing && (
            <Tabs defaultValue="deal" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="deal">Oportunidade</TabsTrigger>
                <TabsTrigger value="contact">Contato</TabsTrigger>
                <TabsTrigger value="history">
                  <History className="h-4 w-4 mr-1" />
                  Histórico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="deal" className="space-y-6 mt-4">
                {/* Deal Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Informações da Oportunidade</h4>
                    
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{selectedDeal.name}</span>
                    </div>

                    {selectedDeal.value > 0 && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                        <span className="font-semibold text-emerald-600">{formatCurrency(selectedDeal.value)}</span>
                      </div>
                    )}

                    {currentStage && (
                      <div className="flex items-center gap-2">
                        <Badge variant={currentStage.is_won ? 'default' : currentStage.is_lost ? 'destructive' : 'secondary'}>
                          Etapa: {currentStage.name}
                        </Badge>
                      </div>
                    )}

                    {selectedDeal.expected_close_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Previsão: {new Date(selectedDeal.expected_close_date).toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}

                    {/* Responsável */}
                    {selectedDeal.owner_id && profiles[selectedDeal.owner_id] && (
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4 text-blue-600" />
                        <span className="text-blue-600 font-medium">
                          Responsável: {profiles[selectedDeal.owner_id].full_name}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Produto & Campanha</h4>
                    
                    {selectedDeal.product_name && (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-violet-600" />
                        <span className="text-violet-600 font-medium">{selectedDeal.product_name}</span>
                      </div>
                    )}

                    {selectedDeal.campaign_name && (
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span>Campanha: {selectedDeal.campaign_name}</span>
                      </div>
                    )}

                    {selectedDeal.won !== null && (
                      <Badge variant={selectedDeal.won ? 'default' : 'destructive'}>
                        {selectedDeal.won ? 'Ganho' : 'Perdido'}
                      </Badge>
                    )}

                    {selectedDeal.loss_reason && (
                      <div>
                        <p className="text-xs text-muted-foreground">Motivo da perda</p>
                        <p className="text-sm">{selectedDeal.loss_reason}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {selectedDeal.notes && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">Observações</h4>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">{selectedDeal.notes}</p>
                  </div>
                )}

                {/* Custom Fields */}
                {selectedDeal.custom_fields && Object.keys(selectedDeal.custom_fields).length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Campos Personalizados</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(selectedDeal.custom_fields).map(([key, value]) => (
                        <div key={key} className="bg-muted/50 p-2 rounded">
                          <p className="text-xs text-muted-foreground">{key}</p>
                          <p className="text-sm">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* UTM Tracking Info in Deal Tab for quick access */}
                {selectedDeal.contact && (selectedDeal.contact.utm_source || selectedDeal.contact.utm_medium || selectedDeal.contact.utm_campaign) && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Origem do Lead</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(selectedDeal.contact.utm_medium || selectedDeal.contact.utm_source) && (
                        <div className="bg-muted/50 p-2 rounded">
                          <p className="text-xs text-muted-foreground">Fonte</p>
                          <p className="text-sm font-medium truncate">
                            {[selectedDeal.contact.utm_medium, selectedDeal.contact.utm_source].filter(Boolean).join(' | ')}
                          </p>
                        </div>
                      )}
                      {selectedDeal.contact.utm_campaign && (
                        <div className="bg-muted/50 p-2 rounded">
                          <p className="text-xs text-muted-foreground">Campanha</p>
                          <p className="text-sm font-medium truncate">{selectedDeal.contact.utm_campaign}</p>
                        </div>
                      )}
                      {selectedDeal.contact.utm_content && (
                        <div className="bg-muted/50 p-2 rounded">
                          <p className="text-xs text-muted-foreground">UTM Content</p>
                          <p className="text-sm truncate">{selectedDeal.contact.utm_content}</p>
                        </div>
                      )}
                      {selectedDeal.contact.utm_term && (
                        <div className="bg-muted/50 p-2 rounded">
                          <p className="text-xs text-muted-foreground">UTM Term</p>
                          <p className="text-sm truncate">{selectedDeal.contact.utm_term}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="border-t pt-4 flex items-center justify-between flex-wrap gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Criado em</p>
                    <p>{new Date(selectedDeal.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  {selectedDeal.rd_station_id && (
                    <div>
                      <p className="text-xs text-muted-foreground">ID RD Station</p>
                      <p className="font-mono text-xs">{selectedDeal.rd_station_id}</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-6 mt-4">
                {selectedDeal.contact ? (
                  <>
                    {/* Contact Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Informações de Contato</h4>
                        
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{selectedDeal.contact.name}</span>
                        </div>

                        {selectedDeal.contact.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <a href={`mailto:${selectedDeal.contact.email}`} className="text-primary hover:underline">
                              {selectedDeal.contact.email}
                            </a>
                          </div>
                        )}

                        {selectedDeal.contact.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <a href={`tel:${selectedDeal.contact.phone}`} className="text-primary hover:underline">
                              {selectedDeal.contact.phone}
                            </a>
                          </div>
                        )}

                        {selectedDeal.contact.birthday && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>Aniversário: {new Date(selectedDeal.contact.birthday).toLocaleDateString('pt-BR')}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Empresa</h4>
                        
                        {selectedDeal.contact.company && (
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span>{selectedDeal.contact.company}</span>
                          </div>
                        )}

                        {selectedDeal.contact.job_title && (
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span>{selectedDeal.contact.job_title}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Address */}
                    {(selectedDeal.contact.address || selectedDeal.contact.city || selectedDeal.contact.state) && (
                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Endereço</h4>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            {selectedDeal.contact.address && <p>{selectedDeal.contact.address}</p>}
                            <p>{[selectedDeal.contact.city, selectedDeal.contact.state, selectedDeal.contact.country].filter(Boolean).join(', ')}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Social Media */}
                    {(selectedDeal.contact.website || selectedDeal.contact.linkedin || selectedDeal.contact.twitter || selectedDeal.contact.facebook) && (
                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Redes Sociais</h4>
                        <div className="flex flex-wrap gap-3">
                          {selectedDeal.contact.website && (
                            <a href={selectedDeal.contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                              <Globe className="h-4 w-4" /> Website
                            </a>
                          )}
                          {selectedDeal.contact.linkedin && (
                            <a href={selectedDeal.contact.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                              <Linkedin className="h-4 w-4" /> LinkedIn
                            </a>
                          )}
                          {selectedDeal.contact.twitter && (
                            <a href={selectedDeal.contact.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                              <Twitter className="h-4 w-4" /> Twitter
                            </a>
                          )}
                          {selectedDeal.contact.facebook && (
                            <a href={selectedDeal.contact.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                              <Facebook className="h-4 w-4" /> Facebook
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* UTM Info - Complete like RD Station */}
                    <div className="border-t pt-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Origem e Tracking do Lead</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Fonte (traffic_source from RD Station - e.g., "Busca Paga | Facebook") */}
                        {selectedDeal.contact.traffic_source && (
                          <div className="bg-muted/50 p-3 rounded-md">
                            <p className="text-xs text-muted-foreground font-medium">Fonte</p>
                            <p className="text-sm font-semibold">{selectedDeal.contact.traffic_source}</p>
                          </div>
                        )}

                        {/* Campanha (traffic_campaign from RD Station) */}
                        {selectedDeal.contact.traffic_campaign && (
                          <div className="bg-muted/50 p-3 rounded-md">
                            <p className="text-xs text-muted-foreground font-medium">Campanha</p>
                            <p className="text-sm font-semibold">{selectedDeal.contact.traffic_campaign}</p>
                          </div>
                        )}

                        {/* UTM Source */}
                        {selectedDeal.contact.utm_source && (
                          <div className="bg-muted/50 p-3 rounded-md">
                            <p className="text-xs text-muted-foreground font-medium">UTM Source</p>
                            <p className="text-sm">{selectedDeal.contact.utm_source}</p>
                          </div>
                        )}

                        {/* UTM Medium */}
                        {selectedDeal.contact.utm_medium && (
                          <div className="bg-muted/50 p-3 rounded-md">
                            <p className="text-xs text-muted-foreground font-medium">UTM Medium</p>
                            <p className="text-sm">{selectedDeal.contact.utm_medium}</p>
                          </div>
                        )}

                        {/* UTM Campaign */}
                        {selectedDeal.contact.utm_campaign && (
                          <div className="bg-muted/50 p-3 rounded-md">
                            <p className="text-xs text-muted-foreground font-medium">UTM Campaign</p>
                            <p className="text-sm">{selectedDeal.contact.utm_campaign}</p>
                          </div>
                        )}

                        {/* UTM Content */}
                        {selectedDeal.contact.utm_content && (
                          <div className="bg-muted/50 p-3 rounded-md">
                            <p className="text-xs text-muted-foreground font-medium">UTM Content</p>
                            <p className="text-sm">{selectedDeal.contact.utm_content}</p>
                          </div>
                        )}

                        {/* UTM Term */}
                        {selectedDeal.contact.utm_term && (
                          <div className="bg-muted/50 p-3 rounded-md">
                            <p className="text-xs text-muted-foreground font-medium">UTM Term</p>
                            <p className="text-sm">{selectedDeal.contact.utm_term}</p>
                          </div>
                        )}

                        {/* Lead Qualificado */}
                        <div className="bg-muted/50 p-3 rounded-md">
                          <p className="text-xs text-muted-foreground font-medium">Lead Qualificado</p>
                          <Badge variant={(selectedDeal.contact.lead_score || 0) > 0 ? 'default' : 'secondary'}>
                            {(selectedDeal.contact.lead_score || 0) > 0 ? 'Sim' : 'Não'}
                          </Badge>
                        </div>

                        {/* Lead Score */}
                        <div className="bg-muted/50 p-3 rounded-md">
                          <p className="text-xs text-muted-foreground font-medium">Qualificação (Score)</p>
                          <p className="text-sm font-semibold">{selectedDeal.contact.lead_score || 0}</p>
                        </div>
                      </div>
                    </div>

                    {/* Conversions */}
                    {(selectedDeal.contact.first_conversion || selectedDeal.contact.last_conversion) && (
                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Conversões</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {selectedDeal.contact.first_conversion && (
                            <div>
                              <p className="text-xs text-muted-foreground">Primeira Conversão</p>
                              <p className="text-sm">{selectedDeal.contact.first_conversion}</p>
                            </div>
                          )}
                          {selectedDeal.contact.last_conversion && (
                            <div>
                              <p className="text-xs text-muted-foreground">Última Conversão</p>
                              <p className="text-sm">{selectedDeal.contact.last_conversion}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedDeal.contact.notes && (
                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">Observações</h4>
                        <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">{selectedDeal.contact.notes}</p>
                      </div>
                    )}

                    {/* Custom Fields */}
                    {selectedDeal.contact.custom_fields && Object.keys(selectedDeal.contact.custom_fields).length > 0 && (
                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Campos Personalizados</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(selectedDeal.contact.custom_fields).map(([key, value]) => (
                            <div key={key} className="bg-muted/50 p-2 rounded">
                              <p className="text-xs text-muted-foreground">{key}</p>
                              <p className="text-sm">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lead Score & Metadata */}
                    <div className="border-t pt-4 flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Lead Score</p>
                        <Badge variant={selectedDeal.contact.lead_score && selectedDeal.contact.lead_score > 50 ? 'default' : 'secondary'}>
                          {selectedDeal.contact.lead_score || 0} pontos
                        </Badge>
                      </div>
                      {selectedDeal.contact.rd_station_id && (
                        <div>
                          <p className="text-xs text-muted-foreground">ID RD Station</p>
                          <p className="font-mono text-xs">{selectedDeal.contact.rd_station_id}</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum contato associado a esta oportunidade
                  </div>
                )}
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="space-y-4 mt-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Histórico de Atividades</h4>
                
                {loadingActivities ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : dealActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma atividade registrada</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {dealActivities.map((activity) => (
                        <Card key={activity.id} className={activity.completed ? 'opacity-60' : ''}>
                          <CardContent className="py-3">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-full shrink-0 ${activity.completed ? 'bg-green-500/10 text-green-600' : 'bg-primary/10 text-primary'}`}>
                                {getActivityIcon(activity.type)}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className={`font-medium text-sm ${activity.completed ? 'line-through' : ''}`}>
                                      {activity.title}
                                    </p>
                                    {activity.description && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {activity.description}
                                      </p>
                                    )}
                                  </div>
                                  <Badge variant="secondary" className="shrink-0 text-xs">
                                    {getActivityTypeName(activity.type)}
                                  </Badge>
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  {activity.owner_id && profiles[activity.owner_id] && (
                                    <span className="flex items-center gap-1">
                                      <UserCircle className="h-3 w-3" />
                                      {profiles[activity.owner_id].full_name}
                                    </span>
                                  )}
                                  {activity.due_date && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(activity.due_date).toLocaleDateString('pt-BR')}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    Criado: {new Date(activity.created_at).toLocaleDateString('pt-BR')}
                                  </span>
                                  {activity.completed && (
                                    <Badge variant="outline" className="text-green-600 border-green-600/20 text-xs">
                                      Concluída
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* Edit Form */}
          {selectedDeal && isEditing && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-semibold">Oportunidade</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input
                      type="number"
                      value={editForm.value || ''}
                      onChange={(e) => setEditForm({ ...editForm, value: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Previsão de Fechamento</Label>
                    <Input
                      type="date"
                      value={editForm.expected_close_date || ''}
                      onChange={(e) => setEditForm({ ...editForm, expected_close_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={editForm.notes || ''}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              {selectedDeal.contact && (
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-semibold">Contato</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input
                        value={editForm.contact?.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, contact: { ...editForm.contact, name: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={editForm.contact?.email || ''}
                        onChange={(e) => setEditForm({ ...editForm, contact: { ...editForm.contact, email: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input
                        value={editForm.contact?.phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, contact: { ...editForm.contact, phone: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Empresa</Label>
                      <Input
                        value={editForm.contact?.company || ''}
                        onChange={(e) => setEditForm({ ...editForm, contact: { ...editForm.contact, company: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cargo</Label>
                      <Input
                        value={editForm.contact?.job_title || ''}
                        onChange={(e) => setEditForm({ ...editForm, contact: { ...editForm.contact, job_title: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input
                        value={editForm.contact?.city || ''}
                        onChange={(e) => setEditForm({ ...editForm, contact: { ...editForm.contact, city: e.target.value } })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Observações do Contato</Label>
                    <Textarea
                      value={editForm.contact?.notes || ''}
                      onChange={(e) => setEditForm({ ...editForm, contact: { ...editForm.contact, notes: e.target.value } })}
                      rows={3}
                    />
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
