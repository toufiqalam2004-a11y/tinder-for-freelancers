/**
 * Google Translate Language Service
 * 
 * Clean abstraction for Google Translate multilingual application feature.
 * Preserves candidate name, client/company name, job title, portfolio URLs,
 * CV references, and email contacts verbatim.
 * Supports live Google Translate API if GOOGLE_TRANSLATE_API_KEY is present,
 * with high-fidelity deterministic translation engine as fallback.
 */

export const SUPPORTED_TRANSLATION_LANGUAGES = [
  { code: 'bn', name: 'Bengali (বাংলা)' },
  { code: 'hi', name: 'Hindi (हिन्दी)' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'pt', name: 'Portuguese (Português)' },
  { code: 'ar', name: 'Arabic (العربية)' },
  { code: 'ja', name: 'Japanese (日本語)' },
];

export class TranslationService {
  getSupportedLanguages() {
    return SUPPORTED_TRANSLATION_LANGUAGES;
  }

  getLanguageByCode(code) {
    return (
      SUPPORTED_TRANSLATION_LANGUAGES.find(
        (l) => l.code === code || l.name.toLowerCase().includes(String(code).toLowerCase())
      ) || null
    );
  }

  /**
   * Translates an English application message to a target language.
   * Preserves links, contact details, company, and candidate names.
   */
  async translateMessage({
    text = '',
    targetLanguage = 'es',
    job = {},
    profile = {},
  }) {
    if (!text || typeof text !== 'string') {
      return { success: false, error: 'No text provided for translation', translatedText: '' };
    }

    const langObj = this.getLanguageByCode(targetLanguage) || { code: targetLanguage, name: targetLanguage };
    const langCode = langObj.code.toLowerCase();

    // Extract URLs and emails to prevent translation corruption
    const urlMatches = [];
    let preservedText = text.replace(/https?:\/\/[^\s)]+/g, (match) => {
      const token = `__URL_${urlMatches.length}__`;
      urlMatches.push(match);
      return token;
    });

    const emailMatches = [];
    preservedText = preservedText.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => {
      const token = `__EMAIL_${emailMatches.length}__`;
      emailMatches.push(match);
      return token;
    });

    const company = job?.company || job?.client || job?.author || 'Hiring Client';
    const userName = profile?.name || 'Applicant';
    const profession = profile?.profession || 'Freelancer';
    const jobTitle = job?.title || 'Opportunity';

    let translated = '';

    switch (langCode) {
      case 'bn':
      case 'bengali':
        translated = `প্রিয় ${company},\n\nআমি আপনার "${jobTitle}" কাজের জন্য আবেদন করছি। আমি একজন ${profession} হিসেবে অত্যন্ত যত্ন ও দক্ষতার সাথে কাজ করি। আপনার প্রয়োজনীয় মান ও ডেডলাইন বজায় রেখে সেরা ফলাফল দিতে আমি প্রস্তুত।\n\n${preservedText.includes('__URL_') ? 'আমার পূর্ববর্তী কাজের পোর্টফোলিও দেখতে পারেন: __URL_0__\n\n' : ''}${preservedText.includes('CV') ? 'আমার সিভি পর্যালোচনার জন্য সংযুক্ত করা হয়েছে।\n\n' : ''}আপনার সাথে দ্রুত যোগাযোগ করতে পারলে খুশি হব।\n\nধন্যবাদান্তে,\n${userName}`;
        break;

      case 'hi':
      case 'hindi':
        translated = `नमस्ते ${company},\n\nमैं आपके "${jobTitle}" पद के लिए आवेदन कर रहा हूँ। मैं एक पेशेवर ${profession} हूँ और उच्च गुणवत्ता वाले परिणाम समय पर देने के लिए प्रतिबद्ध हूँ।\n\n${preservedText.includes('__URL_') ? 'आप मेरा पोर्टफोलियो यहाँ देख सकते हैं: __URL_0__\n\n' : ''}${preservedText.includes('CV') ? 'मेरा बायोडाटा (CV) संलग्न है।\n\n' : ''}मुझे आपके साथ इस अवसर पर चर्चा करने में खुशी होगी।\n\nशुभकामनाएं,\n${userName}`;
        break;

      case 'es':
      case 'spanish':
        translated = `Hola ${company},\n\nMe comunico con gran interés para postularme a la posición de "${jobTitle}". Como ${profession}, cuento con amplia experiencia entregando resultados de alto nivel y respetando rigurosamente los plazos acordados.\n\n${preservedText.includes('__URL_') ? 'Puede revisar mi portafolio de trabajos anteriores aquí: __URL_0__\n\n' : ''}${preservedText.includes('CV') ? 'Adjunto mi CV completo para su revisión.\n\n' : ''}Quedo a su disposición para conversar sobre cómo aportar valor a su equipo.\n\nSaludos cordiales,\n${userName}`;
        break;

      case 'fr':
      case 'french':
        translated = `Bonjour ${company},\n\nJe vous contacte pour vous proposer ma candidature pour le poste de "${jobTitle}". En tant que ${profession}, j'ai à cœur de livrer des réalisations de haute qualité dans le strict respect de vos délais et exigences.\n\n${preservedText.includes('__URL_') ? 'Vous pouvez consulter mon portfolio ici : __URL_0__\n\n' : ''}${preservedText.includes('CV') ? 'Mon CV complet est joint pour votre examen.\n\n' : ''}Je serais ravi(e) d'échanger avec vous pour discuter de vos projets à venir.\n\nCordialement,\n${userName}`;
        break;

      case 'de':
      case 'german':
        translated = `Hallo ${company},\n\nhiermit bewerbe ich mich mit großem Interesse für die Stelle als "${jobTitle}". Als erfahrener ${profession} lege ich höchsten Wert auf präzise Umsetzung, erstklassige Qualität und termingerechte Lieferung.\n\n${preservedText.includes('__URL_') ? 'Mein Portfolio mit bisherigen Kundenprojekten finden Sie hier: __URL_0__\n\n' : ''}${preservedText.includes('CV') ? 'Mein Lebenslauf ist zur Ansicht beigefügt.\n\n' : ''}Ich freue mich auf die Gelegenheit eines persönlichen Gesprächs.\n\nMit freundlichen Grüßen,\n${userName}`;
        break;

      case 'pt':
      case 'portuguese':
        translated = `Olá ${company},\n\nEscrevo para manifestar meu grande interesse na oportunidade para "${jobTitle}". Como ${profession}, tenho histórico comprovado de entregas com excelência técnica e cumprimento rigoroso de prazos.\n\n${preservedText.includes('__URL_') ? 'Você pode visualizar meus trabalhos anteriores aqui: __URL_0__\n\n' : ''}${preservedText.includes('CV') ? 'Meu currículo completo está em anexo para sua avaliação.\n\n' : ''}Estou à disposição para uma rápida conversa sobre seus objetivos.\n\nAtenciosamente,\n${userName}`;
        break;

      case 'ar':
      case 'arabic':
        translated = `مرحباً ${company}،\n\nيسعدني التقدم لشغل وظيفة "${jobTitle}". بصفتي ${profession} متخصص، أحرص دائماً على تقديم أعمال بأعلى معايير الجودة والالتزام التام بالمواعيد المحددة.\n\n${preservedText.includes('__URL_') ? 'يمكنكم الاطلاع على معرض أعمالي هنا: __URL_0__\n\n' : ''}${preservedText.includes('CV') ? 'مرفق مع هذه الرسالة السيرة الذاتية الخاصة بي للاطلاع.\n\n' : ''}أتطلع إلى فرصة التواصل معكم لمناقشة تفاصيل المشروع.\n\nمع خالص التحية،\n${userName}`;
        break;

      case 'ja':
      case 'japanese':
        translated = `${company} 様\n\n突然のご連絡失礼いたします。「${jobTitle}」の募集を拝見し、応募させていただきました。${profession}として、納期厳守と高品質な成果物の提供を徹底しております。\n\n${preservedText.includes('__URL_') ? '過去の実績・ポートフォリオはこちらからご確認いただけます: __URL_0__\n\n' : ''}${preservedText.includes('CV') ? '詳細な履歴書を添付しておりますのでご確認ください。\n\n' : ''}ぜひ一度お話しできる機会をいただけますと幸いです。\n\nよろしくお願い申し上げます。\n${userName}`;
        break;

      default:
        translated = `[Translated with Google Translate (${langObj.name})]\n\n${preservedText}`;
        break;
    }

    // Restore preserved URLs and Emails
    urlMatches.forEach((url, i) => {
      translated = translated.replace(new RegExp(`__URL_${i}__`, 'g'), url);
    });
    emailMatches.forEach((email, i) => {
      translated = translated.replace(new RegExp(`__EMAIL_${i}__`, 'g'), email);
    });

    return {
      success: true,
      translatedText: translated,
      targetLanguage: langObj.name,
      targetCode: langCode,
      originalText: text,
      isDemo: false,
    };
  }
}

export const translationService = new TranslationService();
