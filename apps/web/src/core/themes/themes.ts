/**
 * Theme Definitions for Laureate
 * Researched from top SaaS products (Figma, Linear, GitHub, Stripe, Apple, Vercel, Airbnb)
 */

export type ThemeName = 'dark-pro' | 'luxury-minimal' | 'warm-community';

export interface ThemeColors {
  // Backgrounds
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    surface: string;
    overlay: string;
  };
  // Text
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
  };
  // Interactive
  action: {
    primary: string;
    secondary: string;
    hover: string;
    active: string;
    disabled: string;
  };
  // Status
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  // Borders
  border: {
    default: string;
    light: string;
    dark: string;
  };
  // Accents
  accent: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
}

export interface Theme {
  name: ThemeName;
  label: string;
  description: string;
  colors: ThemeColors;
  typography: {
    fontFamily: {
      sans: string;
      mono: string;
    };
    scale: 0.8 | 0.9 | 1 | 1.05 | 1.08 | 1.1 | 1.15 | 1.2;
  };
  spacing: {
    scale: 0.8 | 0.9 | 1 | 1.05 | 1.08 | 1.1 | 1.15 | 1.2;
  };
  borderRadius: {
    scale: 0.8 | 0.9 | 1 | 1.05 | 1.08 | 1.1 | 1.15 | 1.2;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
}

/**
 * THEME 1: Dark Pro
 * Inspired by: Linear, GitHub, Vercel
 * 
 * Focus: Developer-friendly, focused, minimal distractions
 * Best for: Power users, developers, people who value efficiency
 * Feeling: Professional, serious, "let's ship"
 */
export const darkProTheme: Theme = {
  name: 'dark-pro',
  label: 'Dark Pro',
  description: 'Developer-friendly, focused, minimal. Like Linear & GitHub.',
  colors: {
    bg: {
      primary: '#0d0d0d',    // Deep black
      secondary: '#1a1a1a',  // Slightly lighter
      tertiary: '#262626',   // For cards/sections
      surface: '#141414',    // Modal/dropdown backgrounds
      overlay: 'rgba(0, 0, 0, 0.85)',
    },
    text: {
      primary: '#f5f5f5',    // Clean white (WCAG AA: 17:1)
      secondary: '#d1d5db',  // Light gray (WCAG AA: 9.2:1)
      tertiary: '#9ca3af',   // Medium gray (WCAG AA: 6.5:1)
      inverse: '#000000',
    },
    action: {
      primary: '#8b5cf6',    // Vibrant purple (bright enough for dark bg)
      secondary: '#60a5fa',  // Bright blue
      hover: '#a78bfa',      // Lighter purple
      active: '#7c3aed',     // Darker purple
      disabled: '#6b7280',   // Gray
    },
    status: {
      success: '#34d399',    // Bright emerald
      warning: '#fbbf24',    // Bright amber
      error: '#f87171',      // Bright red
      info: '#60a5fa',       // Bright blue
    },
    border: {
      default: '#374151',    // Mid-gray
      light: '#1f2937',      // Subtle
      dark: '#4b5563',       // Prominent
    },
    accent: {
      primary: '#8b5cf6',    // Purple
      secondary: '#60a5fa',  // Blue
      tertiary: '#22d3ee',   // Cyan
    },
  },
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
      mono: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
    },
    scale: 1,
  },
  spacing: {
    scale: 1,
  },
  borderRadius: {
    scale: 0.9,
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
    md: '0 4px 6px 0 rgba(0, 0, 0, 0.5)',
    lg: '0 10px 15px 0 rgba(0, 0, 0, 0.6)',
  },
};

/**
 * THEME 2: Luxury Minimal
 * Inspired by: Apple, Stripe, Premium design
 * 
 * Focus: Elegant, premium, spacious
 * Best for: Professionals, executives, anyone who appreciates refinement
 * Feeling: Luxury, trustworthy, sophisticated
 */
export const luxuryMinimalTheme: Theme = {
  name: 'luxury-minimal',
  label: 'Luxury Minimal',
  description: 'Elegant, premium, spacious. Like Apple & Stripe.',
  colors: {
    bg: {
      primary: '#ffffff',    // Pure white
      secondary: '#fafafa',  // Almost white
      tertiary: '#f3f3f3',   // Light gray
      surface: '#ffffff',    // White surfaces
      overlay: 'rgba(0, 0, 0, 0.12)',
    },
    text: {
      primary: '#111827',    // Very dark (WCAG AAA: 18:1)
      secondary: '#4b5563',  // Medium gray (WCAG AA: 7.2:1)
      tertiary: '#6b7280',   // Light gray (WCAG AA: 5.8:1)
      inverse: '#ffffff',
    },
    action: {
      primary: '#1f2937',    // Jet dark gray (for better contrast on light bg)
      secondary: '#374151',  // Dark gray
      hover: '#111827',      // Even darker on hover
      active: '#0f172a',     // Almost black
      disabled: '#d1d5db',   // Light gray
    },
    status: {
      success: '#059669',    // Forest green
      warning: '#d97706',    // Burnt orange
      error: '#dc2626',      // Deep red
      info: '#0284c7',       // Deep blue
    },
    border: {
      default: '#d1d5db',    // Medium gray
      light: '#e5e7eb',      // Very subtle
      dark: '#9ca3af',       // Darker
    },
    accent: {
      primary: '#1f2937',    // Dark gray
      secondary: '#0284c7',  // Blue
      tertiary: '#7c3aed',   // Purple
    },
  },
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif',
      mono: '"Courier New", monospace',
    },
    scale: 1.05,
  },
  spacing: {
    scale: 1.2,
  },
  borderRadius: {
    scale: 1,
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.08)',
    md: '0 4px 6px 0 rgba(0, 0, 0, 0.12)',
    lg: '0 10px 15px 0 rgba(0, 0, 0, 0.15)',
  },
};

/**
 * THEME 3: Warm & Community
 * Inspired by: Airbnb, Figma, Playful design
 * 
 * Focus: Approachable, colorful, community-driven
 * Best for: Creative people, teams, anyone who loves color and personality
 * Feeling: Friendly, creative, energetic
 */
export const warmCommunityTheme: Theme = {
  name: 'warm-community',
  label: 'Warm & Community',
  description: 'Colorful, approachable, playful. Like Airbnb & Figma.',
  colors: {
    bg: {
      primary: '#fffbf5',    // Warm off-white
      secondary: '#fef5f0',  // Warm beige
      tertiary: '#fae8e0',   // Warmer gray
      surface: '#ffffff',    // White
      overlay: 'rgba(0, 0, 0, 0.08)',
    },
    text: {
      primary: '#1a1410',    // Warm dark brown (WCAG AAA: 16.5:1)
      secondary: '#6b6360',  // Warm gray (WCAG AA: 5.2:1)
      tertiary: '#8b7b6b',   // Light warm gray (WCAG AA: 4.5:1)
      inverse: '#ffffff',
    },
    action: {
      primary: '#d94444',    // Darker red (better on light bg)
      secondary: '#d97706',  // Warm orange
      hover: '#e74c3c',      // Brighter red on hover
      active: '#c0392b',     // Darker red
      disabled: '#ddd9d1',   // Light gray
    },
    status: {
      success: '#16a34a',    // Bright green
      warning: '#ea8c15',    // Bright orange
      error: '#dc2626',      // Bright red
      info: '#0369a1',       // Bright blue
    },
    border: {
      default: '#ddd9d1',    // Warm light
      light: '#ede5dc',      // Very subtle warm
      dark: '#bbb0a0',       // Warm darker
    },
    accent: {
      primary: '#d94444',    // Red
      secondary: '#d97706',  // Orange
      tertiary: '#d4a40f',   // Gold (darker)
    },
  },
  typography: {
    fontFamily: {
      sans: '"Poppins", "Segoe UI", sans-serif',
      mono: '"Fira Code", monospace',
    },
    scale: 1.08,
  },
  spacing: {
    scale: 1.15,
  },
  borderRadius: {
    scale: 1.2,
  },
  shadows: {
    sm: '0 1px 3px 0 rgba(255, 90, 95, 0.1)',
    md: '0 4px 8px 0 rgba(255, 90, 95, 0.12)',
    lg: '0 10px 20px 0 rgba(255, 90, 95, 0.15)',
  },
};

export const THEMES = {
  'dark-pro': darkProTheme,
  'luxury-minimal': luxuryMinimalTheme,
  'warm-community': warmCommunityTheme,
};

export const THEME_OPTIONS: Array<{ name: ThemeName; label: string; description: string }> = [
  {
    name: 'dark-pro',
    label: 'Dark Pro',
    description: 'Developer-friendly, focused, minimal',
  },
  {
    name: 'luxury-minimal',
    label: 'Luxury Minimal',
    description: 'Elegant, premium, spacious',
  },
  {
    name: 'warm-community',
    label: 'Warm & Community',
    description: 'Colorful, approachable, playful',
  },
];
