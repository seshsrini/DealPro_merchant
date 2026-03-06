/**
 * AI Assistant Service
 * Handles conversational AI queries for merchants
 */

import { supabase } from './supabaseClient';

export interface AssistantResponse {
  message: string;
  suggestions?: string[];
  actionButton?: {
    text: string;
    route: string;
  };
  data?: any;
}

export const aiAssistantService = {
  /**
   * Send a query to the AI assistant and get a response
   */
  async sendQuery(merchantId: string, query: string): Promise<AssistantResponse | null> {
    try {
      const { data, error } = await supabase.functions.invoke('get-ai-assistant-response', {
        body: { merchantId, query },
      });

      if (error) throw new Error('Unable to get AI response. Please try again.');

      return data?.response || null;
    } catch (error) {
      console.error('[aiAssistantService] Error sending query:', error);
      return null;
    }
  },
};
