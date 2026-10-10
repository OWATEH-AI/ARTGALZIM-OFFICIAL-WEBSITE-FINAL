import { defineArrayMember, defineField, defineType } from 'sanity';

const artistTierOptions = [
  { title: 'Keith Zenda', value: 'Keith Zenda' },
  { title: 'Emerging Artists', value: 'Emerging Artists' },
  { title: 'Student Artists', value: 'Student Artists' }
];

const artworkFields = [
  defineField({ name: 'title', title: 'Title', type: 'string', validation: rule => rule.required() }),
  defineField({ name: 'artist', title: 'Artist', type: 'string', validation: rule => rule.required() }),
  defineField({
    name: 'artistTier',
    title: 'Artist Tier',
    type: 'string',
    options: { list: artistTierOptions, layout: 'radio' }
  }),
  defineField({ name: 'category', title: 'Album / Folder', type: 'string', validation: rule => rule.required() }),
  defineField({ name: 'medium', title: 'Medium', type: 'string' }),
  defineField({ name: 'size', title: 'Size', type: 'string' }),
  defineField({ name: 'year', title: 'Year', type: 'string' }),
  defineField({ name: 'price', title: 'Price', type: 'string' }),
  defineField({
    name: 'purchaseType',
    title: 'Purchase Type',
    type: 'string',
    options: { list: [{ title: 'Inquire', value: 'inquire' }, { title: 'Direct Purchase', value: 'direct' }] }
  }),
  defineField({
    name: 'paymentLink',
    title: 'Payment Link',
    type: 'url',
    hidden: ({ parent }) => parent?.purchaseType !== 'direct'
  }),
  defineField({ name: 'description', title: 'Description', type: 'text', rows: 4 }),
  defineField({ name: 'image', title: 'Artwork Image', type: 'image', options: { hotspot: true } }),
  defineField({ name: 'imageUrl', title: 'Image URL', type: 'url' }),
  defineField({ name: 'filename', title: 'Filename', type: 'string' }),
  defineField({ name: 'sourcePath', title: 'Original Source Path', type: 'string' }),
  defineField({
    name: 'isDeleted',
    title: 'Pending Deletion',
    type: 'boolean',
    hidden: true,
    readOnly: true
  })
];

export const schemaTypes = [
  defineType({
    name: 'artist',
    title: 'Artist',
    type: 'document',
    fields: [
      defineField({ name: 'name', title: 'Artist Name', type: 'string', validation: rule => rule.required() }),
      defineField({
        name: 'tier',
        title: 'Artist Tier',
        type: 'string',
        options: { list: artistTierOptions, layout: 'radio' },
        validation: rule => rule.required()
      })
    ],
    preview: { select: { title: 'name', subtitle: 'tier' } }
  }),
  defineType({
    name: 'album',
    title: 'Artist Album / Folder',
    type: 'document',
    fields: [
      defineField({ name: 'artist', title: 'Artist', type: 'string', validation: rule => rule.required() }),
      defineField({ name: 'name', title: 'Folder Name', type: 'string', validation: rule => rule.required() }),
      defineField({ name: 'coverSrc', title: 'Cover Image URL', type: 'string' }),
      defineField({ name: 'pendingCoverAssetCleanup', title: 'Pending Cover Asset Cleanup', type: 'array', of: [defineArrayMember({ type: 'string' })], hidden: true, readOnly: true }),
      defineField({ name: 'isDeleted', title: 'Pending Deletion', type: 'boolean', hidden: true, readOnly: true })
    ],
    preview: { select: { title: 'name', subtitle: 'artist' } }
  }),
  defineType({
    name: 'artwork',
    title: 'Artwork',
    type: 'document',
    fields: artworkFields,
    preview: { select: { title: 'title', subtitle: 'artist', media: 'image' } }
  }),
  defineType({
    name: 'exhibition',
    title: 'Exhibition / Event',
    type: 'document',
    fields: [
      defineField({ name: 'id', title: 'Dashboard ID', type: 'string', readOnly: true }),
      defineField({ name: 'title', title: 'Title', type: 'string', validation: rule => rule.required() }),
      defineField({ name: 'artist', title: 'Artist', type: 'string' }),
      defineField({ name: 'location', title: 'School / Location', description: 'For News & Gallery, enter the school name. ARTGALZIM TV can use this for a location.', type: 'string' }),
      defineField({ name: 'category', title: 'Category', type: 'string' }),
      defineField({ name: 'theme', title: 'Theme', type: 'string' }),
      defineField({ name: 'description', title: 'Description', type: 'text', rows: 4 }),
      defineField({ name: 'startDate', title: 'Start Date', type: 'date' }),
      defineField({ name: 'endDate', title: 'End Date', type: 'date' }),
      defineField({ name: 'startTime', title: 'Start Time', type: 'string' }),
      defineField({ name: 'endTime', title: 'End Time', type: 'string' }),
      defineField({
        name: 'status',
        title: 'Status',
        type: 'string',
        options: { list: ['upcoming', 'active', 'ongoing', 'past'] }
      }),
      defineField({ name: 'registrationLink', title: 'Registration Link', type: 'url' }),
      defineField({ name: 'paymentLink', title: 'Payment Link', type: 'url' }),
      defineField({ name: 'contactLink', title: 'Contact Link', type: 'string' }),
      defineField({ name: 'ctaText', title: 'Call-to-action Text', type: 'string' }),
      defineField({
        name: 'actionType',
        title: 'Customer Button Action',
        type: 'string',
        initialValue: 'link',
        options: {
          list: [
            { title: 'Registration / payment / contact link', value: 'link' },
            { title: 'WhatsApp', value: 'whatsapp' },
            { title: 'Email / portfolio submission', value: 'email' },
            { title: 'No button', value: 'none' }
          ],
          layout: 'radio'
        }
      }),
      defineField({
        name: 'whatsappNumber',
        title: 'WhatsApp Number',
        type: 'string',
        description: 'Include the country code, for example +263 77 123 4567.',
        hidden: ({ parent }) => parent?.actionType !== 'whatsapp',
        validation: rule => rule.custom(value => {
          if (!value) return true;
          const digits = value.replace(/\D/g, '');
          return digits.length >= 7 && digits.length <= 15
            ? true
            : 'Enter a number with country code (7 to 15 digits).';
        })
      }),
      defineField({
        name: 'bookingEmail',
        title: 'Booking / Portfolio Email',
        type: 'string',
        hidden: ({ parent }) => parent?.actionType !== 'email',
        validation: rule => rule.custom(value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
          || 'Enter a valid email address.')
      }),
      defineField({ name: 'actionInstructions', title: 'Booking / Submission Instructions', type: 'text', rows: 4 }),
      defineField({ name: 'registrationFee', title: 'Registration Fee', type: 'string' }),
      defineField({ name: 'timeRange', title: 'Display Time Range', type: 'string' }),
      defineField({ name: 'conditions', title: 'Conditions', type: 'text', rows: 3 }),
      defineField({ name: 'isPlaceholder', title: 'Placeholder Event', type: 'boolean' }),
      defineField({ name: 'displayDateOverride', title: 'Display Date Override', type: 'string' }),
      defineField({ name: 'poster', title: 'Poster', type: 'image', options: { hotspot: true } }),
      defineField({ name: 'imageUrl', title: 'Poster URL', type: 'url' }),
      defineField({ name: 'isDeleted', title: 'Pending Deletion', type: 'boolean', hidden: true, readOnly: true })
    ],
    preview: { select: { title: 'title', subtitle: 'status', media: 'poster' } }
  }),
  defineType({
    name: 'post',
    title: 'Blog Post',
    type: 'document',
    fields: [
      defineField({ name: 'title', title: 'Title', type: 'string', validation: rule => rule.required() }),
      defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title' } }),
      defineField({ name: 'excerpt', title: 'Excerpt', type: 'text', rows: 3 }),
      defineField({ name: 'body', title: 'Body', type: 'text', rows: 12 }),
      defineField({ name: 'publishedAt', title: 'Publish Date', type: 'datetime' }),
      defineField({ name: 'isDeleted', title: 'Pending Deletion', type: 'boolean', hidden: true, readOnly: true })
    ],
    preview: { select: { title: 'title', subtitle: 'publishedAt' } }
  }),
  defineType({
    name: 'libraryItem',
    title: 'Media Library Item',
    type: 'document',
    fields: [
      defineField({ name: 'title', title: 'Title', type: 'string', validation: rule => rule.required() }),
      defineField({
        name: 'kind',
        title: 'Media Type',
        type: 'string',
        options: { list: [{ title: 'Image', value: 'image' }, { title: 'Video', value: 'video' }, { title: 'Document', value: 'document' }] }
      }),
      defineField({ name: 'artist', title: 'Artist', type: 'string' }),
      defineField({ name: 'category', title: 'Category', type: 'string' }),
      defineField({ name: 'description', title: 'Description', type: 'text', rows: 4 }),
      defineField({ name: 'image', title: 'Image Asset', type: 'image' }),
      defineField({ name: 'file', title: 'File Asset', type: 'file' }),
      defineField({ name: 'assetUrl', title: 'Asset URL', type: 'url' }),
      defineField({ name: 'assetRef', title: 'Asset Reference ID', type: 'string', hidden: true }),
      defineField({ name: 'page', title: 'Page', type: 'string' }),
      defineField({ name: 'isDeleted', title: 'Pending Deletion', type: 'boolean', hidden: true, readOnly: true })
    ],
    preview: { select: { title: 'title', subtitle: 'kind', media: 'image' } }
  }),
  defineType({
    name: 'journalFolder',
    title: 'News & Gallery Folder',
    type: 'document',
    groups: [
      { name: 'folderDetails', title: 'Folder Details', default: true },
      { name: 'legacyPresentation', title: 'Legacy Page Presentation' }
    ],
    fields: [
      defineField({ name: 'title', title: 'Folder Name', type: 'string', group: 'folderDetails', validation: rule => rule.required() }),
      defineField({
        name: 'category',
        title: 'Folder Type',
        type: 'string',
        group: 'folderDetails',
        options: { list: ['School', 'Gallery Program', 'Partnership', 'Collaboration', 'Gallery News', 'Other'] }
      }),
      defineField({
        name: 'parentFolderId',
        title: 'Parent Folder ID',
        description: 'Manage parent folders in the News & Gallery dashboard.',
        type: 'string',
        group: 'folderDetails',
        hidden: true,
        readOnly: true
      }),
      defineField({ name: 'description', title: 'Folder Description', type: 'text', group: 'folderDetails', rows: 3 }),
      defineField({ name: 'cover', title: 'Folder Cover', type: 'image', group: 'folderDetails', options: { hotspot: true } }),
      defineField({ name: 'organization', title: 'School / Organization', type: 'string', group: 'legacyPresentation' }),
      defineField({ name: 'eyebrow', title: 'Folder Label', type: 'string', group: 'legacyPresentation' }),
      defineField({ name: 'coverHeading', title: 'Cover Heading', type: 'string', group: 'legacyPresentation' }),
      defineField({ name: 'coverSubheading', title: 'Cover Subheading', type: 'string', group: 'legacyPresentation' }),
      defineField({ name: 'updateText', title: 'Update Link Text', type: 'string', group: 'legacyPresentation' }),
      defineField({ name: 'updateUrl', title: 'Update Link URL', type: 'url', group: 'legacyPresentation' }),
      defineField({ name: 'slug', title: 'URL Slug', type: 'string', group: 'legacyPresentation' }),
      defineField({ name: 'coverUrl', title: 'Folder Cover URL', type: 'url', group: 'legacyPresentation' }),
      defineField({ name: 'pendingCoverAssetCleanup', title: 'Pending Cover Asset Cleanup', type: 'array', of: [defineArrayMember({ type: 'string' })], hidden: true, readOnly: true }),
      defineField({ name: 'isDeleted', title: 'Pending Deletion', type: 'boolean', hidden: true, readOnly: true })
    ],
    preview: { select: { title: 'title', subtitle: 'category', media: 'cover' } }
  }),
  defineType({
    name: 'journalEntry',
    title: 'News & Gallery Entry',
    type: 'document',
    fields: [
      defineField({ name: 'title', title: 'Title', type: 'string', validation: rule => rule.required() }),
      defineField({ name: 'slug', title: 'URL Slug', type: 'string' }),
      defineField({
        name: 'folderId',
        title: 'News & Gallery Folder',
        type: 'string',
        hidden: ({ document }) => document?.destination === 'tv' || document?.entryType === 'ARTGALZIM TV',
        validation: rule => rule.custom((value, context) => {
          const isTv = context.document?.destination === 'tv' || context.document?.entryType === 'ARTGALZIM TV';
          return isTv || value ? true : 'Choose a folder for News & Gallery entries.';
        })
      }),
      defineField({
        name: 'folderTitle',
        title: 'Folder Name',
        type: 'string',
        hidden: ({ document }) => document?.destination === 'tv' || document?.entryType === 'ARTGALZIM TV'
      }),
      defineField({
        name: 'entryType',
        title: 'Entry Type',
        type: 'string',
        options: { list: ['News', 'Program', 'Event', 'Partnership', 'Collaboration', 'Story', 'Newsletter', { title: 'ARTGALZIM TV (legacy)', value: 'ARTGALZIM TV' }] }
      }),
      defineField({
        name: 'destination',
        title: 'Content Section',
        description: 'Choose whether this item appears in News & Gallery or ARTGALZIM TV.',
        type: 'string',
        options: { list: [{ title: 'News & Gallery', value: 'journal' }, { title: 'ARTGALZIM TV', value: 'tv' }] }
      }),
      defineField({
        name: 'mediaType',
        title: 'Embedded Media Format',
        type: 'string',
        options: { list: [{ title: 'Video (YouTube / direct video)', value: 'video' }, { title: 'Document (Google Drive / PDF)', value: 'document' }, { title: 'Instagram post / reel', value: 'social' }] }
      }),
      defineField({ name: 'mediaUrl', title: 'Video / Document / Social URL', type: 'url' }),
      defineField({
        name: 'videoOrientation',
        title: 'ARTGALZIM TV Layout',
        type: 'string',
        options: { list: [{ title: 'Landscape video', value: 'landscape' }, { title: 'Short (portrait)', value: 'portrait' }] }
      }),
      defineField({
        name: 'artistCurator',
        title: 'Artist / Curator',
        type: 'string',
        hidden: ({ document }) => document?.destination === 'tv' || document?.entryType === 'ARTGALZIM TV'
      }),
      defineField({
        name: 'category',
        title: 'Category',
        type: 'string',
        hidden: ({ document }) => document?.destination === 'tv' || document?.entryType === 'ARTGALZIM TV'
      }),
      defineField({ name: 'excerpt', title: 'Description', type: 'text', rows: 3 }),
      defineField({ name: 'body', title: 'Article (formatting is available in the admin editor)', type: 'text', rows: 14 }),
      defineField({ name: 'eventDate', title: 'Program / Event Date', type: 'date' }),
      defineField({ name: 'endDate', title: 'End Date', type: 'date' }),
      defineField({ name: 'location', title: 'Location', type: 'string' }),
      defineField({ name: 'author', title: 'Author / Reporter', type: 'string' }),
      defineField({ name: 'publishedAt', title: 'Publish Date', type: 'datetime' }),
      defineField({ name: 'image', title: 'Story Image', type: 'image', options: { hotspot: true } }),
      defineField({
        name: 'images',
        title: 'Story Image Gallery',
        description: 'Optional additional images uploaded with the story.',
        type: 'array',
        hidden: ({ document }) => document?.destination === 'tv' || document?.entryType === 'ARTGALZIM TV',
        of: [{ type: 'image', options: { hotspot: true } }]
      }),
      defineField({ name: 'attachment', title: 'Document / Media Attachment', type: 'file' }),
      defineField({ name: 'imageUrl', title: 'Story Image URL', type: 'url' }),
      defineField({ name: 'attachmentUrl', title: 'Attachment URL', type: 'url' }),
      defineField({ name: 'attachmentName', title: 'Attachment Name', type: 'string' }),
      defineField({ name: 'isDeleted', title: 'Pending Deletion', type: 'boolean', hidden: true, readOnly: true })
    ],
    preview: { select: { title: 'title', subtitle: 'folderTitle', media: 'image' } }
  }),
  defineType({
    name: 'siteContent',
    title: 'Site Content',
    type: 'document',
    fields: [
      defineField({ name: 'payload', title: 'Content JSON', type: 'text', rows: 20 }),
      defineField({ name: 'updatedAt', title: 'Last Updated', type: 'datetime', readOnly: true })
    ],
    preview: { prepare: () => ({ title: 'Site Content Configuration' }) }
  })
];
