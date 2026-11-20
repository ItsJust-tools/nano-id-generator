import type { ToolConfig } from '@itsjust/core';
import packageJson from '../../package.json';

export const templateBaseVersion = packageJson.version;

const baseConfig = {
  id: 'tool-1795161888',
  name: 'Nano ID Generator',
  description:
    'Generates compact, URL-safe Nano IDs with configurable length and custom alphabet, batch generation, and collision probability estimates.',
  version: '1.0.0',
  exportFormats: ['json', 'png', 'jpeg', 'webp', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#22c55e',
    accentHover: '#16a34a',
    accentSubtle: 'rgba(34, 197, 94, 0.08)',
    brand: 'Nano ID Generator',
    icon: '🧬',
  },
} satisfies ToolConfig;

export const toolConfig = { ...baseConfig, category: 'Developer' };

export default toolConfig;
