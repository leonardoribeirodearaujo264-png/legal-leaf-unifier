import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, parseISO, isPast, isValid } from 'date-fns';

interface Task {
  id: string;
  title: string;
  due_date: string;
  status: string;
}

interface NotificationSettings {
  notify_days_before: number;
  notify_on_due_date: boolean;
  notify_when_overdue: boolean;
  push_notifications: boolean;
}

export const useTaskNotifications = (tasks: Task[]) => {
  const sendPushNotification = useCallback((title: string, body: string, tag?: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/logo-eggnunes.png',
        tag: tag || 'task-notification',
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }, []);

  const checkAndNotify = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch notification settings
      const { data: settings } = await supabase
        .from('task_notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!settings || !settings.push_notifications) return;

      const notificationSettings = settings as NotificationSettings;
      const today = new Date();
      const pendingTasks = tasks.filter(
        (t) => t.status?.toLowerCase() !== 'completed' && t.status?.toLowerCase() !== 'concluída'
      );

      let overdueCount = 0;
      let dueTodayCount = 0;
      let dueSoonCount = 0;

      pendingTasks.forEach((task) => {
        if (!task.due_date) return;
        try {
          const dueDate = parseISO(task.due_date);
          if (!isValid(dueDate)) return;

          const daysUntilDue = differenceInDays(dueDate, today);

          if (isPast(dueDate) && daysUntilDue < 0) {
            overdueCount++;
          } else if (daysUntilDue === 0) {
            dueTodayCount++;
          } else if (daysUntilDue > 0 && daysUntilDue <= notificationSettings.notify_days_before) {
            dueSoonCount++;
          }
        } catch {
          // Skip invalid dates
        }
      });

      // Send notifications based on settings
      if (notificationSettings.notify_when_overdue && overdueCount > 0) {
        sendPushNotification(
          '⚠️ Tarefas Atrasadas',
          `Você tem ${overdueCount} tarefa(s) atrasada(s) que precisam de atenção.`,
          'overdue-tasks'
        );
      }

      if (notificationSettings.notify_on_due_date && dueTodayCount > 0) {
        sendPushNotification(
          '📅 Tarefas para Hoje',
          `Você tem ${dueTodayCount} tarefa(s) com vencimento hoje.`,
          'due-today-tasks'
        );
      }

      if (dueSoonCount > 0) {
        sendPushNotification(
          '⏰ Tarefas Próximas do Vencimento',
          `Você tem ${dueSoonCount} tarefa(s) vencendo nos próximos ${notificationSettings.notify_days_before} dias.`,
          'due-soon-tasks'
        );
      }
    } catch (error) {
      console.error('Error checking task notifications:', error);
    }
  }, [tasks, sendPushNotification]);

  useEffect(() => {
    // Só executa se aba estiver visível e notificações concedidas
    const checkNotifications = () => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        checkAndNotify();
      }
    };

    // Initial check after a short delay
    const initialTimeout = setTimeout(checkNotifications, 5000);

    // Periodic check every 2 hours (reduzido de 30min para economia de Cloud)
    const interval = setInterval(checkNotifications, 2 * 60 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkAndNotify]);

  return { sendPushNotification, checkAndNotify };
};
