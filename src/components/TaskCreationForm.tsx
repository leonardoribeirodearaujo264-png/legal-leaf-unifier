import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Calendar as CalendarIcon, Clock, MapPin, Users, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskType {
  id: string | number;
  name: string;
}

interface AdvboxUser {
  id: number;
  name: string;
  email?: string;
}

export interface TaskFormData {
  lawsuitId: number;
  processNumber: string;
  title: string;
  description: string;
  customerName?: string;
  // Pre-fill fields from suggestion rules
  prefillTaskTypeId?: number;
  prefillResponsibleId?: string | null;
  prefillDeadline?: string;
}

interface TaskCreationFormProps {
  initialData: TaskFormData;
  taskTypes: TaskType[];
  advboxUsers: AdvboxUser[];
  loadingTaskTypes: boolean;
  loadingUsers: boolean;
  onFetchTaskTypes: () => void;
  onFetchUsers: () => void;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function TaskCreationForm({
  initialData,
  taskTypes,
  advboxUsers,
  loadingTaskTypes,
  loadingUsers,
  onFetchTaskTypes,
  onFetchUsers,
  onSubmit,
  onCancel,
  isSubmitting,
}: TaskCreationFormProps) {
  const [taskTypeId, setTaskTypeId] = useState('');
  const [comments, setComments] = useState(initialData.description || '');
  const [taskTitle, setTaskTitle] = useState(initialData.title || '');
  const [fromUserId, setFromUserId] = useState('');
  const [selectedGuests, setSelectedGuests] = useState<number[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [endTime, setEndTime] = useState('');
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>();
  const [local, setLocal] = useState('');
  const [notes, setNotes] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [displaySchedule, setDisplaySchedule] = useState(true);
  const [isSuggestingTask, setIsSuggestingTask] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);

  const { toast } = useToast();

  useEffect(() => {
    setTaskTitle(initialData.title || '');
    setComments(initialData.description || '');
    
    // Apply pre-filled values from suggestion rules
    if (initialData.prefillTaskTypeId) {
      setTaskTypeId(String(initialData.prefillTaskTypeId));
    }
    if (initialData.prefillResponsibleId) {
      setFromUserId(String(initialData.prefillResponsibleId));
    }
    if (initialData.prefillDeadline) {
      try {
        setDeadlineDate(new Date(initialData.prefillDeadline));
      } catch (e) {
        console.warn('Could not parse prefill deadline date');
      }
    }
  }, [initialData]);

  const suggestTaskWithAI = async () => {
    setIsSuggestingTask(true);
    setAiSuggestion(null);

    try {
      const { data, error } = await supabase.functions.invoke('suggest-task', {
        body: {
          movementTitle: initialData.title || '',
          publicationContent: initialData.description 
            ? `${initialData.title || ''}\n\n${initialData.description}` 
            : initialData.title || '',
          processNumber: initialData.processNumber,
          customerName: initialData.customerName,
          taskTypes: taskTypes.map(t => ({ id: t.id, name: t.name })),
        },
      });

      // Extrair mensagem de erro real do body (retornamos HTTP 200 com { error } no body)
      if (data?.error) {
        throw new Error(data.error);
      }

      if (error) {
        // Tentar extrair mensagem do data mesmo quando SDK reporta erro
        const realMessage = data?.error || data?.message || error.message || 'Erro ao chamar a função de sugestão.';
        throw new Error(realMessage);
      }

      if (data) {
        setAiSuggestion(data);
        toast({
          title: 'Sugestão gerada',
          description: 'Clique em "Aplicar Sugestão" para preencher os campos.',
        });
      }
    } catch (error: any) {
      const message = error?.message || 'Não foi possível gerar sugestão.';
      toast({
        title: 'Erro ao sugerir tarefa',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSuggestingTask(false);
    }
  };

  const applyAISuggestion = () => {
    if (!aiSuggestion) return;

    if (aiSuggestion.taskTitle) setTaskTitle(aiSuggestion.taskTitle);
    if (aiSuggestion.taskDescription) setComments(aiSuggestion.taskDescription);
    if (aiSuggestion.suggestedTaskTypeId) {
      setTaskTypeId(String(aiSuggestion.suggestedTaskTypeId));
    } else if (aiSuggestion.suggestedTaskType && taskTypes.length > 0) {
      const matchingType = taskTypes.find(t =>
        t.name.toLowerCase().includes(aiSuggestion.suggestedTaskType.toLowerCase()) ||
        aiSuggestion.suggestedTaskType.toLowerCase().includes(t.name.toLowerCase())
      );
      if (matchingType) setTaskTypeId(String(matchingType.id));
    }
    if (aiSuggestion.suggestedDeadline) {
      try {
        setDeadlineDate(parseISO(aiSuggestion.suggestedDeadline));
      } catch (e) {
        console.warn('Could not parse deadline date');
      }
    }
    if (aiSuggestion.isUrgent) setIsUrgent(true);
    if (aiSuggestion.isImportant) setIsImportant(true);
    if (aiSuggestion.reasoning) setNotes(aiSuggestion.reasoning);

    toast({ title: 'Sugestão aplicada', description: 'Os campos foram preenchidos.' });
  };

  const toggleGuest = (userId: number) => {
    setSelectedGuests(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (!taskTitle.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Informe o título da tarefa.',
        variant: 'destructive',
      });
      return;
    }

    if (!taskTypeId) {
      toast({
        title: 'Categoria obrigatória',
        description: 'Selecione uma categoria.',
        variant: 'destructive',
      });
      return;
    }

    const parsedTaskTypeId = parseInt(String(taskTypeId), 10);
    const parsedFromUserId = fromUserId ? parseInt(String(fromUserId), 10) : 1;
    const parsedGuests = selectedGuests.length > 0
      ? selectedGuests.map(g => parseInt(String(g), 10))
      : [parsedFromUserId];

    const taskData: Record<string, any> = {
      lawsuits_id: initialData.lawsuitId,
      tasks_id: parsedTaskTypeId,
      from: parsedFromUserId,
      guests: parsedGuests,
      start_date: startDate ? format(startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      comments: `${taskTitle}\n\n${comments}${notes ? '\n\nObservações: ' + notes : ''}`,
    };

    if (startTime) taskData.start_time = startTime;
    if (endDate) taskData.end_date = format(endDate, 'yyyy-MM-dd');
    if (endTime) taskData.end_time = endTime;
    if (deadlineDate) taskData.date_deadline = format(deadlineDate, 'yyyy-MM-dd');
    if (local) taskData.local = local;
    if (isUrgent) taskData.urgent = 1;
    if (isImportant) taskData.important = 1;
    taskData.display_schedule = displaySchedule ? 1 : 0;

    await onSubmit(taskData);
  };

  return (
    <div className="space-y-4">
      {/* AI Suggestion Button */}
      <Button
        onClick={suggestTaskWithAI}
        variant="outline"
        className="w-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border-purple-500/30"
        disabled={isSuggestingTask}
      >
        {isSuggestingTask ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Analisando com IA...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
            Sugerir Tarefa com IA
          </>
        )}
      </Button>

      {aiSuggestion && (
        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-md text-sm border border-purple-200 dark:border-purple-800 space-y-2">
          <p className="font-medium text-purple-700 dark:text-purple-300 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Sugestão da IA:
          </p>
          {aiSuggestion.taskTitle && <p><strong>Título:</strong> {aiSuggestion.taskTitle}</p>}
          {aiSuggestion.suggestedTaskType && <p><strong>Tipo:</strong> {aiSuggestion.suggestedTaskType}</p>}
          {aiSuggestion.suggestedDeadline && (
            <p><strong>Prazo:</strong> {format(parseISO(aiSuggestion.suggestedDeadline), 'dd/MM/yyyy')}</p>
          )}
          {aiSuggestion.reasoning && (
            <p className="text-muted-foreground text-xs">{aiSuggestion.reasoning}</p>
          )}
          <Button
            onClick={applyAISuggestion}
            size="sm"
            className="w-full mt-2 bg-purple-600 hover:bg-purple-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Aplicar Sugestão
          </Button>
        </div>
      )}

      {/* Título */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Título *</Label>
        <Input
          value={taskTitle}
          onChange={(e) => setTaskTitle(e.target.value)}
          placeholder="Título da tarefa"
        />
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Descrição</Label>
        <Textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Descrição da tarefa"
          rows={3}
        />
      </div>

      {/* Tipo de Tarefa */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Categoria *</Label>
        {loadingTaskTypes ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : taskTypes.length > 0 ? (
          <Select value={taskTypeId} onValueChange={setTaskTypeId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              {taskTypes.map((type) => (
                <SelectItem key={type.id} value={String(type.id)}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="space-y-2">
            <Input
              value={taskTypeId}
              onChange={(e) => setTaskTypeId(e.target.value)}
              placeholder="ID da categoria"
            />
            <Button variant="outline" size="sm" onClick={onFetchTaskTypes}>
              <RefreshCw className="h-3 w-3 mr-1" /> Carregar categorias
            </Button>
          </div>
        )}
      </div>

      {/* Responsável */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Responsável (Criador)</Label>
        {loadingUsers ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : advboxUsers.length > 0 ? (
          <Select value={fromUserId} onValueChange={setFromUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o responsável" />
            </SelectTrigger>
            <SelectContent>
              {advboxUsers.map((user) => (
                <SelectItem key={user.id} value={String(user.id)}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={fromUserId}
            onChange={(e) => setFromUserId(e.target.value)}
            placeholder="ID do responsável"
          />
        )}
      </div>

      {/* Participantes */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Participantes
        </Label>
        {advboxUsers.length > 0 ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedGuests.map(guestId => {
                const user = advboxUsers.find(u => u.id === guestId);
                return (
                  <Badge key={guestId} variant="secondary" className="gap-1">
                    {user?.name || `ID: ${guestId}`}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => toggleGuest(guestId)}
                    />
                  </Badge>
                );
              })}
            </div>
            <ScrollArea className="h-24 border rounded-md p-2">
              <div className="space-y-2">
                {advboxUsers.map((user) => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`guest-form-${user.id}`}
                      checked={selectedGuests.includes(user.id)}
                      onCheckedChange={() => toggleGuest(user.id)}
                    />
                    <label htmlFor={`guest-form-${user.id}`} className="text-sm cursor-pointer">
                      {user.name}
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Os participantes serão definidos automaticamente.
          </p>
        )}
      </div>

      {/* Data e Hora de Início */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Data *
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                {startDate ? format(startDate, "dd/MM/yyyy") : "Selecionar"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Hora
          </Label>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
      </div>

      {/* Data e Hora de Término */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Data Término</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                {endDate ? format(endDate, "dd/MM/yyyy") : "Opcional"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Hora Término</Label>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            placeholder="HH:MM"
          />
        </div>
      </div>

      {/* Prazo Fatal */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-destructive flex items-center gap-2">
          <CalendarIcon className="h-4 w-4" />
          Prazo Fatal
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !deadlineDate && "text-muted-foreground"
              )}
            >
              {deadlineDate ? format(deadlineDate, "dd/MM/yyyy") : "Selecionar prazo fatal"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={deadlineDate}
              onSelect={setDeadlineDate}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Local */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Local do Evento
        </Label>
        <Input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Ex: Sala de reuniões, Fórum, etc."
        />
      </div>

      {/* Observações */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Observações</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observações adicionais"
          rows={2}
        />
      </div>

      {/* Flags */}
      <div className="space-y-3 pt-2 border-t">
        <Label className="text-sm font-medium">Opções</Label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="urgent-form"
              checked={isUrgent}
              onCheckedChange={(checked) => setIsUrgent(checked as boolean)}
            />
            <label htmlFor="urgent-form" className="text-sm cursor-pointer font-medium text-orange-600">
              Urgente
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="important-form"
              checked={isImportant}
              onCheckedChange={(checked) => setIsImportant(checked as boolean)}
            />
            <label htmlFor="important-form" className="text-sm cursor-pointer font-medium text-blue-600">
              Importante
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="display_schedule-form"
              checked={displaySchedule}
              onCheckedChange={(checked) => setDisplaySchedule(checked as boolean)}
            />
            <label htmlFor="display_schedule-form" className="text-sm cursor-pointer">
              Mostrar na Agenda
            </label>
          </div>
        </div>
      </div>

      {/* Nota */}
      <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
        <strong>Nota:</strong> As opções Futura, Recorrente, Privada, Retroativa e Anexar Arquivos
        não estão disponíveis via API do Advbox.
      </p>

      {/* Buttons */}
      <div className="flex gap-2 pt-4">
        <Button
          onClick={handleSubmit}
          className="flex-1"
          disabled={!taskTypeId || !taskTitle.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Criando...
            </>
          ) : (
            'Criar Tarefa'
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
