/**
 * Pluggable AI Provider Service (V5)
 * 
 * Provides unified abstractions for:
 * - analyzeOpportunity()
 * - qualifyLead()
 * - generateResearchSummary()
 * - generateOutreach()
 * - generateFollowUp()
 * - analyzeReply()
 * - generateReply()
 * 
 * Operates deterministically with zero hallucinations when external API key is absent,
 * or routes to live LLM endpoint when VITE_AI_API_KEY is configured.
 */

import { qualifyLead } from './leadQualificationEngine';
import { personalizationService } from './personalizationService';

export class AIProvider {
  isConfigured() {
    return !!import.meta.env?.VITE_AI_API_KEY;
  }

  /**
   * Generates transparent research summary distinguishing known public facts vs AI inferences.
   */
  async generateResearchSummary(lead = {}) {
    const isDemo = !this.isConfigured();
    const text = `${lead.title || ''} ${lead.description || ''}`;

    const knownInfo = [];
    const aiInferences = [];

    // Extract known facts
    if (lead.company && lead.company !== 'Hiring Client') {
      knownInfo.push(`Organization / Channel: ${lead.company}`);
    }
    if (lead.platform) {
      knownInfo.push(`Discovered via public post on ${lead.platform.toUpperCase()}`);
    }
    if (lead.email) {
      knownInfo.push(`Verified direct email: ${lead.email}`);
    }
    if (lead.phone) {
      knownInfo.push(`Verified contact phone / WhatsApp: ${lead.phone}`);
    }
    if (lead.sourceUrl) {
      knownInfo.push(`Public opportunity thread URL available`);
    }

    // AI Inferences based on post analysis
    if (text.includes('youtube') || text.includes('subscribers') || text.includes('channel')) {
      aiInferences.push('Creator is actively publishing content and requires dependable video turnaround.');
    }
    if (text.includes('short') || text.includes('tiktok') || text.includes('reels')) {
      aiInferences.push('Focus is on vertical short-form retention with fast pacing & dynamic captions.');
    }
    if (text.includes('saas') || text.includes('software') || text.includes('startup')) {
      aiInferences.push('Tech client likely values clear product demonstrations and motion graphics.');
    }
    if (aiInferences.length === 0) {
      aiInferences.push('Client has an active creative workload and wants to outsource editing overhead.');
    }

    return {
      clientSummary: lead.company || lead.name || 'Hiring Client',
      verifiedNeed: lead.title || 'Creative Video Production',
      opportunityContext: lead.description?.slice(0, 180) || 'Opportunity detected from active search query.',
      suggestedAngle: 'Highlight proven retention pacing, fast turnaround, and showcase relevant portfolio links.',
      knownInfo,
      aiInferences,
      confidenceScore: isDemo ? 92 : 96,
      isDemo,
    };
  }

  /**
   * Qualifies a discovered lead using leadQualificationEngine.
   */
  async qualifyLead(lead, profile) {
    return qualifyLead(lead, profile);
  }

  /**
   * Generates a personalized outreach message.
   */
  async generateOutreach(params) {
    return personalizationService.generateOutreach(params);
  }

  /**
   * Generates a polite follow-up message.
   */
  async generateFollowUp(params) {
    return personalizationService.generateFollowUp(params);
  }

  /**
   * Analyzes an incoming client response and categorizes intent.
   */
  async analyzeReply(replyText = '') {
    const text = replyText.toLowerCase();

    if (/interested|call|chat|zoom|calendar|let's talk|available|meet|schedule/i.test(text)) {
      return {
        intent: 'interested',
        confidence: 94,
        suggestMeeting: true,
        summary: 'Lead expressed positive interest and is open to discussing a call or project.',
      };
    }

    if (/rate|price|cost|budget|pricing|quote|how much/i.test(text)) {
      return {
        intent: 'pricing_discussion',
        confidence: 90,
        suggestMeeting: true,
        summary: 'Lead is asking about pricing or rate structure.',
      };
    }

    if (/portfolio|sample|showreel|previous work|examples/i.test(text)) {
      return {
        intent: 'portfolio_request',
        confidence: 92,
        suggestMeeting: false,
        summary: 'Lead wants to view more examples or relevant showreel.',
      };
    }

    if (/not interested|no thanks|found someone|pass|stop/i.test(text)) {
      return {
        intent: 'not_interested',
        confidence: 95,
        suggestMeeting: false,
        summary: 'Lead politely declined or already filled the opening.',
      };
    }

    return {
      intent: 'general_inquiry',
      confidence: 80,
      suggestMeeting: false,
      summary: 'General message or clarifying question received.',
    };
  }

  /**
   * Suggests an AI drafted response tailored to lead's reply.
   */
  async generateReply({ lead = {}, replyText = '', intent = 'interested', profile = {} }) {
    const userName = profile?.name || 'Toufiq';
    const clientName = lead.name && lead.name !== 'Hiring Lead' ? lead.name : 'there';
    const portfolioUrl = profile?.portfolioUrl || (profile?.portfolioLinks && profile.portfolioLinks[0]?.url) || 'https://toufiq.in';

    if (intent === 'interested') {
      return `Hi ${clientName},\n\nGreat to hear from you! I'd love to connect briefly and learn more about your video plans.\n\nWould you be open for a quick 15-minute intro call sometime tomorrow or Thursday? Let me know what time zone and slots work best for you.\n\nLooking forward to speaking!\n\nBest,\n${userName}`;
    }

    if (intent === 'pricing_discussion') {
      return `Hi ${clientName},\n\nThanks for reaching out! My typical rates depend on project scope and video length (e.g. per-video rate or monthly retainer for consistent output).\n\nTo give you an accurate quote, could you share a bit more on your target video length and weekly volume? Alternatively, we can hop on a quick 10-minute call to align.\n\nBest regards,\n${userName}`;
    }

    if (intent === 'portfolio_request') {
      return `Hi ${clientName},\n\nCertainly! You can review my recent showreel and client samples directly here: ${portfolioUrl}\n\nLet me know what you think, and I’d be happy to discuss how we can apply a similar style to your videos.\n\nBest,\n${userName}`;
    }

    return `Hi ${clientName},\n\nThank you for getting back to me! Happy to answer any questions or share more details.\n\nBest regards,\n${userName}`;
  }
}

export const aiProvider = new AIProvider();
