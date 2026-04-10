import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Phone, Mail, Calendar, CheckCircle, Circle, MessageSquare, Video, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  contact?: {
    name: string;
  } | null;
  deal?: {
    name: string;
  } | null;
}

export const CRMActivities = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    const { data, error } = await supabase
      .from('crm_activities')
      .select(`
        *,
        contact:crm_contacts(name),
        deal:crm_deals(name)
      `)
      .order('due_date', { ascending: true, nullsFirst: false });
    
    if (error) {
      console.error('Error fetching activities:', error);
    } else {
      setActivities(data || []);
    }
    setLoading(false);
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

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = searchTerm === '' ||
      activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.contact?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.deal?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filter === 'all' ||
      (filter === 'pending' && !activity.completed) ||
      (filter === 'completed' && activity.completed);
    
    return matchesSearch && matchesFilter;
  });

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar atividades..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
      <div className="flex gap-2">
          <Badge
            variant={filter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('all')}
          >
            Todas ({activities.length})
          </Badge>
          <Badge
            variant={filter === 'pending' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('pending')}
          >
            Pendentes ({activities.filter(a => !a.completed).length})
          </Badge>
          <Badge
            variant={filter === 'completed' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('completed')}
          >
            Concluídas ({activities.filter(a => a.completed).length})
          </Badge>
        </div>
      </div>

      {/* Activities list */}
      <div className="space-y-3">
        {filteredActivities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {activities.length === 0
                  ? 'Nenhuma atividade registrada.'
                  : 'Nenhuma atividade encontrada.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredActivities.map((activity) => (
            <Card key={activity.id} className={activity.completed ? 'opacity-60' : ''}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-full ${activity.completed ? 'bg-green-500/10 text-green-600' : 'bg-primary/10 text-primary'}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`font-medium ${activity.completed ? 'line-through' : ''}`}>
                          {activity.title}
                        </p>
                        {activity.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {activity.description}
                          </p>
                        )}
                      </div>
                      
                      <Badge variant="secondary" className="shrink-0">
                        {getActivityTypeName(activity.type)}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                      {activity.contact && (
                        <span>Contato: {activity.contact.name}</span>
                      )}
                      {activity.deal && (
                        <span>Oportunidade: {activity.deal.name}</span>
                      )}
                      {activity.due_date && (
                        <div className={`flex items-center gap-1 ${!activity.completed && isOverdue(activity.due_date) ? 'text-red-500' : ''}`}>
                          <Calendar className="h-3 w-3" />
                          <span>
                            {new Date(activity.due_date).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {!activity.completed && isOverdue(activity.due_date) && (
                            <Badge variant="destructive" className="text-xs ml-1">Atrasada</Badge>
                          )}
                        </div>
                      )}
                      {activity.completed && activity.completed_at && (
                        <Badge variant="outline" className="text-green-600 border-green-600/20">
                          Concluída em {new Date(activity.completed_at).toLocaleDateString('pt-BR')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {activities.length > 0 && (
        <div className="text-center pt-4">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Gerencie atividades diretamente aqui no CRM
          </Badge>
        </div>
      )}
    </div>
  );
};
