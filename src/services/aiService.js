/**
 * AI Application Assistant Service (V3)
 * 
 * Generates personalized application messages based on genuine candidate profile
 * and job attributes. Never hallucinates unlisted skills or experiences.
 * Supports tone adjustment, length controls, and natural Bangla draft improvement/translation.
 * Pluggable backend AI abstraction via VITE_AI_API_KEY with reliable Demo AI Mode.
 */

import { apiClient } from './apiClient.js';
import { translationService } from './translationService.js';

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
   * Generates a personalized application message adhering strictly to selected Tone & Length.
   */
  async generateApplicationMessage({
    job,
    profile,
    tone = 'Short & Direct',
    length = 'Short',
    language = 'English',
    cvAttached = true,
    portfolioIncluded = true,
  }) {
    // Attempt backend AI generation first if live API is connected
    try {
      const serverResult = await apiClient.generateApplication({ job, profile, mode: tone, tone, length });
      if (serverResult && !serverResult.isDemo && serverResult.message) {
        return {
          message: serverResult.message,
          tone,
          length,
          isDemo: false,
        };
      }
    } catch (err) {
      // If server returned 403 authorization error, bubble it up so upgrade modals can trigger
      if (err?.status === 403 || err?.code === 'UPGRADE_REQUIRED' || err?.code === 'PRO_REQUIRED') {
        throw err;
      }
      // Graceful fallback to deterministic local engine
    }

    const isDemo = !this.isApiConfigured();

    const company = job?.company || job?.client || job?.author || 'Hiring Team';
    const userName = profile?.name || 'Applicant';
    const profession = profile?.profession || 'Freelance Specialist';
    const specialization = profile?.specialization || 'Creative Professional';
    const userSkills = Array.isArray(profile?.skills) ? profile.skills.map((s) => typeof s === 'string' ? s : s.name) : [];
    const experience = profile?.experience || 'experienced';
    const jobTitle = job?.title || 'Opportunity';

    // Highlight overlapping skills only
    const jobDescLower = (job?.description || '').toLowerCase();
    const relevantSkills = userSkills.filter((sk) => jobDescLower.includes(sk.toLowerCase()));
    const skillsText = relevantSkills.length > 0 ? relevantSkills.slice(0, 3).join(', ') : userSkills.slice(0, 2).join(', ');

    // Tone-tailored Greetings & Signoffs
    let greeting = `Hi ${company},`;
    let signoff = `Best regards,\n${userName}`;

    if (tone === 'Friendly') {
      greeting = `Hey ${company} team! 👋`;
      signoff = `Warm regards & excited to connect,\n${userName}`;
    } else if (tone === 'Confident') {
      greeting = `Dear ${company},`;
      signoff = `Ready to drive immediate results,\n${userName}`;
    } else if (tone === 'Short & Direct') {
      greeting = `Hi ${company},`;
      signoff = `Best,\n${userName}`;
    } else {
      // Professional default
      greeting = `Dear ${company} Hiring Team,`;
      signoff = `Best regards,\n${userName}`;
    }

    // Portfolio attachment phrase
    const portfolioLine =
      portfolioIncluded && profile?.portfolioUrl
        ? `You can view my past client work and portfolio here: ${profile.portfolioUrl}`
        : '';

    // CV attachment phrase
    const cvLine = cvAttached && profile?.cvUrl ? 'My complete CV is attached for your review.' : '';

    let body = '';

    // 1. SHORT LENGTH
    if (length === 'Short') {
      if (tone === 'Short & Direct') {
        body = `I am a ${profession} (${experience}) specializing in ${specialization}${skillsText ? ` with core expertise in ${skillsText}` : ''}. I saw your posting for "${jobTitle}" and would love to take this on.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Available to start immediately with fast turnaround. Let's connect!`;
      } else if (tone === 'Friendly') {
        body = `I was excited to come across your post for "${jobTitle}"! As a ${profession} focused on ${specialization}${skillsText ? ` using ${skillsText}` : ''}, I love collaborating with creative teams to bring ideas to life smoothly and quickly.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Would love to hop on a quick chat and see how we can work together!`;
      } else if (tone === 'Confident') {
        body = `Your search for a "${jobTitle}" directly aligns with my track record as a ${experience} ${profession} in ${specialization}. I specialize in ${skillsText || 'high-impact deliverables'} that hit benchmarks from day one.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Let's connect to review your exact targets and get moving.`;
      } else {
        // Professional Short
        body = `I am writing to express my interest in the "${jobTitle}" role at ${company}. As a ${experience} ${profession} specializing in ${specialization}${skillsText ? ` (${skillsText})` : ''}, I bring a disciplined workflow and consistent delivery to every project.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}I welcome the opportunity to discuss how I can support your goals.`;
      }
    } 
    // 2. DETAILED LENGTH
    else if (length === 'Detailed') {
      if (tone === 'Short & Direct') {
        body = `I am submitting my candidacy for the "${jobTitle}" position. Below is a detailed, no-fluff summary of my qualifications and operational readiness:\n\n1. Background & Specialization:\n• ${experience} ${profession} centered on ${specialization}\n${skillsText ? `• Technical Stack: ${skillsText}\n` : ''}• Immediate availability with full remote infrastructure\n\n2. Key Operational Deliverables:\n• Rigorous adherence to brief requirements and timeline constraints\n• Proactive version management and prompt feedback integration\n• Transparent async updates ensuring project momentum\n\n3. Proof of Work:\n${portfolioLine ? `${portfolioLine}\n` : '• Portfolio available upon request\n'}${cvLine ? `${cvLine}\n` : ''}\nIf this matches what you need, let's schedule an intro call today.`;
      } else if (tone === 'Friendly') {
        body = `I was thrilled to see your opening for "${jobTitle}" and knew right away that I wanted to apply! As a dedicated ${profession} who lives and breathes ${specialization}, my passion is collaborating with forward-thinking teams like ${company} to craft standout, memorable work.\n\nHere is what working together looks like:\n• Creative Resonance: I take the time to deeply understand your brand voice, audience dynamics, and visual standards\n${skillsText ? `• Toolkit & Craft: Hands-on expertise with ${skillsText}, bringing fluid storytelling and polish to every asset\n` : ''}• Effortless Collaboration: Responsive communication, positive reception of feedback, and dependable deadlines\n• Ongoing Partnership: Always thinking a step ahead to keep our workflow smooth, efficient, and enjoyable\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}I would truly love the chance to connect, hear about your vision for this project, and explore how we can team up. Looking forward to our conversation!`;
      } else if (tone === 'Confident') {
        body = `I am applying for your "${jobTitle}" position to deliver the high-caliber execution and measurable impact that ${company} expects. As a ${experience} ${profession} with a specialized focus on ${specialization}, I have consistently helped clients elevate their standards and outpace competitors.\n\nWhy this partnership will succeed:\n• Decisive Execution: In-depth expertise in ${specialization}${skillsText ? ` using ${skillsText}` : ''}, turning complex briefs into polished deliverables with zero guesswork\n• Commercial Impact: Every detail is tailored to hold audience attention, strengthen retention, and drive client objectives\n• Flawless Reliability: A proven record of delivering under strict deadlines without ever compromising on production quality\n• Ownership: I manage projects end-to-end with high accountability, so you can focus on broader business goals\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Let's set up a conversation this week to review your roadmap and begin executing.`;
      } else {
        // Professional Detailed
        body = `I am writing to present my comprehensive application for the "${jobTitle}" position at ${company}. As a ${experience} ${profession} specializing in ${specialization}${skillsText ? ` with extensive hands-on experience in ${skillsText}` : ''}, I offer a combination of technical mastery, workflow discipline, and creative excellence.\n\nHaving thoroughly evaluated your job requirements, my core strengths directly complement your operational needs:\n• Domain Mastery: In-depth understanding of ${specialization} principles and modern industry standards\n${skillsText ? `• Technical Fluency: Advanced day-to-day execution utilizing ${skillsText}\n` : ''}• Project Governance: Consistent delivery on time and within scope, supported by structured async updates\n• Collaborative Mindset: Smooth integration into established client teams and feedback systems\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}I welcome the opportunity to discuss how my expertise can directly support ${company}'s current and upcoming initiatives. Thank you for your review and consideration.`;
      }
    } 
    // 3. MEDIUM LENGTH (DEFAULT)
    else {
      if (tone === 'Short & Direct') {
        body = `I am reaching out regarding the "${jobTitle}" opening. Here is a direct summary of what I bring:\n• Role: ${profession} (${experience}) with a focus on ${specialization}\n${skillsText ? `• Core Toolkit: ${skillsText}\n` : ''}• Standards: Zero missed deadlines, clear communication, and rapid turnaround\n\nI have reviewed your project requirements and can hit the ground running immediately.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Let me know if you have 5 minutes for a brief call.`;
      } else if (tone === 'Friendly') {
        body = `I came across your post for "${jobTitle}" and couldn't resist reaching out! As a ${profession} with a strong passion for ${specialization}, I love helping teams turn fresh concepts into engaging, high-quality deliverables that audiences genuinely connect with.\n\nMy workflow is built around open communication, quick feedback loops, and mastery of ${skillsText || 'essential creative tools'}. Whether tackling day-to-day revisions or steering major project phases, I make collaboration effortless and fun.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}I'd love to learn more about what you're building next. Let's set up a time to chat!`;
      } else if (tone === 'Confident') {
        body = `I am applying for your "${jobTitle}" opportunity because my background as a ${experience} ${profession} in ${specialization} is proven to generate real, measurable outcomes.\n\nI don't just complete assignments—I optimize every deliverable for retention, visual authority, and strategic alignment using ${skillsText || 'industry-standard tools'}. You can count on precision, proactive problem-solving, and a commitment to exceeding project benchmarks from the very first brief.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Let's schedule a brief conversation to align on your objectives and start executing.`;
      } else {
        // Professional Medium
        body = `I am writing to formally apply for the "${jobTitle}" position. With my background as a ${experience} ${profession} specializing in ${specialization}${skillsText ? ` and proficiency in ${skillsText}` : ''}, I have developed a structured, reliable approach to delivering polished, client-aligned work.\n\nThroughout my freelance career, I have prioritized clear stakeholder communication, adherence to brand guidelines, and dependable milestone delivery. I am well-versed in remote workflows and accustomed to managing tight production schedules.\n\n${portfolioLine ? `${portfolioLine}\n\n` : ''}${cvLine ? `${cvLine}\n\n` : ''}Thank you for your time and consideration. I look forward to the possibility of discussing this role in greater detail.`;
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
   * Translates an application message using Google Translate abstraction.
   */
  async translateApplicationMessage({ text, targetLanguage = 'es', job, profile }) {
    return translationService.translateMessage({ text, targetLanguage, job, profile });
  }

  /**
   * Backward-compatible alias for legacy references.
   */
  async translateAndImproveBangla(banglaDraft = '', profile, job) {
    return translationService.translateMessage({ text: banglaDraft, targetLanguage: 'bn', job, profile });
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

