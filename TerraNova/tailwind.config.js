/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        space: {
          DEFAULT: '#102030',
          deep: '#001020',
          panel: '#102a3a',
          raised: '#18384a',
        },
        terra: {
          blue: '#60a0c0',
          mint: '#70b8d4',
          orange: '#ff986a',
          rust: '#e07040',
          land: '#80b070',
        },
      },
      boxShadow: {
        glow: '0 0 28px rgba(80, 160, 192, 0.16)',
        'glow-strong': '0 0 42px rgba(80, 160, 192, 0.24)',
        glass: 'inset 0 1px 0 rgba(220, 246, 255, 0.08), 0 18px 42px rgba(0, 8, 18, 0.22)',
      },
      borderRadius: {
        card: '18px',
        panel: '24px',
      },
      backdropBlur: {
        glass: '18px',
      },
      backgroundImage: {
        'space-glow':
          'radial-gradient(ellipse at 72% 20%, rgba(80,160,192,0.16), transparent 42%), linear-gradient(145deg, #102030, #001020)',
        'glass-panel':
          'linear-gradient(145deg, rgba(24,56,74,0.76), rgba(10,29,43,0.86))',
      },
      fontSize: {
        'display-xl': ['clamp(2.2rem, 5vw, 4.5rem)', { lineHeight: '1.02', letterSpacing: '-0.055em' }],
      },
    },
  },
  plugins: [],
}
