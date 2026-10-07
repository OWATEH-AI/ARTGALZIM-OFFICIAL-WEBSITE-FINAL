import assert from 'node:assert/strict';
import test from 'node:test';
import { createSanityGateway } from '../sanity-gateway.js';

function createSanityMock() {
  const documents = new Map();
  documents.queries = [];
  documents.uploads = [];
  documents.operations = [];
  let assetSequence = 0;

  globalThis.fetch = async (input, options = {}) => {
    const url = input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
    const method = options.method || 'GET';

    if (url.pathname.includes('/data/query/')) {
      const groq = url.searchParams.get('query') || '';
      documents.queries.push(groq);
      let found = [...documents.values()];
      if (groq.includes('_id match "drafts.*"')) {
        found = found.filter(document => document._id.startsWith('drafts.'));
      }
      const typeMatch = groq.match(/_type == ("(?:\\.|[^"])*")/);
      if (typeMatch) {
        const type = JSON.parse(typeMatch[1]);
        found = found.filter(document => document._type === type);
      } else {
        const typeListMatch = groq.match(/_type in \[([^\]]+)\]/);
        if (typeListMatch) {
          const types = [...typeListMatch[1].matchAll(/"(?:\\.|[^"])*"/g)].map(match => JSON.parse(match[0]));
          found = found.filter(document => types.includes(document._type));
        }
      }
      const sourceMatch = groq.match(/sourcePath == ("(?:\\.|[^"])*")/);
      if (sourceMatch) {
        const sourcePath = JSON.parse(sourceMatch[1]);
        found = found.filter(document => document.sourcePath === sourcePath);
      }
      const ids = [...groq.matchAll(/_id == ("(?:\\.|[^"])*")/g)].map(match => JSON.parse(match[1]));
      if (ids.length) found = found.filter(document => ids.includes(document._id));
      const dashboardIdMatch = groq.match(/id == ("(?:\\.|[^"])*")/);
      if (dashboardIdMatch) {
        const dashboardId = JSON.parse(dashboardIdMatch[1]);
        found = found.filter(document => document.id === dashboardId || ids.includes(document._id));
      }
      if (groq.includes('[0]')) found = found.slice(0, 1);
      return Response.json({ result: found });
    }

    if (url.pathname.includes('/data/mutate/')) {
      const { mutations = [] } = JSON.parse(options.body || '{}');
      for (const mutation of mutations) {
        if (mutation.createOrReplace) {
          documents.set(mutation.createOrReplace._id, mutation.createOrReplace);
        } else if (mutation.patch) {
          const current = documents.get(mutation.patch.id);
          documents.set(mutation.patch.id, { ...current, ...mutation.patch.set });
          documents.operations.push('sanity-mirror');
        } else if (mutation.delete) {
          documents.delete(mutation.delete.id);
        }
      }
      return Response.json({ transactionId: 'mock-transaction' });
    }

    if (url.pathname.includes('/assets/')) {
      const isImage = url.pathname.includes('/assets/images/');
      const id = `${isImage ? 'image' : 'file'}-mock-${++assetSequence}`;
      const filename = url.searchParams.get('filename') || 'asset';
      documents.uploads.push({ path: url.pathname, contentType: options.headers?.['content-type'] });
      return Response.json({
        document: {
          _id: id,
          _type: isImage ? 'sanity.imageAsset' : 'sanity.fileAsset',
          url: `https://cdn.sanity.io/${isImage ? 'images' : 'files'}/mock/${id}/${filename}`
        }
      });
    }

    throw new Error(`Unexpected mocked fetch: ${method} ${url.href}`);
  };

  return documents;
}

test('dashboard artist, folder, artwork and content actions stay in sync with Sanity documents', async () => {
  const originalFetch = globalThis.fetch;
  const documents = createSanityMock();
  const gateway = createSanityGateway({
    SANITY_API_TOKEN: 'test-token',
    ADMIN_PASSWORD: 'test-password',
    ADMIN_SESSION_SECRET: 'test-session-secret'
  });

  async function request(path, { method = 'GET', body, headers = {} } = {}) {
    return gateway(new Request(`https://example.test${path}`, {
      method,
      headers: { ...headers, ...(body instanceof FormData ? {} : {}) },
      ...(body === undefined ? {} : body instanceof FormData
        ? { body }
        : { headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
    }));
  }

  try {
    const login = await request('/api/login', { method: 'POST', body: { password: 'test-password' } });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];

    const authenticatedRequest = (path, options = {}) => request(path, {
      ...options,
      headers: { ...options.headers, cookie }
    });

    const createdArtist = await authenticatedRequest('/api/create-artist-folder', {
      method: 'POST',
      body: { artist: 'Student Example', category: 'Artworks', tier: 'Student Artists' }
    });
    assert.equal(createdArtist.status, 200);
    assert.deepEqual((await createdArtist.json()).folders, ['Artworks']);
    assert.deepEqual(documents.get('drafts.artist-student-example'), {
      name: 'Student Example',
      tier: 'Student Artists',
      _id: 'drafts.artist-student-example',
      _type: 'artist'
    });
    assert.deepEqual(documents.get('drafts.album-student-example-artworks'), {
      artist: 'Student Example',
      name: 'Artworks',
      coverSrc: '',
      _id: 'drafts.album-student-example-artworks',
      _type: 'album'
    });

    const addedAlbum = await authenticatedRequest('/api/create-artist-folder', {
      method: 'POST',
      body: { artist: 'Student Example', category: 'Sketchbook' }
    });
    assert.equal(addedAlbum.status, 200);
    assert.equal((await addedAlbum.json()).tier, 'Student Artists');

    let artistList = await authenticatedRequest('/api/artists');
    assert.equal(artistList.status, 200);
    let artist = (await artistList.json()).find(item => item.name === 'Student Example');
    assert.equal(artist.tier, 'Student Artists');
    assert.deepEqual(artist.categories.map(item => item.name).sort(), ['Artworks', 'Sketchbook']);

    const upload = new FormData();
    upload.set('artist', 'Student Example');
    upload.set('category', 'Sketchbook');
    upload.set('title', 'Student Work');
    upload.set('medium', 'Acrylic');
    upload.set('size', '40 x 50 cm');
    upload.set('year', '2025');
    upload.set('price', '$120');
    upload.set('purchaseType', 'inquire');
    upload.set('description', 'A test artwork description.');
    upload.append('images', new Blob(['artwork-bytes'], { type: 'image/jpeg' }), 'student-work.jpg');
    const uploadResponse = await authenticatedRequest('/api/upload-artwork', { method: 'POST', body: upload });
    assert.equal(uploadResponse.status, 200);
    let artwork = [...documents.values()].find(document => document._type === 'artwork');
    assert.equal(artwork.artistTier, 'Student Artists');
    assert.equal(artwork.category, 'Sketchbook');
    assert.equal(artwork.title, 'Student Work');
    assert.equal(artwork.medium, 'Acrylic');
    assert.equal(artwork.size, '40 x 50 cm');
    assert.equal(artwork.year, '2025');
    assert.equal(artwork.price, '$120');
    assert.equal(artwork.description, 'A test artwork description.');
    assert.equal(artwork.image.asset._ref.startsWith('image-mock-'), true);

    const setCover = await authenticatedRequest('/api/set-album-cover', {
      method: 'POST',
      body: { artist: 'Student Example', category: 'Sketchbook', src: artwork.imageUrl }
    });
    assert.equal(setCover.status, 200);

    const updatedTier = await authenticatedRequest('/api/update-artist-tier', {
      method: 'POST',
      body: { artist: 'Student Example', tier: 'Keith Zenda' }
    });
    assert.equal(updatedTier.status, 200);
    artwork = [...documents.values()].find(document => document._type === 'artwork');
    assert.equal(artwork.artistTier, 'Keith Zenda');

    const artworkEdit = new FormData();
    artworkEdit.set('originalSrc', artwork.sourcePath);
    artworkEdit.set('title', 'Edited Studio Work');
    artworkEdit.set('artist', 'Student Example');
    artworkEdit.set('category', 'Sketchbook');
    artworkEdit.set('medium', 'Oil on canvas');
    artworkEdit.set('size', '50 x 60 cm');
    artworkEdit.set('year', '2024');
    artworkEdit.set('price', '$200');
    artworkEdit.set('purchaseType', 'direct');
    artworkEdit.set('paymentLink', 'https://payments.example.test/student-work');
    artworkEdit.set('description', 'Updated description.');
    const editResponse = await authenticatedRequest('/api/edit-artwork', { method: 'POST', body: artworkEdit });
    assert.equal(editResponse.status, 200);
    artwork = [...documents.values()].find(document => document._type === 'artwork');
    assert.equal(artwork.title, 'Edited Studio Work');
    assert.equal(artwork.medium, 'Oil on canvas');
    assert.equal(artwork.paymentLink, 'https://payments.example.test/student-work');

    const deletion = await authenticatedRequest('/api/delete-artwork', {
      method: 'DELETE',
      body: { src: 'ARTISTS/Student Example/Sketchbook/student-work.jpg' }
    });
    assert.equal(deletion.status, 200);
    assert.equal([...documents.values()].find(document => document._type === 'artwork').isDeleted, true);

    const createdPost = await authenticatedRequest('/api/posts', {
      method: 'POST',
      body: { title: 'Studio-managed post', body: 'Post content' }
    });
    const postId = (await createdPost.json()).id;
    assert.equal(createdPost.status, 200);
    const deletedPost = await authenticatedRequest(`/api/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' });
    assert.equal(deletedPost.status, 200);
    assert.equal(documents.get(`drafts.${postId}`).isDeleted, true);

    const exhibitionForm = new FormData();
    exhibitionForm.set('id', 'event-test');
    exhibitionForm.set('title', 'Studio-managed event');
    exhibitionForm.set('registrationFee', '$15');
    exhibitionForm.set('contactLink', 'https://artgalzim.com/contact');
    exhibitionForm.set('isPlaceholder', 'true');
    exhibitionForm.set('displayDateOverride', 'Follow our socials for updates');
    exhibitionForm.set('artist', 'Student Example');
    exhibitionForm.set('startDate', '2026-07-10');
    exhibitionForm.set('endDate', '2026-07-12');
    exhibitionForm.set('startTime', '10:00');
    exhibitionForm.set('endTime', '17:30');
    exhibitionForm.set('location', 'Main Gallery');
    exhibitionForm.set('category', 'Mixed Media');
    exhibitionForm.set('theme', 'Roots and Rhythms');
    exhibitionForm.set('description', 'A test exhibition.');
    exhibitionForm.set('status', 'upcoming');
    exhibitionForm.set('registrationLink', 'https://forms.example.test/register');
    exhibitionForm.set('ctaText', 'Register');
    exhibitionForm.set('timeRange', '10:00 – 17:30');
    exhibitionForm.set('conditions', 'Registration required.');
    exhibitionForm.set('registrationFee', '$15');
    exhibitionForm.append('image', new Blob(['poster-bytes'], { type: 'image/jpeg' }), 'event-poster.jpg');
    const createdExhibition = await authenticatedRequest('/api/exhibitions', {
      method: 'POST',
      body: exhibitionForm
    });
    assert.equal(createdExhibition.status, 200);
    const exhibition = documents.get('drafts.event-test');
    assert.equal(exhibition.title, 'Studio-managed event');
    assert.equal(exhibition.artist, 'Student Example');
    assert.equal(exhibition.startDate, '2026-07-10');
    assert.equal(exhibition.endDate, '2026-07-12');
    assert.equal(exhibition.startTime, '10:00');
    assert.equal(exhibition.endTime, '17:30');
    assert.equal(exhibition.location, 'Main Gallery');
    assert.equal(exhibition.category, 'Mixed Media');
    assert.equal(exhibition.theme, 'Roots and Rhythms');
    assert.equal(exhibition.description, 'A test exhibition.');
    assert.equal(exhibition.status, 'upcoming');
    assert.equal(exhibition.registrationLink, 'https://forms.example.test/register');
    assert.equal(exhibition.contactLink, 'https://artgalzim.com/contact');
    assert.equal(exhibition.ctaText, 'Register');
    assert.equal(exhibition.timeRange, '10:00 – 17:30');
    assert.equal(exhibition.conditions, 'Registration required.');
    assert.equal(exhibition.registrationFee, '$15');
    assert.equal(exhibition.isPlaceholder, true);
    assert.equal(exhibition.displayDateOverride, 'Follow our socials for updates');
    assert.equal(exhibition.poster.asset._ref.startsWith('image-mock-'), true);
    assert.match(exhibition.imageUrl, /^https:\/\/cdn\.sanity\.io\/images\/mock\//);
    const adminExhibitions = await authenticatedRequest('/api/exhibitions');
    assert.equal(adminExhibitions.status, 200);
    const listedExhibition = (await adminExhibitions.json()).find(item => item.id === 'event-test');
    assert.equal(listedExhibition.registrationFee, '$15');
    assert.equal(listedExhibition.contactLink, 'https://artgalzim.com/contact');
    assert.equal(listedExhibition.displayDateOverride, 'Follow our socials for updates');
    const deletedExhibition = await authenticatedRequest('/api/exhibitions/event-test', { method: 'DELETE' });
    assert.equal(deletedExhibition.status, 200);
    assert.equal(documents.get('drafts.event-test').isDeleted, true);

    const journalFolderForm = new FormData();
    journalFolderForm.set('title', 'Domboshava School');
    journalFolderForm.set('category', 'School');
    journalFolderForm.set('organization', 'Domboshava Primary');
    journalFolderForm.set('description', 'School arts activities and partnerships.');
    journalFolderForm.append('cover', new Blob(['cover-bytes'], { type: 'image/jpeg' }), 'school-cover.jpg');
    const createdJournalFolder = await authenticatedRequest('/api/journal/folders', {
      method: 'POST',
      body: journalFolderForm
    });
    assert.equal(createdJournalFolder.status, 200);
    const folderId = (await createdJournalFolder.json()).id;
    const journalFolder = documents.get(`drafts.${folderId}`);
    assert.equal(journalFolder.title, 'Domboshava School');
    assert.equal(journalFolder.category, 'School');
    assert.equal(journalFolder.organization, 'Domboshava Primary');
    assert.equal(journalFolder.cover.asset._ref.startsWith('image-mock-'), true);
    const editJournalFolder = new FormData();
    editJournalFolder.set('id', folderId);
    editJournalFolder.set('title', 'Domboshava Arts Partnership');
    editJournalFolder.set('category', 'Partnership');
    editJournalFolder.set('organization', 'Domboshava Primary');
    editJournalFolder.set('description', 'Updated folder description.');
    const updatedJournalFolder = await authenticatedRequest('/api/journal/folders', {
      method: 'POST',
      body: editJournalFolder
    });
    assert.equal(updatedJournalFolder.status, 200);
    assert.equal(documents.get(`drafts.${folderId}`).title, 'Domboshava Arts Partnership');
    assert.equal(documents.get(`drafts.${folderId}`).cover.asset._ref, journalFolder.cover.asset._ref);

    const journalEntryForm = new FormData();
    journalEntryForm.set('folderId', folderId);
    journalEntryForm.set('destination', 'journal');
    journalEntryForm.set('entryType', 'Program');
    journalEntryForm.set('title', 'Student Art Workshop');
    journalEntryForm.set('excerpt', 'A day of collaborative art making.');
    journalEntryForm.set('body', 'Students and artists worked together.');
    journalEntryForm.set('eventDate', '2026-06-15');
    journalEntryForm.set('endDate', '2026-06-16');
    journalEntryForm.set('location', 'Domboshava Primary');
    journalEntryForm.set('author', 'Gallery team');
    journalEntryForm.set('mediaType', 'video');
    journalEntryForm.set('mediaUrl', 'https://www.youtube.com/watch?v=abcDEF12345');
    journalEntryForm.append('image', new Blob(['story-image'], { type: 'image/jpeg' }), 'workshop.jpg');
    journalEntryForm.append('attachment', new Blob(['report-bytes'], { type: 'application/pdf' }), 'workshop-report.pdf');
    const createdJournalEntry = await authenticatedRequest('/api/journal/entries', {
      method: 'POST',
      body: journalEntryForm
    });
    assert.equal(createdJournalEntry.status, 200);
    const entryId = (await createdJournalEntry.json()).id;
    const journalEntry = documents.get(`drafts.${entryId}`);
    assert.equal(journalEntry.folderId, folderId);
    assert.equal(journalEntry.folderTitle, 'Domboshava Arts Partnership');
    assert.equal(journalEntry.destination, 'journal');
    assert.equal(journalEntry.entryType, 'Program');
    assert.equal(journalEntry.eventDate, '2026-06-15');
    assert.equal(journalEntry.endDate, '2026-06-16');
    assert.equal(journalEntry.mediaType, 'video');
    assert.equal(journalEntry.mediaUrl, 'https://www.youtube.com/watch?v=abcDEF12345');
    assert.equal(journalEntry.image.asset._ref.startsWith('image-mock-'), true);
    assert.equal(journalEntry.attachment.asset._ref.startsWith('file-mock-'), true);
    assert.equal(journalEntry.attachmentName, 'workshop-report.pdf');
    for (const [mediaType, mediaUrl] of [
      ['social', 'https://www.instagram.com/reel/AbCdEf12345/'],
      ['document', 'https://drive.google.com/file/d/1AbCdEf1234567890/view'],
      ['document', 'https://gallery.example.test/newsletter.pdf'],
      ['video', 'https://cdn.example.test/gallery-tour.mp4']
    ]) {
      const mediaUpdate = new FormData();
      mediaUpdate.set('id', entryId);
      mediaUpdate.set('folderId', folderId);
      mediaUpdate.set('entryType', 'Newsletter');
      mediaUpdate.set('title', 'Student Art Workshop');
      mediaUpdate.set('mediaType', mediaType);
      mediaUpdate.set('mediaUrl', mediaUrl);
      const mediaResponse = await authenticatedRequest('/api/journal/entries', {
        method: 'POST',
        body: mediaUpdate
      });
      assert.equal(mediaResponse.status, 200, `${mediaType} URL should be accepted`);
      assert.equal(documents.get(`drafts.${entryId}`).mediaUrl, mediaUrl);
    }
    const tvEntryForm = new FormData();
    tvEntryForm.set('destination', 'tv');
    tvEntryForm.set('entryType', 'Program');
    tvEntryForm.set('title', 'Gallery video feature');
    tvEntryForm.set('mediaType', 'video');
    tvEntryForm.set('mediaUrl', 'https://www.youtube.com/watch?v=abcDEF12345');
    const createdTvEntry = await authenticatedRequest('/api/journal/entries', {
      method: 'POST',
      body: tvEntryForm
    });
    assert.equal(createdTvEntry.status, 200);
    const tvEntryId = (await createdTvEntry.json()).id;
    assert.equal(documents.get(`drafts.${tvEntryId}`).destination, 'tv');
    assert.equal(documents.get(`drafts.${tvEntryId}`).folderId, '');

    const uploadedTvEntryForm = new FormData();
    uploadedTvEntryForm.set('destination', 'tv');
    uploadedTvEntryForm.set('entryType', 'Program');
    uploadedTvEntryForm.set('title', 'Uploaded gallery tour');
    uploadedTvEntryForm.append('attachment', new Blob(['video-bytes'], { type: 'video/mp4' }), 'gallery-tour.mp4');
    uploadedTvEntryForm.append('image', new Blob(['poster-bytes'], { type: 'image/jpeg' }), 'gallery-tour-poster.jpg');
    const uploadedTvEntryResponse = await authenticatedRequest('/api/journal/entries', {
      method: 'POST',
      body: uploadedTvEntryForm
    });
    assert.equal(uploadedTvEntryResponse.status, 200);
    const uploadedTvEntryId = (await uploadedTvEntryResponse.json()).id;
    const uploadedTvEntry = documents.get(`drafts.${uploadedTvEntryId}`);
    assert.equal(uploadedTvEntry.mediaType, 'video');
    assert.equal(uploadedTvEntry.mediaUrl, '');
    assert.equal(uploadedTvEntry.attachment.asset._ref.startsWith('file-mock-'), true);
    assert.equal(uploadedTvEntry.attachmentName, 'gallery-tour.mp4');
    assert.match(uploadedTvEntry.attachmentUrl, /^https:\/\/cdn\.sanity\.io\/files\/mock\//);
    assert.equal(uploadedTvEntry.image.asset._ref.startsWith('image-mock-'), true);
    assert.ok(documents.uploads.some(upload => upload.path.includes('/assets/files/')
      && upload.contentType === 'video/mp4'));

    const invalidTvEntry = new FormData();
    invalidTvEntry.set('destination', 'tv');
    invalidTvEntry.set('title', 'Document on TV');
    invalidTvEntry.set('mediaType', 'document');
    invalidTvEntry.set('mediaUrl', 'https://drive.google.com/file/d/1AbCdEf1234567890/view');
    const rejectedTvEntry = await authenticatedRequest('/api/journal/entries', {
      method: 'POST',
      body: invalidTvEntry
    });
    assert.equal(rejectedTvEntry.status, 400);
    assert.match((await rejectedTvEntry.json()).error, /supported video link or an MP4, WebM, or Ogg video upload/);

    const publicContent = await request('/api/public-content');
    assert.equal(publicContent.status, 200);
    assert.match(documents.queries.at(-1), /"journalFolder", "journalEntry"/);
    assert.match(documents.queries.at(-1), /attachment\.asset->url/);
    assert.match(documents.queries.at(-1), /"fileUrl": coalesce\(file\.asset->url, attachment\.asset->url, attachmentUrl\)/);
    assert.match(documents.queries.at(-1), /cover\.asset->url/);
    assert.match(documents.queries.at(-1), /folderId, folderTitle, entryType, destination, mediaType/);

    const invalidMedia = new FormData();
    invalidMedia.set('folderId', folderId);
    invalidMedia.set('destination', 'tv');
    invalidMedia.set('entryType', 'News');
    invalidMedia.set('title', 'Unsupported Embed');
    invalidMedia.set('mediaType', 'video');
    invalidMedia.set('mediaUrl', 'https://example.com/watch');
    const rejectedMedia = await authenticatedRequest('/api/journal/entries', {
      method: 'POST',
      body: invalidMedia
    });
    assert.equal(rejectedMedia.status, 400);
    assert.match((await rejectedMedia.json()).error, /YouTube link or direct video file/);

    const journalFolders = await authenticatedRequest('/api/journal/folders');
    assert.equal((await journalFolders.json()).some(folder => folder._id === folderId), true);
    const journalEntries = await authenticatedRequest('/api/journal/entries');
    assert.equal((await journalEntries.json()).some(entry => entry._id === entryId), true);
    const folderInUseDelete = await authenticatedRequest(`/api/journal/folders/${encodeURIComponent(folderId)}`, {
      method: 'DELETE'
    });
    assert.equal(folderInUseDelete.status, 409);

    const editJournalEntry = new FormData();
    editJournalEntry.set('id', entryId);
    editJournalEntry.set('folderId', folderId);
    editJournalEntry.set('entryType', 'News');
    editJournalEntry.set('title', 'Updated Student Art Workshop');
    editJournalEntry.set('excerpt', 'Updated introduction.');
    editJournalEntry.set('body', 'Updated story body.');
    editJournalEntry.set('eventDate', '2026-06-17');
    editJournalEntry.set('mediaType', 'video');
    editJournalEntry.set('mediaUrl', journalEntry.mediaUrl);
    const updatedJournalEntry = await authenticatedRequest('/api/journal/entries', {
      method: 'POST',
      body: editJournalEntry
    });
    assert.equal(updatedJournalEntry.status, 200);
    assert.equal(documents.get(`drafts.${entryId}`).title, 'Updated Student Art Workshop');
    assert.equal(documents.get(`drafts.${entryId}`).folderTitle, 'Domboshava Arts Partnership');
    assert.equal(documents.get(`drafts.${entryId}`).mediaUrl, journalEntry.mediaUrl);
    assert.equal(documents.get(`drafts.${entryId}`).image.asset._ref, journalEntry.image.asset._ref);
    assert.equal(documents.get(`drafts.${entryId}`).attachment.asset._ref, journalEntry.attachment.asset._ref);

    const deleteJournalEntry = await authenticatedRequest(`/api/journal/entries/${encodeURIComponent(entryId)}`, {
      method: 'DELETE'
    });
    assert.equal(deleteJournalEntry.status, 200);
    assert.equal(documents.get(`drafts.${entryId}`).isDeleted, true);
    const deleteJournalFolder = await authenticatedRequest(`/api/journal/folders/${encodeURIComponent(folderId)}`, {
      method: 'DELETE'
    });
    assert.equal(deleteJournalFolder.status, 200);
    assert.equal(documents.get(`drafts.${folderId}`).isDeleted, true);

    const libraryUpload = new FormData();
    libraryUpload.set('title', 'Test media');
    libraryUpload.set('kind', 'document');
    libraryUpload.append('file', new Blob(['media-bytes'], { type: 'application/pdf' }), 'test.pdf');
    const createdMedia = await authenticatedRequest('/api/library', { method: 'POST', body: libraryUpload });
    assert.equal(createdMedia.status, 200);
    const mediaId = (await createdMedia.json()).id;
    const updateMedia = await authenticatedRequest('/api/library/update', {
      method: 'POST',
      body: { id: mediaId, title: 'Updated test media', description: 'Media metadata updated' }
    });
    assert.equal(updateMedia.status, 200);
    assert.equal(documents.get(`drafts.${mediaId}`).title, 'Updated test media');
    const deletedMedia = await authenticatedRequest(`/api/library/${encodeURIComponent(mediaId)}`, { method: 'DELETE' });
    assert.equal(deletedMedia.status, 200);
    assert.equal(documents.get(`drafts.${mediaId}`).isDeleted, true);

    const content = await authenticatedRequest('/api/content', {
      method: 'POST',
      body: { homeTitle: 'Updated from dashboard', welcomeText: 'Sanity-backed content' }
    });
    assert.equal(content.status, 200);
    const savedContent = await authenticatedRequest('/api/content');
    assert.deepEqual(await savedContent.json(), { homeTitle: 'Updated from dashboard', welcomeText: 'Sanity-backed content' });

    const missingDelete = await authenticatedRequest('/api/library/not-found', { method: 'DELETE' });
    assert.equal(missingDelete.status, 404);

    const sync = await authenticatedRequest('/api/sync', { method: 'POST' });
    assert.equal(sync.status, 200);
    assert.equal(documents.has('drafts.artist-student-example'), false);
    assert.equal(documents.has('drafts.album-student-example-sketchbook'), false);
    assert.equal(documents.has('artwork-student-example-sketchbook-student-work-jpg'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
