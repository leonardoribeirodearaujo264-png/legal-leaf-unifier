import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

import { toast } from 'sonner';

export interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  participants?: ConversationParticipant[];
  last_message?: Message;
  unread_count?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    position: string | null;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_edited?: boolean;
  reply_to_id?: string | null;
  reply_to?: Message | null;
  sender?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export const useMessaging = () => {
  const { user } = useAuth();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  // Map: messageId -> Set of userIds that received the message
  const [deliveries, setDeliveries] = useState<Record<string, Set<string>>>({});

  // Fetch all conversations for the user
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      if (conversations.length === 0) {
        setLoading(true);
      }
      
      // Get conversations where user is a participant
      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (partError) throw partError;

      if (!participations || participations.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participations.map(p => p.conversation_id);

      // Get conversation details
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      if (convError) throw convError;

      // Get participants for each conversation
      const { data: allParticipants, error: allPartError } = await supabase
        .from('conversation_participants')
        .select('*')
        .in('conversation_id', conversationIds);

      if (allPartError) throw allPartError;

      // Get profiles for all participants
      const userIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, position')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Get last message for each conversation
      const { data: lastMessages, error: lastMsgError } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      if (lastMsgError) throw lastMsgError;

      // Map data
      const enrichedConversations = convData?.map(conv => {
        const convParticipants = allParticipants?.filter(p => p.conversation_id === conv.id) || [];
        const enrichedParticipants = convParticipants.map(p => ({
          ...p,
          profile: profiles?.find(pr => pr.id === p.user_id)
        }));

        const lastMessage = lastMessages?.find(m => m.conversation_id === conv.id);
        
        // Store participation for later exact count
        const myParticipation = convParticipants.find(p => p.user_id === user.id);

        return {
          ...conv,
          participants: enrichedParticipants,
          last_message: lastMessage,
          unread_count: 0, // will be updated below
          _lastReadAt: myParticipation?.last_read_at || null
        };
      }) || [];

      // Deduplicate 1-1 conversations: keep only the most recent per participant pair
      const deduplicatedConversations: typeof enrichedConversations = [];
      const seenPairs = new Set<string>();

      for (const conv of enrichedConversations) {
        if (!conv.is_group && conv.participants?.length === 2) {
          const pairKey = conv.participants
            .map(p => p.user_id)
            .sort()
            .join('-');

          if (seenPairs.has(pairKey)) {
            continue; // Skip duplicate (already sorted by updated_at desc)
          }
          seenPairs.add(pairKey);
        }
        deduplicatedConversations.push(conv);
      }

      // Fetch exact unread counts per conversation
      for (const conv of deduplicatedConversations) {
        const lastReadAt = (conv as any)._lastReadAt || '1970-01-01';
        const { count, error: countError } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', user.id)
          .gt('created_at', lastReadAt);

        if (!countError && count) {
          conv.unread_count = count;
        }
        // Clean up internal property
        delete (conv as any)._lastReadAt;
      }

      setConversations(deduplicatedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!user) return;

    try {
      setLoadingMessages(true);

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get sender profiles
      const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', senderIds);

      if (profilesError) throw profilesError;

      // Enrich messages with sender and reply info
      const enrichedMessages = data?.map(msg => {
        const replyMessage = msg.reply_to_id 
          ? data.find(m => m.id === msg.reply_to_id)
          : null;
        return {
          ...msg,
          sender: profiles?.find(p => p.id === msg.sender_id),
          reply_to: replyMessage ? {
            ...replyMessage,
            sender: profiles?.find(p => p.id === replyMessage.sender_id)
          } : null
        };
      }) || [];

      setMessages(enrichedMessages);

      // Mark all incoming messages as delivered for this user
      const incomingMessageIds = (data || [])
        .filter(m => m.sender_id !== user.id)
        .map(m => m.id);
      if (incomingMessageIds.length > 0) {
        await supabase
          .from('message_deliveries')
          .upsert(
            incomingMessageIds.map(message_id => ({ message_id, user_id: user.id })),
            { onConflict: 'message_id,user_id', ignoreDuplicates: true }
          );
      }

      // Load existing deliveries for these messages
      const allMessageIds = (data || []).map(m => m.id);
      if (allMessageIds.length > 0) {
        const { data: deliveryRows } = await supabase
          .from('message_deliveries')
          .select('message_id, user_id')
          .in('message_id', allMessageIds);
        if (deliveryRows) {
          setDeliveries(prev => {
            const next = { ...prev };
            for (const row of deliveryRows) {
              if (!next[row.message_id]) next[row.message_id] = new Set();
              next[row.message_id].add(row.user_id);
            }
            return next;
          });
        }
      }

      // Mark as read
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      // Immediately zero out local unread count for this conversation
      setConversations(prev =>
        prev.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c)
      );

      // Notify other hooks that messages were read
      window.dispatchEvent(new Event('messages-read'));

    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoadingMessages(false);
    }
  }, [user]);

  // Send a message
  const sendMessage = async (conversationId: string, content: string, replyToId?: string) => {
    if (!user || !content.trim()) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim(),
          reply_to_id: replyToId || null
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      // Create notification for other participants
      const conversation = conversations.find(c => c.id === conversationId);
      const otherParticipants = conversation?.participants?.filter(p => p.user_id !== user.id) || [];
      const senderName = user.user_metadata?.full_name || 'Alguém';

      for (const participant of otherParticipants) {
        await supabase
          .from('user_notifications')
          .insert({
            user_id: participant.user_id,
            title: 'Nova mensagem',
            message: `${senderName} enviou uma mensagem`,
            type: 'message',
            action_url: '/mensagens'
          });
      }

      // Trigger Web Push notifications
      supabase.functions.invoke('notify-internal-message', {
        body: {
          messageId: data.id,
          conversationId,
          senderId: user.id,
          content: content.trim(),
        },
      }).catch((err) => console.warn('Push notification failed:', err));

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
      throw error;
    }
  };

  // Create a new conversation
  const createConversation = async (participantIds: string[], name?: string, isGroup = false) => {
    if (!user) return;

    try {
      // Check if 1-1 conversation already exists (DB-level check)
      if (!isGroup && participantIds.length === 1) {
        const targetUserId = participantIds[0];

        // Get all conversations where current user is participant
        const { data: myParticipations } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', user.id);

        if (myParticipations && myParticipations.length > 0) {
          const myConvIds = myParticipations.map(p => p.conversation_id);

          // Find non-group conversations
          const { data: nonGroupConvs } = await supabase
            .from('conversations')
            .select('id, is_group')
            .in('id', myConvIds)
            .eq('is_group', false);

          if (nonGroupConvs) {
            for (const conv of nonGroupConvs) {
              const { data: targetPart } = await supabase
                .from('conversation_participants')
                .select('id')
                .eq('conversation_id', conv.id)
                .eq('user_id', targetUserId)
                .maybeSingle();

              if (targetPart) {
                // Found existing conversation, return it enriched
                const existing = conversations.find(c => c.id === conv.id);
                if (existing) return existing;

                // If not in local state, fetch and return
                const { data: fullConv } = await supabase
                  .from('conversations')
                  .select('*')
                  .eq('id', conv.id)
                  .single();

                await fetchConversations();
                return fullConv;
              }
            }
          }
        }
      }

      // Create conversation
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({
          name: isGroup ? name : null,
          is_group: isGroup,
          created_by: user.id
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add participants (including creator)
      const allParticipants = [user.id, ...participantIds];
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(
          allParticipants.map(uid => ({
            conversation_id: conv.id,
            user_id: uid
          }))
        );

      if (partError) throw partError;

      await fetchConversations();
      return conv;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Erro ao criar conversa');
      throw error;
    }
  };

  // Delete a conversation (for sócios)
  const deleteConversation = async (conversationId: string) => {
    if (!user) return;

    try {
      // First delete all messages
      await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      // Then delete participants
      await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId);

      // Finally delete the conversation
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      toast.success('Conversa excluída');
      setActiveConversation(null);
      await fetchConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Erro ao excluir conversa');
    }
  };

  // Edit a message (only within 5 minutes)
  const editMessage = async (messageId: string, newContent: string) => {
    if (!user || !newContent.trim()) return false;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ 
          content: newContent.trim(),
          is_edited: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) throw error;

      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: newContent.trim(), is_edited: true }
          : msg
      ));

      toast.success('Mensagem editada');
      return true;
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Erro ao editar mensagem');
      return false;
    }
  };

  // Add participants to a group conversation
  const addParticipants = async (conversationId: string, userIds: string[]) => {
    if (!user || userIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('conversation_participants')
        .insert(
          userIds.map(uid => ({
            conversation_id: conversationId,
            user_id: uid
          }))
        );

      if (error) throw error;

      toast.success('Participante(s) adicionado(s)');
      await fetchConversations();
      
      // Refresh active conversation
      if (activeConversation?.id === conversationId) {
        const updated = conversations.find(c => c.id === conversationId);
        if (updated) setActiveConversation(updated);
      }
    } catch (error) {
      console.error('Error adding participants:', error);
      toast.error('Erro ao adicionar participantes');
    }
  };

  // Remove a participant from a group conversation
  const removeParticipant = async (conversationId: string, userId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Participante removido');
      await fetchConversations();
    } catch (error) {
      console.error('Error removing participant:', error);
      toast.error('Erro ao remover participante');
    }
  };

  // Delete a message (for admins/sócios)
  const deleteMessage = async (messageId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      // Update local state
      setMessages(prev => prev.filter(msg => msg.id !== messageId));

      toast.success('Mensagem excluída');
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Erro ao excluir mensagem');
      return false;
    }
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // If it's for the active conversation, add to messages
          if (activeConversation && newMessage.conversation_id === activeConversation.id) {
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', newMessage.sender_id)
              .single();

            setMessages(prev => [...prev, { ...newMessage, sender: senderProfile }]);

            // Mark as read if not my message
            if (newMessage.sender_id !== user.id) {
              await supabase
                .from('conversation_participants')
                .update({ last_read_at: new Date().toISOString() })
                .eq('conversation_id', newMessage.conversation_id)
                .eq('user_id', user.id);
              
              // Notify other hooks that messages were read
              window.dispatchEvent(new Event('messages-read'));
            }
          }

          // Refresh conversations list
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeConversation, fetchConversations]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
    }
  }, [activeConversation, fetchMessages]);

  return {
    conversations,
    loading,
    activeConversation,
    setActiveConversation,
    messages,
    loadingMessages,
    sendMessage,
    createConversation,
    fetchConversations,
    fetchMessages,
    deleteConversation,
    editMessage,
    deleteMessage,
    addParticipants,
    removeParticipant
  };
};
