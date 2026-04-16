
export type ThemeName = 'midnight' | 'daylight' | 'ocean' | 'forest' | 'sunset' | 'rose' | 'chameleon' | 'neural';

export interface ThemeColors {
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgInput: string;
  bgHover: string;

  // Borders
  borderPrimary: string;
  borderSecondary: string;
  borderFocus: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Accent
  accent: string;
  accentHover: string;
  accentShadow: string;
  accentSubtle: string;

  // Chat bubbles
  userBubble: string;
  userBubbleShadow: string;
  botBubble: string;
  botBubbleBorder: string;

  // Status
  statusBar: string;
  statusBarText: string;

  // Scrollbar
  scrollThumb: string;
  scrollThumbHover: string;

  // Button
  buttonPrimary: string;
  buttonPrimaryText: string;
  buttonSecondary: string;
  buttonSecondaryText: string;
}

export interface Theme {
  name: ThemeName;
  label: string;
  emoji: string;
  colors: ThemeColors;
}

export const themes: Record<ThemeName, Theme> = {
  midnight: {
    name: 'midnight',
    label: 'Midnight',
    emoji: '',
    colors: {
      bgPrimary: '#09090b',
      bgSecondary: '#18181b',
      bgTertiary: '#27272a',
      bgInput: '#27272a',
      bgHover: 'rgba(39,39,42,0.4)',
      borderPrimary: '#27272a',
      borderSecondary: '#3f3f46',
      borderFocus: 'rgba(99,102,241,0.3)',
      textPrimary: '#f4f4f5',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      textInverse: '#09090b',
      accent: '#4f46e5',
      accentHover: '#4338ca',
      accentShadow: 'rgba(99,102,241,0.2)',
      accentSubtle: 'rgba(99,102,241,0.1)',
      userBubble: '#4f46e5',
      userBubbleShadow: 'rgba(99,102,241,0.2)',
      botBubble: '#18181b',
      botBubbleBorder: '#27272a',
      statusBar: 'rgba(39,39,42,0.5)',
      statusBarText: '#a1a1aa',
      scrollThumb: '#27272a',
      scrollThumbHover: '#3f3f46',
      buttonPrimary: '#f4f4f5',
      buttonPrimaryText: '#09090b',
      buttonSecondary: '#27272a',
      buttonSecondaryText: '#a1a1aa',
    },
  },

  daylight: {
    name: 'daylight',
    label: 'Daylight',
    emoji: '',
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f8fafc',
      bgTertiary: '#f1f5f9',
      bgInput: '#f1f5f9',
      bgHover: 'rgba(241,245,249,0.6)',
      borderPrimary: '#e2e8f0',
      borderSecondary: '#cbd5e1',
      borderFocus: 'rgba(99,102,241,0.4)',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#94a3b8',
      textInverse: '#ffffff',
      accent: '#4f46e5',
      accentHover: '#4338ca',
      accentShadow: 'rgba(99,102,241,0.15)',
      accentSubtle: 'rgba(99,102,241,0.08)',
      userBubble: '#4f46e5',
      userBubbleShadow: 'rgba(99,102,241,0.15)',
      botBubble: '#f8fafc',
      botBubbleBorder: '#e2e8f0',
      statusBar: '#f1f5f9',
      statusBarText: '#475569',
      scrollThumb: '#cbd5e1',
      scrollThumbHover: '#94a3b8',
      buttonPrimary: '#0f172a',
      buttonPrimaryText: '#ffffff',
      buttonSecondary: '#e2e8f0',
      buttonSecondaryText: '#475569',
    },
  },

  ocean: {
    name: 'ocean',
    label: 'Ocean',
    emoji: '',
    colors: {
      bgPrimary: '#0c1222',
      bgSecondary: '#111a2e',
      bgTertiary: '#1a2540',
      bgInput: '#1a2540',
      bgHover: 'rgba(26,37,64,0.5)',
      borderPrimary: '#1e3050',
      borderSecondary: '#264060',
      borderFocus: 'rgba(34,211,238,0.3)',
      textPrimary: '#e0f2fe',
      textSecondary: '#7dd3fc',
      textMuted: '#38bdf8',
      textInverse: '#0c1222',
      accent: '#0891b2',
      accentHover: '#0e7490',
      accentShadow: 'rgba(8,145,178,0.25)',
      accentSubtle: 'rgba(8,145,178,0.1)',
      userBubble: '#0891b2',
      userBubbleShadow: 'rgba(8,145,178,0.25)',
      botBubble: '#111a2e',
      botBubbleBorder: '#1e3050',
      statusBar: 'rgba(26,37,64,0.5)',
      statusBarText: '#7dd3fc',
      scrollThumb: '#1e3050',
      scrollThumbHover: '#264060',
      buttonPrimary: '#e0f2fe',
      buttonPrimaryText: '#0c1222',
      buttonSecondary: '#1a2540',
      buttonSecondaryText: '#7dd3fc',
    },
  },

  forest: {
    name: 'forest',
    label: 'Forest',
    emoji: '',
    colors: {
      bgPrimary: '#0a120a',
      bgSecondary: '#111c11',
      bgTertiary: '#1a2e1a',
      bgInput: '#1a2e1a',
      bgHover: 'rgba(26,46,26,0.5)',
      borderPrimary: '#1f3d1f',
      borderSecondary: '#2d5a2d',
      borderFocus: 'rgba(34,197,94,0.3)',
      textPrimary: '#ecfdf5',
      textSecondary: '#86efac',
      textMuted: '#4ade80',
      textInverse: '#0a120a',
      accent: '#16a34a',
      accentHover: '#15803d',
      accentShadow: 'rgba(22,163,74,0.25)',
      accentSubtle: 'rgba(22,163,74,0.1)',
      userBubble: '#16a34a',
      userBubbleShadow: 'rgba(22,163,74,0.25)',
      botBubble: '#111c11',
      botBubbleBorder: '#1f3d1f',
      statusBar: 'rgba(26,46,26,0.5)',
      statusBarText: '#86efac',
      scrollThumb: '#1f3d1f',
      scrollThumbHover: '#2d5a2d',
      buttonPrimary: '#ecfdf5',
      buttonPrimaryText: '#0a120a',
      buttonSecondary: '#1a2e1a',
      buttonSecondaryText: '#86efac',
    },
  },

  sunset: {
    name: 'sunset',
    label: 'Sunset',
    emoji: '',
    colors: {
      bgPrimary: '#1a0a0a',
      bgSecondary: '#241111',
      bgTertiary: '#361a1a',
      bgInput: '#361a1a',
      bgHover: 'rgba(54,26,26,0.5)',
      borderPrimary: '#4a2020',
      borderSecondary: '#5c2d2d',
      borderFocus: 'rgba(251,146,60,0.3)',
      textPrimary: '#fff7ed',
      textSecondary: '#fdba74',
      textMuted: '#fb923c',
      textInverse: '#1a0a0a',
      accent: '#ea580c',
      accentHover: '#c2410c',
      accentShadow: 'rgba(234,88,12,0.25)',
      accentSubtle: 'rgba(234,88,12,0.1)',
      userBubble: '#ea580c',
      userBubbleShadow: 'rgba(234,88,12,0.25)',
      botBubble: '#241111',
      botBubbleBorder: '#4a2020',
      statusBar: 'rgba(54,26,26,0.5)',
      statusBarText: '#fdba74',
      scrollThumb: '#4a2020',
      scrollThumbHover: '#5c2d2d',
      buttonPrimary: '#fff7ed',
      buttonPrimaryText: '#1a0a0a',
      buttonSecondary: '#361a1a',
      buttonSecondaryText: '#fdba74',
    },
  },

  rose: {
    name: 'rose',
    label: 'Rose',
    emoji: '',
    colors: {
      bgPrimary: '#120a10',
      bgSecondary: '#1c1018',
      bgTertiary: '#2e1a28',
      bgInput: '#2e1a28',
      bgHover: 'rgba(46,26,40,0.5)',
      borderPrimary: '#3d1f35',
      borderSecondary: '#5a2d4d',
      borderFocus: 'rgba(244,114,182,0.3)',
      textPrimary: '#fdf2f8',
      textSecondary: '#f9a8d4',
      textMuted: '#f472b6',
      textInverse: '#120a10',
      accent: '#db2777',
      accentHover: '#be185d',
      accentShadow: 'rgba(219,39,119,0.25)',
      accentSubtle: 'rgba(219,39,119,0.1)',
      userBubble: '#db2777',
      userBubbleShadow: 'rgba(219,39,119,0.25)',
      botBubble: '#1c1018',
      botBubbleBorder: '#3d1f35',
      statusBar: 'rgba(46,26,40,0.5)',
      statusBarText: '#f9a8d4',
      scrollThumb: '#3d1f35',
      scrollThumbHover: '#5a2d4d',
      buttonPrimary: '#fdf2f8',
      buttonPrimaryText: '#120a10',
      buttonSecondary: '#2e1a28',
      buttonSecondaryText: '#f9a8d4',
    },
  },
  chameleon: {
    name: 'chameleon',
    label: 'Chameleon',
    emoji: '🌈',
    colors: {
      bgPrimary: '#09090b',
      bgSecondary: '#18181b',
      bgTertiary: '#27272a',
      bgInput: '#27272a',
      bgHover: 'rgba(39,39,42,0.4)',
      borderPrimary: '#27272a',
      borderSecondary: '#3f3f46',
      borderFocus: 'rgba(99,102,241,0.3)',
      textPrimary: '#f4f4f5',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      textInverse: '#09090b',
      accent: '#4f46e5',
      accentHover: '#4338ca',
      accentShadow: 'rgba(99,102,241,0.2)',
      accentSubtle: 'rgba(99,102,241,0.1)',
      userBubble: '#4f46e5',
      userBubbleShadow: 'rgba(99,102,241,0.2)',
      botBubble: '#18181b',
      botBubbleBorder: '#27272a',
      statusBar: 'rgba(39,39,42,0.5)',
      statusBarText: '#a1a1aa',
      scrollThumb: '#27272a',
      scrollThumbHover: '#3f3f46',
      buttonPrimary: '#f4f4f5',
      buttonPrimaryText: '#09090b',
      buttonSecondary: '#27272a',
      buttonSecondaryText: '#a1a1aa',
    },
  },
  neural: {
    name: 'neural',
    label: 'Neural',
    emoji: '🧠',
    colors: {
      bgPrimary: '#050505',
      bgSecondary: '#0a0a0a',
      bgTertiary: '#111111',
      bgInput: '#0f0f0f',
      bgHover: 'rgba(0,255,100,0.05)',
      borderPrimary: '#1a1a1a',
      borderSecondary: '#2a2a2a',
      borderFocus: 'rgba(0,255,100,0.3)',
      textPrimary: '#ffffff',
      textSecondary: '#a0a0a0',
      textMuted: '#505050',
      textInverse: '#000000',
      accent: '#00ff66',
      accentHover: '#00cc55',
      accentShadow: 'rgba(0,255,100,0.2)',
      accentSubtle: 'rgba(0,255,100,0.05)',
      userBubble: '#00ff66',
      userBubbleShadow: 'rgba(0,255,100,0.1)',
      botBubble: '#0a0a0a',
      botBubbleBorder: '#1a1a1a',
      statusBar: 'rgba(0,255,100,0.05)',
      statusBarText: '#00ff66',
      scrollThumb: '#1a1a1a',
      scrollThumbHover: '#2a2a2a',
      buttonPrimary: '#00ff66',
      buttonPrimaryText: '#000000',
      buttonSecondary: '#1a1a1a',
      buttonSecondaryText: '#00ff66',
    },
  },
};

export const themeNames: ThemeName[] = ['midnight', 'daylight', 'ocean', 'forest', 'sunset', 'rose', 'chameleon', 'neural'];

let chameleonInterval: any = null;

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const c = theme.colors;

  // Stop any existing chameleon effect and remove transition
  if (chameleonInterval) {
    clearInterval(chameleonInterval);
    chameleonInterval = null;
    root.style.transition = '';
  }

  const setVars = (colors: ThemeColors) => {
    root.style.setProperty('--bg-primary', colors.bgPrimary);
    root.style.setProperty('--bg-secondary', colors.bgSecondary);
    root.style.setProperty('--bg-tertiary', colors.bgTertiary);
    root.style.setProperty('--bg-input', colors.bgInput);
    root.style.setProperty('--bg-hover', colors.bgHover);

    root.style.setProperty('--border-primary', colors.borderPrimary);
    root.style.setProperty('--border-secondary', colors.borderSecondary);
    root.style.setProperty('--border-focus', colors.borderFocus);

    root.style.setProperty('--text-primary', colors.textPrimary);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--text-muted', colors.textMuted);
    root.style.setProperty('--text-inverse', colors.textInverse);

    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--accent-hover', colors.accentHover);
    root.style.setProperty('--accent-shadow', colors.accentShadow);
    root.style.setProperty('--accent-subtle', colors.accentSubtle);

    root.style.setProperty('--user-bubble', colors.userBubble);
    root.style.setProperty('--user-bubble-shadow', colors.userBubbleShadow);
    root.style.setProperty('--bot-bubble', colors.botBubble);
    root.style.setProperty('--bot-bubble-border', colors.botBubbleBorder);

    root.style.setProperty('--status-bar', colors.statusBar);
    root.style.setProperty('--status-bar-text', colors.statusBarText);

    root.style.setProperty('--scroll-thumb', colors.scrollThumb);
    root.style.setProperty('--scroll-thumb-hover', colors.scrollThumbHover);

    root.style.setProperty('--btn-primary', colors.buttonPrimary);
    root.style.setProperty('--btn-primary-text', colors.buttonPrimaryText);
    root.style.setProperty('--btn-secondary', colors.buttonSecondary);
    root.style.setProperty('--btn-secondary-text', colors.buttonSecondaryText);

    document.body.style.backgroundColor = colors.bgPrimary;
    document.body.style.color = colors.textPrimary;
  };

  if (theme.name === 'chameleon') {
    let hue = 0;
    // Add a smooth transition to the root for all color changes
    root.style.transition = 'background-color 0.5s linear, border-color 0.5s linear, color 0.5s linear, box-shadow 0.5s linear';
    
    chameleonInterval = setInterval(() => {
      hue = (hue + 0.5) % 360; // Smaller step for smoother transition
      const accent = `hsl(${hue}, 70%, 60%)`;
      const bg = `hsl(${hue}, 20%, 5%)`;
      const bgSec = `hsl(${hue}, 20%, 10%)`;
      const bgTer = `hsl(${hue}, 20%, 15%)`;
      
      setVars({
        ...c,
        accent,
        accentHover: `hsl(${hue}, 70%, 50%)`,
        accentShadow: `hsla(${hue}, 70%, 60%, 0.2)`,
        accentSubtle: `hsla(${hue}, 70%, 60%, 0.1)`,
        userBubble: accent,
        userBubbleShadow: `hsla(${hue}, 70%, 60%, 0.2)`,
        bgPrimary: bg,
        bgSecondary: bgSec,
        bgTertiary: bgTer,
        bgInput: bgTer,
        statusBar: `hsla(${hue}, 20%, 15%, 0.5)`,
        buttonPrimary: `hsl(${hue}, 10%, 95%)`,
        buttonPrimaryText: bg,
      });
    }, 100); // Slightly slower interval but with CSS transition for "liquid" feel
  } else {
    setVars(c);
  }
}

export function getStoredTheme(): ThemeName {
  const stored = localStorage.getItem('utsho_theme');
  if (stored && stored in themes) return stored as ThemeName;
  return 'midnight';
}

export function storeTheme(name: ThemeName): void {
  localStorage.setItem('utsho_theme', name);
}
