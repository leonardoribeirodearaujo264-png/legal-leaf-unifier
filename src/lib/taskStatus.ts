/**
 * Utilitários para classificação canônica de status de tarefas ADVBox.
 *
 * IMPORTANTE: Use SEMPRE essas funções em vez de comparar strings de status
 * diretamente ou comparar datas direto. Elas garantem consistência entre a
 * lista de tarefas (TarefasAdvbox.tsx) e os gráficos
 * (RelatoriosProdutividadeTarefas.tsx).
 *
 * Histórico do bug:
 *   - Filtro "Atrasadas" mostrava tarefas concluídas porque só comparava
 *     `due_date < today` sem checar status.
 *   - Gráfico de produtividade mostrava 2 categorias (concluídas/pendentes)
 *     enquanto KPI mostrava 3 (concluídas/pendentes/em andamento), gerando
 *     contagens diferentes para o mesmo dado.
 *   - Status vinha do ADVBox em PT/EN, com e sem acento — cada lugar
 *     normalizava de um jeito ligeiramente diferente.
 */

import { isBefore, startOfDay } from 'date-fns';

export type TaskStatusKey =
  | 'completed'
  | 'pending'
  | 'in_progress'
  | 'stale'
  | 'unknown';

/**
 * Normaliza qualquer string de status (PT/EN, com ou sem acento, com ou sem
 * underscore) para uma chave canônica. Use isso em qualquer lugar que precise
 * comparar status — nunca comparar strings cruas.
 */
export function normalizeStatus(status?: string | null): TaskStatusKey {
  const s = (status || '').toLowerCase().trim();
  if (
    s === 'completed' ||
    s === 'concluída' ||
    s === 'concluida' ||
    s === 'concluído' ||
    s === 'concluido'
  ) {
    return 'completed';
  }
  if (s === 'pending' || s === 'pendente') return 'pending';
  if (s === 'in_progress' || s === 'em andamento' || s === 'em_andamento') {
    return 'in_progress';
  }
  if (
    s === 'stale' ||
    s === 'obsoleta' ||
    s === 'obsoleto' ||
    s === 'deleted' ||
    s === 'descontinuada'
  ) {
    return 'stale';
  }
  return 'unknown';
}

export interface TaskLike {
  status?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
}

export function isCompletedTask(task: TaskLike): boolean {
  // Se há completed_at preenchido, considera concluída mesmo que o status
  // ainda não tenha sido propagado pelo sync.
  if (task.completed_at) return true;
  return normalizeStatus(task.status) === 'completed';
}

export function isPendingTask(task: TaskLike): boolean {
  return normalizeStatus(task.status) === 'pending' && !task.completed_at;
}

export function isInProgressTask(task: TaskLike): boolean {
  return normalizeStatus(task.status) === 'in_progress' && !task.completed_at;
}

export function isStaleTask(task: TaskLike): boolean {
  return normalizeStatus(task.status) === 'stale';
}

/**
 * REGRA OFICIAL DE TAREFA ATRASADA:
 *   1. Tem data de vencimento no passado (anterior ao início do dia de hoje)
 *   2. NÃO está concluída
 *   3. NÃO está obsoleta
 *
 * Tarefa concluída ou obsoleta NUNCA é atrasada — independente da data.
 *
 * Use SEMPRE essa função; não compare `due_date < new Date()` em outro lugar.
 */
export function isOverdueTask(task: TaskLike): boolean {
  if (!task.due_date) return false;
  if (isCompletedTask(task)) return false;
  if (isStaleTask(task)) return false;
  const dueDate = new Date(task.due_date);
  const today = startOfDay(new Date());
  return isBefore(dueDate, today);
}

/**
 * Retorna a categoria principal da tarefa para gráficos. Use isso em vez de
 * if/else encadeado em cada componente para garantir que a soma das
 * categorias seja sempre igual ao total.
 */
export function getTaskCategory(task: TaskLike): TaskStatusKey {
  if (isCompletedTask(task)) return 'completed';
  if (isStaleTask(task)) return 'stale';
  if (isInProgressTask(task)) return 'in_progress';
  if (isPendingTask(task)) return 'pending';
  // Fallback — qualquer status desconhecido entra em "pending" para não sumir
  // do gráfico (era a fonte do bug "categorias divergentes").
  return 'pending';
}

/** Labels e descrições para UI — fonte única da verdade. */
export const STATUS_LABELS: Record<TaskStatusKey, string> = {
  completed: 'Concluída',
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  stale: 'Obsoleta',
  unknown: 'Indefinido',
};

export const STATUS_DESCRIPTIONS: Record<TaskStatusKey, string> = {
  completed:
    'Tarefa finalizada. Não conta para "Pendentes" nem "Atrasadas", independente da data de vencimento.',
  pending:
    'Tarefa criada e ainda não iniciada. Se a data de vencimento já passou, aparece também em "Atrasadas".',
  in_progress:
    'Tarefa em execução pelo responsável. Se a data de vencimento já passou, aparece também em "Atrasadas".',
  stale:
    'Tarefa marcada como obsoleta (vencimento há mais de 90 dias e nunca concluída). Fica oculta dos relatórios e da contagem de atrasadas.',
  unknown: 'Status não reconhecido — verifique a sincronização com o ADVBox.',
};

/** Cores consistentes entre todos os gráficos. Não inventar nova cor por componente. */
export const STATUS_COLORS: Record<TaskStatusKey, string> = {
  completed: '#10b981', // emerald-500 — verde
  pending: '#eab308', // yellow-500 — amarelo
  in_progress: '#3b82f6', // blue-500 — azul
  stale: '#6b7280', // gray-500 — cinza
  unknown: '#9ca3af', // gray-400
};
