import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './schemaTypes/index.js';

export default defineConfig({
  name: 'artgalzim',
  title: 'ARTGALZIM Studio',
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || '2a274c3r',
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  plugins: [structureTool({
    structure: S => {
      const otherDocumentTypes = S.documentTypeListItems()
        .filter(item => !['journalFolder', 'journalEntry'].includes(item.getId()));
      return S.list()
        .title('ARTGALZIM Content')
        .items([
          ...otherDocumentTypes,
          S.documentTypeListItem('journalFolder').title('News & Gallery Folders'),
          S.documentTypeList('journalEntry')
            .title('News & Gallery Entries')
            .filter('_type == "journalEntry" && destination != "tv" && entryType != "ARTGALZIM TV" && (!defined(isDeleted) || isDeleted == false)'),
          S.documentTypeList('journalEntry')
            .title('ARTGALZIM TV Videos')
            .filter('_type == "journalEntry" && (destination == "tv" || entryType == "ARTGALZIM TV") && (!defined(isDeleted) || isDeleted == false)')
        ]);
    }
  })],
  schema: { types: schemaTypes }
});
