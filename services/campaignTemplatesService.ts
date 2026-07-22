/**
 * Campaign Templates Service
 * Manages campaign templates for faster campaign creation
 */

import { supabase } from './supabaseClient';

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  templateType: 'system' | 'personal';
  titleFormat: string;
  suggestedDiscount: number;
  discountMin: number;
  discountMax: number;
  launchDayOfWeek: number; // 0=Sunday, 5=Friday
  launchHour: number; // 0-23
  durationDays: number;
  tips: string[];
  successRate: number;
  avgRedemptions: number;
  timesUsed: number;
  lastUsedAt: string | null;
}

export interface TemplatesResponse {
  templates: CampaignTemplate[];
  grouped: Record<string, CampaignTemplate[]>;
  totalCount: number;
  systemCount: number;
  personalCount: number;
}

export interface SaveTemplateRequest {
  merchantId: string;
  templateName: string;
  templateDescription?: string;
  campaignData: {
    title: string;
    deal_offer: string;
    launch_date: string;
    end_date: string;
    category?: string;
  };
}

/**
 * Converts plain text with \n line breaks and • bullets to editor-compatible HTML.
 * Groups consecutive • lines into a <ul> and wraps other lines in <div>.
 */
function textToHtml(text: string): string {
  const lines = text.split('\n');
  let html = '';
  let inList = false;

  for (const line of lines) {
    if (line.startsWith('• ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${line.slice(2)}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += line === '' ? '<div><br></div>' : `<div>${line}</div>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

export const campaignTemplatesService = {
  /**
   * Get all available templates (system + merchant's personal)
   */
  async getTemplates(merchantId: string): Promise<TemplatesResponse | null> {
    try {
      const { data, error } = await supabase.functions.invoke('get-campaign-templates', {
        body: { merchantId },
      });

      if (error) {
        console.error('[campaignTemplatesService] Error fetching templates:', error);
        return null;
      }

      return data as TemplatesResponse;
    } catch (error) {
      console.error('[campaignTemplatesService] Exception:', error);
      return null;
    }
  },

  /**
   * Save a campaign as a template
   */
  async saveTemplate(request: SaveTemplateRequest): Promise<{ success: boolean; templateId?: string; message?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('save-campaign-template', {
        body: request,
      });

      if (error) {
        console.error('[campaignTemplatesService] Error saving template:', error);
        return { success: false, message: 'Unable to process template. Please try again.' };
      }

      return {
        success: true,
        templateId: data.template?.id,
        message: data.message,
      };
    } catch (error) {
      console.error('[campaignTemplatesService] Exception:', error);
      return { success: false, message: 'Failed to save template' };
    }
  },

  /**
   * Track template usage (increment counter)
   */
  async trackUsage(templateId: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('track-template-usage', {
        body: { templateId },
      });

      if (error) {
        console.error('[campaignTemplatesService] Error tracking usage:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[campaignTemplatesService] Exception:', error);
      return false;
    }
  },

  /**
   * Delete a personal template
   */
  async deleteTemplate(templateId: string, merchantId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('delete-campaign-template', {
        body: { templateId, merchantId },
      });

      if (error) {
        console.error('[campaignTemplatesService] Error deleting template:', error);
        return { success: false, message: 'Unable to process template. Please try again.' };
      }

      return { success: true, message: data.message };
    } catch (error) {
      console.error('[campaignTemplatesService] Exception:', error);
      return { success: false, message: 'Failed to delete template' };
    }
  },

  /**
   * Helper: Get next Friday at 6 PM
   */
  getNextFridayAt6PM(): Date {
    const now = new Date();
    const nextFriday = new Date(now);

    // Calculate days until next Friday (5 = Friday)
    const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
    nextFriday.setDate(now.getDate() + daysUntilFriday);

    // Set to 6 PM
    nextFriday.setHours(18, 0, 0, 0);

    return nextFriday;
  },

  /**
   * Helper: Calculate end date given start date and duration
   */
  calculateEndDate(startDate: Date, durationDays: number): Date {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + durationDays);
    return endDate;
  },

  /**
   * Helper: Apply template to form data
   */
  applyTemplate(template: CampaignTemplate, productName?: string): {
    title: string;
    dealOffer: string;
    description: string;
    launchDate: string;
    endDate: string;
    tips: string[];
  } {
    // Generate title
    let title = template.titleFormat;
    if (productName) {
      title = title.replace('{{product}}', productName);
    }
    title = title.replace('{{discount}}', template.suggestedDiscount.toString());

    // Generate deal offer with better format
    // No template percentage in the offer: the % baked into the deal image must
    // come only from the offer/heading the merchant types, never the template's.
    const dealOffer = 'Special Offer on <Your Product/Category>';

    // Generate description based on category
    let description = '';
    switch (template.category) {
      case 'flash-sale':
        description = `🔥 Limited Time Flash Sale!\n\n✨ What You Get:\n• ${template.suggestedDiscount}% discount on selected items\n• Weekend special pricing\n• First come, first served\n\n⏰ Valid for ${template.durationDays} days only!\n\n💡 Don't miss out on this exclusive offer!`;
        break;
      case 'festival':
        description = `🎉 Festival Special Offer!\n\n🎁 Celebrate with Amazing Deals:\n• Flat ${template.suggestedDiscount}% OFF\n• Special festival pricing\n• Perfect time to shop & save\n\n✨ Limited period offer - Grab it now!\n\n🛍️ Make this festival memorable with great savings!`;
        break;
      case 'clearance':
        description = `🏷️ Clearance Sale - Must Go!\n\n💥 Massive Discounts:\n• ${template.suggestedDiscount}% OFF on all items\n• Clear out inventory pricing\n• Limited stock available\n\n⚡ Act fast - While stocks last!\n\n✅ Great quality at unbeatable prices!`;
        break;
      case 'new-launch':
        description = `🆕 New Arrival Launch Offer!\n\n🌟 Be the First:\n• Exclusive ${template.suggestedDiscount}% launch discount\n• Brand new products\n• Limited time introductory offer\n\n🎯 Early bird special pricing!\n\n💫 Get it before everyone else!`;
        break;
      case 'premium':
        description = `👑 Premium Product Exclusive\n\n💎 Luxury at a Great Price:\n• ${template.suggestedDiscount}% OFF on premium items\n• High-quality products\n• Exclusive offer for valued customers\n\n✨ Treat yourself to the best!\n\n🎁 Premium quality, special price!`;
        break;
      default:
        description = `🎯 Special Offer Alert!\n\n✅ Amazing Deal:\n• Get ${template.suggestedDiscount}% OFF\n• Limited time offer\n• Great value for money\n\n⏰ Valid for ${template.durationDays} days!\n\n💰 Save big on your favorite items!`;
    }

    // Calculate dates based on template's day/hour preferences
    const launchDate = new Date();
    const dayDiff = (template.launchDayOfWeek - launchDate.getDay() + 7) % 7 || 7;
    launchDate.setDate(launchDate.getDate() + dayDiff);
    launchDate.setHours(template.launchHour, 0, 0, 0);

    const endDate = this.calculateEndDate(launchDate, template.durationDays);

    return {
      title: title.replace('{{product}}', ''), // Remove placeholder if no product name
      dealOffer,
      description: textToHtml(description),
      launchDate: launchDate.toISOString(),
      endDate: endDate.toISOString(),
      tips: template.tips,
    };
  },
};
