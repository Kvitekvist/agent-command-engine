/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./renderer/**/*.{html,js,jsx}'],
  theme: {
    extend: {
      borderRadius: {
        DEFAULT: '3px',
        md: '3px',
        lg: '3px',
        xl: '3px',
        '2xl': '3px',
      },
      colors: {
        surface: '#0f1117',
        panel:   '#1a1d27',
        border:  '#2a2d3a',
        accent:  '#7c6af7',
        'accent-hover': '#6858e0',
        muted:   '#6b7280',
        success: '#22c55e',
        warning: '#f59e0b',
        danger:  '#ef4444',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
