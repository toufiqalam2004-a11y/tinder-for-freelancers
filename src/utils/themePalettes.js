/**
 * Tinder for Freelancers — Theme Palettes & Contrast Intelligence Engine
 * 
 * Provides predefined color palettes (Light & Dark variants for each)
 * and WCAG 2.1 relative luminance and contrast ratio validation.
 */

export const THEME_STORAGE_KEYS = {
  BRIGHTNESS: 'tf_theme_mode',
  COLOR_THEME: 'tf_color_theme',
  CUSTOM_COLORS: 'tf_custom_colors',
};

export const DEFAULT_CUSTOM_COLORS = {
  primary: '#E11D48',
  secondary: '#D4A373',
  background: '#FAF7F2',
  surface: '#FFFFFF',
  text: '#1C1917',
  accent: '#E11D48',
};

export const COLOR_THEME_PRESETS = [
  {
    id: 'pink-beige',
    name: 'Pink + Warm Beige',
    description: 'Signature Tinder for Freelancers brand',
    preview: {
      primary: '#E11D48',
      secondary: '#D4A373',
      bg: '#FAF7F2',
      surface: '#FFFFFF',
    },
    light: {
      primary: '#E11D48',
      primaryHover: '#BE123C',
      secondary: '#D4A373',
      background: '#FAF7F2',
      surface: '#FFFFFF',
      surfaceHover: '#F5EFE8',
      textPrimary: '#1C1917',
      textSecondary: '#57534E',
      textMuted: '#8C847E',
      border: '#E8E0D5',
      accent: '#E11D48',
    },
    dark: {
      primary: '#F43F6E',
      primaryHover: '#E11D48',
      secondary: '#D4A373',
      background: '#141212',
      surface: '#1E1B1A',
      surfaceHover: '#292524',
      textPrimary: '#FAF7F2',
      textSecondary: '#C7BEB7',
      textMuted: '#8C847E',
      border: '#383330',
      accent: '#F43F6E',
    },
  },
  {
    id: 'blue-white',
    name: 'Blue + White',
    description: 'Corporate, clean tech & modern enterprise',
    preview: {
      primary: '#2563EB',
      secondary: '#60A5FA',
      bg: '#F8FAFC',
      surface: '#FFFFFF',
    },
    light: {
      primary: '#2563EB',
      primaryHover: '#1D4ED8',
      secondary: '#60A5FA',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      surfaceHover: '#F1F5F9',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      textMuted: '#94A3B8',
      border: '#E2E8F0',
      accent: '#3B82F6',
    },
    dark: {
      primary: '#3B82F6',
      primaryHover: '#2563EB',
      secondary: '#93C5FD',
      background: '#0B1120',
      surface: '#151F32',
      surfaceHover: '#1E293B',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      border: '#26354D',
      accent: '#60A5FA',
    },
  },
  {
    id: 'purple-lavender',
    name: 'Purple + Lavender',
    description: 'Creative studio, animation & video editing',
    preview: {
      primary: '#7C3AED',
      secondary: '#C4B5FD',
      bg: '#FAF5FF',
      surface: '#FFFFFF',
    },
    light: {
      primary: '#7C3AED',
      primaryHover: '#6D28D9',
      secondary: '#C4B5FD',
      background: '#FAF5FF',
      surface: '#FFFFFF',
      surfaceHover: '#F3E8FF',
      textPrimary: '#1E1B4B',
      textSecondary: '#581C87',
      textMuted: '#9333EA',
      border: '#E9D5FF',
      accent: '#8B5CF6',
    },
    dark: {
      primary: '#A78BFA',
      primaryHover: '#8B5CF6',
      secondary: '#C4B5FD',
      background: '#0F0B1E',
      surface: '#1B1530',
      surfaceHover: '#261E42',
      textPrimary: '#FAF5FF',
      textSecondary: '#D8B4FE',
      textMuted: '#A855F7',
      border: '#372A5E',
      accent: '#C084FC',
    },
  },
  {
    id: 'green-cream',
    name: 'Green + Cream',
    description: 'Organic, sustainable & fresh editorial aesthetic',
    preview: {
      primary: '#059669',
      secondary: '#84CC16',
      bg: '#F7F8F4',
      surface: '#FFFFFF',
    },
    light: {
      primary: '#059669',
      primaryHover: '#047857',
      secondary: '#84CC16',
      background: '#F7F8F4',
      surface: '#FFFFFF',
      surfaceHover: '#ECF3EB',
      textPrimary: '#064E3B',
      textSecondary: '#374151',
      textMuted: '#6B7280',
      border: '#D1E2D4',
      accent: '#10B981',
    },
    dark: {
      primary: '#10B981',
      primaryHover: '#059669',
      secondary: '#34D399',
      background: '#081611',
      surface: '#12241C',
      surfaceHover: '#193429',
      textPrimary: '#ECFDF5',
      textSecondary: '#A7F3D0',
      textMuted: '#6EE7B7',
      border: '#1F4535',
      accent: '#34D399',
    },
  },
  {
    id: 'orange-sand',
    name: 'Orange + Sand',
    description: 'High energy, sunset warmth & creator momentum',
    preview: {
      primary: '#EA580C',
      secondary: '#F59E0B',
      bg: '#FFFDF7',
      surface: '#FFFFFF',
    },
    light: {
      primary: '#EA580C',
      primaryHover: '#C2410C',
      secondary: '#F59E0B',
      background: '#FFFDF7',
      surface: '#FFFFFF',
      surfaceHover: '#FDF6EB',
      textPrimary: '#1C1917',
      textSecondary: '#78350F',
      textMuted: '#92400E',
      border: '#FED7AA',
      accent: '#F97316',
    },
    dark: {
      primary: '#FB923C',
      primaryHover: '#EA580C',
      secondary: '#FBBF24',
      background: '#180E07',
      surface: '#271810',
      surfaceHover: '#382317',
      textPrimary: '#FFF7ED',
      textSecondary: '#FDBA74',
      textMuted: '#FB923C',
      border: '#4E3120',
      accent: '#FB923C',
    },
  },
  {
    id: 'black-gold',
    name: 'Black + Gold',
    description: 'Executive luxury, VIP contracts & sleek prestige',
    preview: {
      primary: '#D97706',
      secondary: '#1C1917',
      bg: '#FAFAF9',
      surface: '#FFFFFF',
    },
    light: {
      primary: '#D97706',
      primaryHover: '#B45309',
      secondary: '#1C1917',
      background: '#FAFAF9',
      surface: '#FFFFFF',
      surfaceHover: '#F5F5F4',
      textPrimary: '#18181B',
      textSecondary: '#52525B',
      textMuted: '#71717A',
      border: '#E4E4E7',
      accent: '#F59E0B',
    },
    dark: {
      primary: '#FBBF24',
      primaryHover: '#F59E0B',
      secondary: '#E5E7EB',
      background: '#09090B',
      surface: '#141417',
      surfaceHover: '#202025',
      textPrimary: '#F4F4F5',
      textSecondary: '#A1A1AA',
      textMuted: '#71717A',
      border: '#27272A',
      accent: '#FBBF24',
    },
  },
];

/**
 * Parses Hex color to RGB
 */
export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return [0, 0, 0];
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    return [
      parseInt(cleaned[0] + cleaned[0], 16),
      parseInt(cleaned[1] + cleaned[1], 16),
      parseInt(cleaned[2] + cleaned[2], 16),
    ];
  }
  if (cleaned.length === 6) {
    return [
      parseInt(cleaned.slice(0, 2), 16),
      parseInt(cleaned.slice(2, 4), 16),
      parseInt(cleaned.slice(4, 6), 16),
    ];
  }
  return [0, 0, 0];
}

/**
 * Calculates WCAG 2.1 relative luminance
 */
export function getLuminance(hex) {
  const rgb = hexToRgb(hex);
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculates WCAG 2.1 contrast ratio between two hex colors (1:1 to 21:1)
 */
export function getContrastRatio(hex1, hex2) {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

/**
 * Evaluates contrast between text and background
 */
export function evaluateContrast(textHex, bgHex, surfaceHex = null) {
  const bgRatio = getContrastRatio(textHex, bgHex);
  const surfaceRatio = surfaceHex ? getContrastRatio(textHex, surfaceHex) : bgRatio;
  const lowest = Math.min(bgRatio, surfaceRatio);

  let status = 'pass'; // 'pass' | 'warning' | 'fail'
  let warningMessage = null;

  if (lowest < 3.0) {
    status = 'fail';
    warningMessage = `Poor contrast detected (${lowest}:1). Text will be difficult to read against your chosen background. Consider choosing a higher-contrast text color.`;
  } else if (lowest < 4.5) {
    status = 'warning';
    warningMessage = `Moderate contrast (${lowest}:1). Meets large text guidelines, but small body text may have reduced clarity.`;
  }

  return {
    bgRatio,
    surfaceRatio,
    lowestRatio: lowest,
    status,
    warningMessage,
  };
}

/**
 * Lightens or darkens a color by percentage for hover/border states
 */
export function adjustBrightness(hex, percent) {
  const [r, g, b] = hexToRgb(hex);
  const adjust = (val) => {
    const res = Math.round(val + (val * percent) / 100);
    return Math.min(255, Math.max(0, res)).toString(16).padStart(2, '0');
  };
  return `#${adjust(r)}${adjust(g)}${adjust(b)}`;
}

/**
 * Resolves active palette variables given brightness mode and color theme ID
 */
export function resolveThemePalette(brightnessMode, colorThemeId, customColors) {
  const isDark = brightnessMode === 'dark';

  if (colorThemeId === 'custom' && customColors) {
    const primary = customColors.primary || DEFAULT_CUSTOM_COLORS.primary;
    const secondary = customColors.secondary || DEFAULT_CUSTOM_COLORS.secondary;
    const background = customColors.background || DEFAULT_CUSTOM_COLORS.background;
    const surface = customColors.surface || DEFAULT_CUSTOM_COLORS.surface;
    const textPrimary = customColors.text || DEFAULT_CUSTOM_COLORS.text;
    const accent = customColors.accent || primary;

    // Derive subtle hover & border states from custom colors
    const bgLum = getLuminance(background);
    const isBgDark = bgLum < 0.2;

    const surfaceHover = isBgDark
      ? adjustBrightness(surface, 12)
      : adjustBrightness(surface, -5);

    const border = isBgDark
      ? adjustBrightness(surface, 20)
      : adjustBrightness(background, -12);

    const primaryHover = adjustBrightness(primary, isDark ? -10 : 10);
    const textSecondary = adjustBrightness(textPrimary, isBgDark ? -20 : 30);

    return {
      primary,
      primaryHover,
      secondary,
      background,
      surface,
      surfaceHover,
      textPrimary,
      textSecondary,
      border,
      accent,
    };
  }

  // Find preset
  const preset = COLOR_THEME_PRESETS.find((p) => p.id === colorThemeId) || COLOR_THEME_PRESETS[0];
  return isDark ? preset.dark : preset.light;
}
