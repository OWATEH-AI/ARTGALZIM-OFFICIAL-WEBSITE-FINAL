import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './schemaTypes/index.js';

export default defineConfig({
  name: 'artgalzim',
  title: 'ARTGALZIM Studio',
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || '2a274c3r',
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  plugins: [structureTool()],
  schema: { types: schemaTypes }
});
