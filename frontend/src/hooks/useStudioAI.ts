import { useState, useCallback, useRef } from 'react';
import { StudioModel, type StudioAction } from '../models/StudioModels';

// Parse <studio-actions>...</studio-actions> from AI reply
function parseStudioActions(reply: string): { cleanReply: string; actions: StudioAction[] } {
  const match = reply.match(/<studio-actions>([\s\S]*?)<\/studio-actions>/);
  if (!match) return { cleanReply: reply, actions: [] };

  const cleanReply = reply.replace(/<studio-actions>[\s\S]*?<\/studio-actions>/, '').trim();
  try {
    const actions = JSON.parse(match[1]) as StudioAction[];
    return { cleanReply, actions };
  } catch {
    return { cleanReply: reply, actions: [] };
  }
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: StudioAction[];
  toolsUsed?: string[];
  timestamp: Date;
}

// Re-export as alias used by components
export type StudioChatMessage = AIChatMessage;

export function useStudioAI() {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [assistantId, setAssistantId] = useState<string | undefined>();
  const [pendingActions, setPendingActions] = useState<StudioAction[]>([]);
  const msgCounter = useRef(0);

  const sendMessage = useCallback(async (
    text: string,
    context?: {
      siteId?: string;
      selectedComponent?: string | { id: string; type: string; html: string; css: string };
      viewport?: 'desktop' | 'tablet' | 'mobile';
      siteContext?: { businessName: string; industry: string; colorPalette: string[]; pageCount: number; currentPageType: string };
    }
  ) => {
    const userMsg: AIChatMessage = {
      id: `msg-${++msgCounter.current}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const selectedComp = typeof context?.selectedComponent === 'string'
        ? { id: context.selectedComponent, type: 'element', html: '', css: '' }
        : context?.selectedComponent;

      const res = await StudioModel.sendStudioIntent({
        text,
        assistantId,
        conversationId,
        siteId: context?.siteId,
        selectedComponent: selectedComp,
        viewport: context?.viewport,
        siteContext: context?.siteContext,
      });

      setConversationId(res.conversationId);

      const { cleanReply, actions } = parseStudioActions(res.reply);

      const assistantMsg: AIChatMessage = {
        id: `msg-${++msgCounter.current}`,
        role: 'assistant',
        content: cleanReply,
        actions,
        toolsUsed: res.toolsUsed,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (actions.length > 0) {
        setPendingActions(prev => [...prev, ...actions.filter(a => a.requiresApproval)]);
      }

      return { reply: cleanReply, actions };
    } catch (err) {
      const errorMsg: AIChatMessage = {
        id: `msg-${++msgCounter.current}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
      return { reply: errorMsg.content, actions: [] };
    } finally {
      setLoading(false);
    }
  }, [assistantId, conversationId]);

  const approveAction = useCallback((indexOrAction: number | StudioAction) => {
    if (typeof indexOrAction === 'number') {
      const action = pendingActions[indexOrAction];
      setPendingActions(prev => prev.filter((_, i) => i !== indexOrAction));
      return action;
    }
    setPendingActions(prev => prev.filter(a => a !== indexOrAction));
    return indexOrAction;
  }, [pendingActions]);

  const rejectAction = useCallback((indexOrAction: number | StudioAction) => {
    if (typeof indexOrAction === 'number') {
      setPendingActions(prev => prev.filter((_, i) => i !== indexOrAction));
    } else {
      setPendingActions(prev => prev.filter(a => a !== indexOrAction));
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setPendingActions([]);
  }, []);

  return {
    messages, loading, conversationId, pendingActions,
    sendMessage, approveAction, rejectAction, clearChat,
    setAssistantId,
  };
}
