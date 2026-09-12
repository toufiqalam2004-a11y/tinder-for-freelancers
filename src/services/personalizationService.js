/**
 * Personalization Service (V5)
 * 
 * Crafts bespoke, high-signal outreach messages and follow-up sequences.
 * Sections:
 * - Subject
 * - Opening
 * - Value Proposition
 * - Relevant Experience
 * - Portfolio Link
 * - Call to Action (CTA)
 * - Signature
 * 
 * Never generates aggressive or generic spam.
 */

export class PersonalizationService {
  /**
   * Generates a multi-section personalized outreach proposal.
   */
  generateOutreach({ lead = {}, profile = {}, tone = 'Professional', method = 'email' }) {
    const clientName = lead.name && lead.name !== 'Hiring Lead' ? lead.name : (lead.company || 'there');
    const userName = profile?.name || 'Toufiq';
    const profession = profile?.primaryRole || profile?.profession || 'Video Editor';
    const specialization = profile?.specialization || 'YouTube & Short-Form Content';
    const portfolioUrl = profile?.portfolioUrl || (profile?.portfolioLinks && profile.portfolioLinks[0]?.url) || 'https://toufiq.in';
    const yearsExp = profile?.yearsOfExperience || 3;

    // Distinct Tones
    let subject = '';
    let opening = '';
    let valueProp = '';
    let relevantExp = '';
    let cta = 'Would you be open to a quick 10-minute conversation this week?';
    let signature = `Best regards,\n${userName}\n${profession}`;

    if (tone === 'Friendly') {
      subject = `Quick note regarding ${lead.title || 'your video project'}`;
      opening = `Hi ${clientName}! Hope you're having a great week. I came across your post about ${lead.title || 'needing an editor'} and wanted to reach out.`;
      valueProp = `I specialize in ${specialization} and focus on clean cuts, high-retention pacing, and helping creators deliver consistently without the editing bottleneck.`;
      relevantExp = `I've been editing for over ${yearsExp} years, primarily working with fast-growing channels and founders.`;
      cta = 'I’d love to see if I can take some editing off your plate. Would you be open to chatting briefly?';
      signature = `Cheers,\n${userName}`;
    } else if (tone === 'Confident') {
      subject = `Delivering top-tier editing for ${lead.company || lead.title}`;
      opening = `Hi ${clientName},\n\nI reviewed your post for "${lead.title}". As a dedicated ${profession}, this is right down my alley.`;
      valueProp = `My focus is strictly on quality and retention: dynamic storytelling, clean audio design, and smooth motion graphics that keep viewers engaged.`;
      relevantExp = `With ${yearsExp}+ years of dedicated experience in ${specialization}, I can step in and handle your pipeline smoothly from day one.`;
      cta = 'Let’s connect for a brief 10-minute intro call to discuss your upcoming videos.';
      signature = `Best,\n${userName}\n${profession}`;
    } else if (tone === 'Short & Direct') {
      subject = `Freelance ${profession} for ${lead.title}`;
      opening = `Hi ${clientName}, saw your post regarding "${lead.title}".`;
      valueProp = `I’m a ${profession} specializing in ${specialization}. Fast turnaround, clean pacing, zero fluff.`;
      relevantExp = `${yearsExp} years experience.`;
      cta = 'Would you be open to a quick chat?';
      signature = `Thanks,\n${userName}`;
    } else if (tone === 'Casual') {
      subject = `Hey ${clientName} — editor for your videos`;
      opening = `Hey ${clientName}! Saw your post looking for help with ${lead.title || 'editing'}.`;
      valueProp = `I do a lot of work with ${specialization} and love helping clients level up their video style and retention.`;
      relevantExp = `Been in the editing space for around ${yearsExp} years now.`;
      cta = 'Let me know if you want to hop on a quick call or chat over messages!';
      signature = `Best,\n${userName}`;
    } else {
      // Professional (Default)
      subject = `Regarding your ${lead.title || 'opportunity'} — ${profession} support`;
      opening = `Hi ${clientName},\n\nI am reaching out regarding your posting for "${lead.title}". I am a ${profession} specializing in ${specialization}.`;
      valueProp = `I help clients and creators achieve engaging, polished video output with strong narrative pacing, clean color and audio, and dependable turnaround.`;
      relevantExp = `I have ${yearsExp}+ years of practical industry experience and have managed complete video production workflows.`;
      cta = 'Would you be open to a quick 10-minute call this week to see if we might be a good fit?';
      signature = `Best regards,\n${userName}\n${profession}`;
    }

    const portfolioSection = portfolioUrl ? `You can check out my recent work and showreel here: ${portfolioUrl}` : '';

    const fullBody = `${opening}\n\n${valueProp}\n\n${relevantExp}\n\n${portfolioSection ? `${portfolioSection}\n\n` : ''}${cta}\n\n${signature}`;

    return {
      subject,
      opening,
      valueProposition: valueProp,
      relevantExperience: relevantExp,
      portfolio: portfolioSection,
      cta,
      signature,
      fullBody,
    };
  }

  /**
   * Generates a non-spammy, high-value follow-up reminder.
   */
  generateFollowUp({ lead = {}, previousMessage = '', followUpNumber = 1, profile = {} }) {
    const clientName = lead.name && lead.name !== 'Hiring Lead' ? lead.name : (lead.company || 'there');
    const userName = profile?.name || 'Toufiq';
    const profession = profile?.primaryRole || profile?.profession || 'Video Editor';
    const portfolioUrl = profile?.portfolioUrl || (profile?.portfolioLinks && profile.portfolioLinks[0]?.url) || 'https://toufiq.in';

    if (followUpNumber === 1) {
      return {
        subject: `Following up: ${lead.title || 'Video project'}`,
        fullBody: `Hi ${clientName},\n\nHope your week is going well!\n\nJust following up on my previous message regarding "${lead.title}". I know schedules get busy, so I wanted to quickly bump this to the top of your inbox.\n\nI have immediate capacity to take on a test project or discuss your editing needs.\n\n${portfolioUrl ? `Recent work: ${portfolioUrl}\n\n` : ''}Let me know if you have 5 minutes to connect!\n\nBest,\n${userName}`,
      };
    }

    // Follow-up 2 (Polite final check-in)
    return {
      subject: `Final check-in: ${lead.title || 'Video Editing'}`,
      fullBody: `Hi ${clientName},\n\nI know you're likely swamped, so this will be my last note.\n\nIf you've already found someone for ${lead.title || 'the project'}, no problem at all! If you ever need dependable ${profession} support down the road, feel free to keep my details on hand.\n\n${portfolioUrl ? `Portfolio: ${portfolioUrl}\n\n` : ''}Wishing you the best with your channel and content!\n\nBest regards,\n${userName}`,
    };
  }
}

export const personalizationService = new PersonalizationService();
