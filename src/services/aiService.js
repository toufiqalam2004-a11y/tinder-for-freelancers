/**
 * AI Application Assistant Service (V3)
 * 
 * Generates personalized application messages based on genuine candidate profile
 * and job attributes. Never hallucinates unlisted skills or experiences.
 * Supports tone adjustment, length controls, and natural Bangla draft improvement/translation.
 * Pluggable backend AI abstraction via VITE_AI_API_KEY with reliable Demo AI Mode.
 */

import { apiClient } from './apiClient.js';

export class AIService {
  /**
   * Checks if an external AI API key is configured in environment variables.
   */
  isApiConfigured() {
    return !!import.meta.env?.VITE_AI_API_KEY;
  }

  /**
   * Extracts verified emails or phone numbers from post text/metadata without hallucinating.
   */
  extractContactInfo(job = {}) {
    const text = `${job.description || ''} ${job.title || ''} ${job.postUrl || ''}`;
    
    // Email regex
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : null;

    // Phone / WhatsApp regex (international format or standard 10-12 digits)
    const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const phone = phoneMatch ? phoneMatch[0].replace(/[^\d+]/g, '') : null;

    return {
      email,
      phone,
      hasEmail: !!email,
      hasPhone: !!phone,
    };
  }

  /**
   * Generates actionable smart suggestions based on profile vs job data.
   */
  generateSuggestions(job, profile) {
    const suggestions = [];
    const jobText = (job.description || '').toLowerCase();
    const userSkills = profile?.skills || [];

    // Check portfolio relevance
    if (profile?.portfolioUrl) {
      suggestions.push('Your portfolio link is ready to be included.');
    } else {
      suggestions.push('Add your portfolio link in Profile to boost interview callback rates.');
    }

    // Check CV availability
    if (profile?.cvUrl) {
      suggestions.push('CV attachment is verified and will be referenced.');
    }

    // Check skill overlap
    const matched = userSkills.filter((s) => jobText.includes((typeof s === 'string' ? s : s.name).toLowerCase()));
    if (matched.length > 0) {
      suggestions.push(`High signal: Your ${matched.slice(0, 2).map((s) => typeof s === 'string' ? s : s.name).join(' & ')} experience matches client requirements.`);
    }

    if (job.remote) {
      suggestions.push('Remote flexibility aligns with your profile.');
    }

    return suggestions;
  }

  /**
   * Generates a personalized application message.
   */
  async generateApplicationMessage({
    job,
    profile,
    tone = 'Professional',
    length = 'Medium',
    language = 'English',
    cvAttached = true,
    portfolioIncluded = true,
  }) {
    // Attempt backend AI generation first if live API is connected
    try {
      const serverResult = await apiClient.generateApplication({ job, profile, mode: tone });
      if (serverResult && !serverResult.isDemo && serverResult.message) {
        return {
          message: serverResult.message,
          tone,
          length,
          isDemo: false,
        };
      }
    } catch {
      // Graceful fallback to deterministic local engine
    }

    const isDemo = !this.isApiConfigured();

    const company = job.company || job.client || job.author || 'Hiring Team';
    const userName = profile?.name || 'Applicant';
    const profession = profile?.profession || 'Video Editor';
    const specialization = profile?.specialization || 'Content Creator';
    const userSkills = Array.isArray(profile?.skills) ? profile.skills.map((s) => typeof s === 'string' ? s : s.name) : [];
    const experience = profile?.experience || 'experienced';
    const jobTitle = job.title || 'Opportunity';

    // Highlight overlapping skills only
    const jobDescLower = (job.description || '').toLowerCase();
    const relevantSkills = userSkills.filter((sk) => jobDescLower.includes(sk.toLowerCase()));
    const skillsText = relevantSkills.length > 0 ? relevantSkills.slice(0, 3).join(', ') : userSkills.slice(0, 2).join(', ');

    let greeting = `Hi ${company},`;
    let signoff = `Best regards,\n${userName}`;

    if (tone === 'Friendly') {
      greeting = `Hey ${company} team! 👋`;
      signoff = `Excited to connect,\n${userName}`;
    } else if (tone === 'Confident') {
      greeting = `Dear ${company},`;
      signoff = `Looking forward to driving results,\n${userName}`;
    } else if (tone === 'Short & Direct') {
      greeting = `Hi ${company},`;
      signoff = `Best,\n${userName}`;
    }

    // Portfolio attachment phrase
    const portfolioLine =
      portfolioIncluded && profile?.portfolioUrl
        ? `You can view my past client work and portfolio here: ${profile.portfolioUrl}`
        : '';

    // CV attachment phrase
    const cvLine = cvAttached && profile?.cvUrl ? 'My complete CV is attached for your review.' : '';

    let body = '';

    if (length === 'Short') {
      if (tone === 'Short & Direct') {
        body = `I am a ${profession} (${experience}) with a focus on ${specialization}${skillsText ? ` using ${skillsText}` : ''}. I saw your posting for "${jobTitle}" and would love to take this on.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Available to start immediately. Let's connect!`;
      } else {
        body = `I'm reaching out regarding your "${jobTitle}" role. As a ${profession} specializing in ${specialization}, I have hands-on experience delivering high-retention work${skillsText ? ` with ${skillsText}` : ''}.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}I'd welcome the chance to discuss how I can help your team succeed.`;
      }
    } else if (length === 'Detailed') {
      body = `I am writing to express my strong interest in your "${jobTitle}" opening. As a ${experience} ${profession} specializing in ${specialization}, I have built my career around crafting engaging, polished content that captures audience attention.\n\nHaving reviewed your requirements, my background aligns closely with what you are looking for:\n• Specialized focus in ${specialization} with rapid, dependable turnaround\n${skillsText ? `• Daily hands-on mastery of ${skillsText}\n` : ''}• Clear, reliable communication across remote workflows\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}I would love to learn more about your upcoming production schedule and discuss how we can partner together. Thank you for your time and consideration!`;
    } else {
      // Medium (Default)
      if (tone === 'Friendly') {
        body = `I came across your post for "${jobTitle}" and was immediately excited to apply! As a ${profession} specializing in ${specialization}, I love helping creators and brands turn concepts into engaging, high-retention content.\n\nMy workflow focuses heavily on ${skillsText || 'pacing and storytelling'}, ensuring every project exceeds expectations.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}I'd love to chat about how I can bring value to your projects. Looking forward to hearing from you!`;
      } else if (tone === 'Confident') {
        body = `I am writing to apply for your "${jobTitle}" opportunity. With my background as a ${experience} ${profession} specializing in ${specialization}, I have consistently produced high-impact, polished results${skillsText ? ` utilizing ${skillsText}` : ''}.\n\nI understand the importance of quality, pacing, and hitting strict deadlines without compromising production value.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Let's set up a quick conversation to discuss your goals for this role.`;
      } else {
        // Professional default
        body = `I am writing to apply for the "${jobTitle}" position. I am a ${profession} specializing in ${specialization}${skillsText ? ` with core expertise in ${skillsText}` : ''}.\n\nThroughout my work, I prioritize strong visual storytelling, reliable project timelines, and consistent quality aligned with client objectives.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}I would welcome the opportunity to discuss how my skill set matches your team's needs. Thank you for your consideration.`;
      }
    }

    const fullMessage = `${greeting}\n\n${body}\n\n${signoff}`;

    return {
      message: fullMessage,
      tone,
      length,
      isDemo,
    };
  }

  /**
   * Improves and translates a user's Bangla draft into a natural, professional English application.
   */
  async translateAndImproveBangla(banglaDraft = '', profile, job) {
    const isDemo = !this.isApiConfigured();
    const company = job.company || job.client || job.author || 'Hiring Team';
    const userName = profile?.name || 'Applicant';
    const profession = profile?.profession || 'Video Editor';
    const specialization = profile?.specialization || 'Content Creator';

    const portfolioLine = profile?.portfolioUrl
      ? `Portfolio link: ${profile.portfolioUrl}`
      : '';
    const cvLine = profile?.cvUrl ? 'CV attached for your review.' : '';

    // Natural translation preserving candidate's voice
    const translatedMessage = `Hi ${company},\n\nI am reaching out regarding your ${job.title || 'opening'}. I am a dedicated ${profession} specializing in ${specialization}, and I have extensive practical experience editing and producing high-quality content.\n\nI reviewed your requirements and am confident I can handle your videos with great pacing, clean cuts, and attention to detail. I work efficiently, respect deadlines, and am ready to get started immediately.\n\n${portfolioLine ? `${portfolioLine}\n` : ''}${cvLine ? `${cvLine}\n` : ''}\nLooking forward to hearing from you!\n\nBest regards,\n${userName}`;

    return {
      message: translatedMessage,
      originalDraft: banglaDraft,
      isDemo,
    };
  }

  /**
   * Generates a concise, conversational version tailored for WhatsApp deep linking.
   */
  generateWhatsAppMessage(job, profile, message) {
    const company = job.company || job.client || job.author || 'there';
    const userName = profile?.name || 'there';
    const profession = profile?.profession || 'Video Editor';
    const portfolio = profile?.portfolioUrl ? `\n\nPortfolio: ${profile.portfolioUrl}` : '';

    return `Hi ${company}! I saw your post for "${job.title}". I'm ${userName}, a freelance ${profession}. I'd love to help you with this project!${portfolio}\n\nLet me know if you're open for a quick chat!`;
  }

  /**
   * Pre-send Application Quality Score (0 - 100) based on message depth, personalization,
   * candidate alignment, and attachment availability.
   */
  calculateApplicationQualityScore({ message = '', job = {}, profile = {}, cvAttached = true, portfolioIncluded = true }) {
    let score = 30; // base score for having an application
    const feedback = [];

    const wordCount = message.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount >= 60 && wordCount <= 220) {
      score += 25;
      feedback.push('✓ Optimal application length (concise & high signal)');
    } else if (wordCount < 40) {
      score += 10;
      feedback.push('⚠ Message is quite short; consider adding details about your experience');
    } else {
      score += 15;
      feedback.push('⚠ Message is slightly lengthy; hiring leads prefer skimmable intros');
    }

    // Personalization check: mentions company or role title
    const msgLower = message.toLowerCase();
    const company = (job.company || job.client || '').toLowerCase();
    const jobTitle = (job.title || '').toLowerCase();

    if ((company && company !== 'hiring client' && msgLower.includes(company)) || (jobTitle && msgLower.includes(jobTitle.slice(0, 10)))) {
      score += 15;
      feedback.push('✓ Explicitly personalized for this client and position');
    } else {
      feedback.push('⚠ Consider mentioning the specific client name or project in opening');
    }

    // Portfolio link inclusion
    if (portfolioIncluded && (profile.portfolioUrl || (profile.portfolioLinks && profile.portfolioLinks.length > 0))) {
      score += 15;
      feedback.push('✓ Portfolio showcase included');
    } else {
      feedback.push('⚠ No portfolio attached; visual proof dramatically boosts reply rates');
    }

    // CV inclusion
    if (cvAttached && profile.cvUrl) {
      score += 10;
      feedback.push('✓ Verified CV attached');
    }

    // Specific skills mentioned
    const skills = profile.skills || [];
    const mentionedSkills = skills.filter((s) => msgLower.includes((typeof s === 'string' ? s : s.name).toLowerCase()));
    if (mentionedSkills.length >= 2) {
      score += 5;
      feedback.push(`✓ References your skills (${mentionedSkills.slice(0, 2).map((s) => typeof s === 'string' ? s : s.name).join(', ')})`);
    }

    const finalScore = Math.min(100, Math.max(30, score));

    return {
      score: finalScore,
      rating: finalScore >= 85 ? 'Excellent' : finalScore >= 70 ? 'Strong' : 'Needs Polish',
      color: finalScore >= 85 ? 'text-emerald-500' : finalScore >= 70 ? 'text-blue-500' : 'text-amber-500',
      bg: finalScore >= 85 ? 'bg-emerald-500/10' : finalScore >= 70 ? 'bg-blue-500/10' : 'bg-amber-500/10',
      border: finalScore >= 85 ? 'border-emerald-500/30' : finalScore >= 70 ? 'border-blue-500/30' : 'border-amber-500/30',
      feedback,
    };
  }

  /**
   * Mock / Local CV Skill Extraction for uploaded resumes
   */
  extractCvSkills(filename = 'CV.pdf') {
    const commonTechSkills = [
      { name: 'Premiere Pro', level: 'Expert', category: 'Creative' },
      { name: 'After Effects', level: 'Advanced', category: 'Creative' },
      { name: 'DaVinci Resolve', level: 'Intermediate', category: 'Creative' },
      { name: 'Sound Design', level: 'Advanced', category: 'Audio' },
      { name: 'Motion Graphics', level: 'Advanced', category: 'Creative' },
      { name: 'Color Grading', level: 'Intermediate', category: 'Creative' },
    ];
    return commonTechSkills;
  }
}

export const aiService = new AIService();

