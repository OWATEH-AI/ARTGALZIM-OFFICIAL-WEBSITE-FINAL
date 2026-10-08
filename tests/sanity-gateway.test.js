import assert from 'node:assert/strict';
import test from 'node:test';
import { createSanityGateway } from '../sanity-gateway.js';
import { getTvVideoOrientation, groupTvVideos } from '../js/tv-layout.js';

test('TV video orientation keeps Shorts separate and defaults unknown media to landscape', () => {
  const landscape = { _id: 'landscape', mediaUrl: 'https://www.youtube.com/watch?v=abcDEF12345' };
  const short = { _id: 'short', mediaUrl: 'https://youtube.com/shorts/abcDEF12345' };
  const explicitlyLandscape = {
    _id: 'overridden-short',
    mediaUrl: 'https://youtube.com/shorts/abcDEF12345',
    videoOrientation: 'landscape'
  };
  const explicitPortrait = { _id: 'portrait', videoOrientation: 'portrait' };
  const unknownProvider = { _id: 'unknown', mediaUrl: 'https://video.example.test/watch/123' };

  assert.equal(getTvVideoOrientation(landscape), 'landscape');
  assert.equal(getTvVideoOrientation(short), 'portrait');
  assert.equal(getTvVideoOrientation(explicitlyLandscape), 'landscape');
  assert.equal(getTvVideoOrientation(explicitPortrait), 'portrait');
  assert.equal(getTvVideoOrientation(unknownProvider), 'landscape');
  assert.deepEqual(groupTvVideos([landscape, short, explicitlyLandscape, explicitPortrait, unknownProvider]), {
    landscape: [landscape, explicitlyLandscape, unknownProvider],
    shorts: [short, explicitPortrait]
  });
});

test('public gallery keeps album cover metadata as source of truth for empty folders without inventing artwork content', async () => {
  const originalFetch = globalThis.fetch;
  const documents = createSanityMock();
  const gateway = createSanityGateway({
    SANITY_API_TOKEN: 'test-token',
    ADMIN_PASSWORD: 'test-password',
    ADMIN_SESSION_SECRET: 'test-session-secret'
  });

  documents.set('drafts.album-samuel-t-samoyo-abstract', {
    _id: 'drafts.album-samuel-t-samoyo-abstract',
    _type: 'album',
    artist: 'Samuel T Samoyo',
    name: 'Abstract',
    coverSrc: 'https://cdn.sanity.io/images/mock/abstract-draft.jpg'
  });
  documents.set('album-samuel-t-samoyo-abstract', {
    _id: 'album-samuel-t-samoyo-abstract',
    _type: 'album',
    artist: 'Samuel T Samoyo',
    name: 'Abstract',
    coverSrc: 'https://cdn.sanity.io/images/mock/abstract-published.jpg'
  });

  try {
    const response = await gateway(new Request('https://example.test/api/public-gallery'));
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.deepEqual(payload.data.artistsCollections['Samuel T Samoyo/Abstract'], {
      images: [],
      cover: 'https://cdn.sanity.io/images/mock/abstract-published.jpg'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function createSanityMock() {
  const documents = new Map();
  documents.queries = [];
  documents.uploads = [];
  documents.operations = [];
  documents.deletedAssets = [];
  let assetSequence = 0;

  globalThis.fetch = async (input, options = {}) => {
    const url = input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
    const method = options.method || 'GET';

    if (url.pathname.includes('/data/query/')) {
      const groq = url.searchParams.get('query') || '';
      documents.queries.push(groq);
      let found = [...documents.values()];
      if (url.searchParams.get('perspective') !== 'raw') {
        found = found.filter(document => !document._id.startsWith('drafts.'));
      }
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
      const urlMatch = groq.match(/\burl == ("(?:\\.|[^"])*")/);
      if (urlMatch) {
        const assetUrl = JSON.parse(urlMatch[1]);
        found = found.filter(document => document.url === assetUrl);
      }
      const assetIdMatch = groq.match(/references\(("(?:\\.|[^"])*")\)/);
      const assetRefMatch = groq.match(/assetRef == ("(?:\\.|[^"])*")/);
      const urlReferenceMatches = [...groq.matchAll(/(?:imageUrl|coverSrc|coverUrl|assetUrl|posterUrl|attachmentUrl) == ("(?:\\.|[^"])*")/g)];
      const imagesUrlMatch = groq.match(/("(?:\\.|[^"])*") in imagesUrl/);
      if (assetIdMatch || assetRefMatch || urlReferenceMatches.length || imagesUrlMatch) {
        const assetId = assetIdMatch ? JSON.parse(assetIdMatch[1]) : null;
        const assetRefId = assetRefMatch ? JSON.parse(assetRefMatch[1]) : null;
        const urls = [
          ...urlReferenceMatches.map(match => JSON.parse(match[1])),
          ...(imagesUrlMatch ? [JSON.parse(imagesUrlMatch[1])] : [])
        ];
        const containsAsset = value => {
          if (Array.isArray(value)) return value.some(containsAsset);
          if (!value || typeof value !== 'object') return false;
          return value._ref === assetId || Object.values(value).some(containsAsset);
        };
        const assetUrlFields = ['imageUrl', 'coverSrc', 'coverUrl', 'assetUrl', 'posterUrl', 'attachmentUrl'];
        found = found.filter(document => containsAsset(document)
          || (assetRefId && document.assetRef === assetRefId)
          || urls.some(url => assetUrlFields.some(field => document[field] === url)
            || (Array.isArray(document.imagesUrl) && document.imagesUrl.includes(url))));
      }
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
          const updated = { ...current, ...mutation.patch.set };
          for (const field of mutation.patch.unset || []) delete updated[field];
          documents.set(mutation.patch.id, updated);
          documents.operations.push('sanity-mirror');
        } else if (mutation.delete) {
          documents.delete(mutation.delete.id);
          if (mutation.delete.id.startsWith('image-')) documents.deletedAssets.push(mutation.delete.id);
        }
      }
      return Response.json({ transactionId: 'mock-transaction' });
    }

    if (url.pathname.includes('/assets/')) {
      const isImage = url.pathname.includes('/assets/images/');
      const id = `${isImage ? 'image' : 'file'}-mock-${++assetSequence}`;
      const filename = url.searchParams.get('filename') || 'asset';
      documents.uploads.push({ path: url.pathname, contentType: options.headers?.['content-type'] });
      documents.set(id, {
        _id: id,
        _type: isImage ? 'sanity.imageAsset' : 'sanity.fileAsset',
        url: `https://cdn.sanity.io/${isImage ? 'images' : 'files'}/mock/${id}/${filename}`
      });
      return Response.json({
        document: documents.get(id)
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

    const unauthorizedCoverForm = new FormData();
    unauthorizedCoverForm.set('artist', 'Student Example');
    unauthorizedCoverForm.set('category', 'Empty Folder');
    unauthorizedCoverForm.append('cover', new Blob(['cover-bytes'], { type: 'image/png' }), 'folder-cover.png');
    const unauthorizedCover = await request('/api/set-folder-cover', {
      method: 'POST',
      body: unauthorizedCoverForm
    });
    assert.equal(unauthorizedCover.status, 401);

    const folderCoverForm = new FormData();
    folderCoverForm.set('artist', 'Student Example');
    folderCoverForm.set('category', 'Empty Folder');
    folderCoverForm.append('cover', new Blob(['cover-bytes'], { type: 'image/png' }), 'folder-cover.png');
    const folderCoverResponse = await authenticatedRequest('/api/set-folder-cover', {
      method: 'POST',
      body: folderCoverForm
    });
    assert.equal(folderCoverResponse.status, 200);
    const folderCoverResult = await folderCoverResponse.json();
    assert.equal(folderCoverResult.ok, true);
    assert.equal(folderCoverResult.draft, true);
    assert.equal(folderCoverResult.publishRequired, true);
    assert.match(folderCoverResult.cover, /^https:\/\/cdn\.sanity\.io\/images\/mock\//);
    assert.equal(documents.get('drafts.album-student-example-empty-folder').coverSrc, folderCoverResult.cover);
    const replacedFolderCoverAssetId = [...documents.values()].find(document => document._type === 'sanity.imageAsset' && document.url === folderCoverResult.cover)._id;
    const unpublishedGalleryResponse = await request('/api/public-gallery');
    const unpublishedGallery = await unpublishedGalleryResponse.json();
    assert.equal(unpublishedGallery.data.artistsCollections['Student Example/Empty Folder'], undefined);

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
    const retainedArtworkAssetId = artwork.image.asset._ref;

    const setCover = await authenticatedRequest('/api/set-album-cover', {
      method: 'POST',
      body: { artist: 'Student Example', category: 'Sketchbook', src: artwork.imageUrl }
    });
    assert.equal(setCover.status, 200);

    documents.set('artwork-cover-retention-test', {
      _id: 'artwork-cover-retention-test',
      _type: 'artwork',
      image: { _type: 'image', asset: { _type: 'reference', _ref: retainedArtworkAssetId } },
      imageUrl: artwork.imageUrl
    });
    const replacementCovers = new FormData();
    replacementCovers.set('artist', 'Student Example');
    replacementCovers.set('category', 'Empty Folder');
    replacementCovers.append('cover', new Blob(['replacement-cover'], { type: 'image/png' }), 'replacement-cover.png');
    const replacedStandaloneCover = await authenticatedRequest('/api/set-folder-cover', {
      method: 'POST',
      body: replacementCovers
    });
    assert.equal(replacedStandaloneCover.status, 200);
    const replacementCoverResult = await replacedStandaloneCover.json();
    assert.deepEqual(documents.get('drafts.album-student-example-empty-folder').pendingCoverAssetCleanup, [replacedFolderCoverAssetId]);

    const artworkCoverReplacement = new FormData();
    artworkCoverReplacement.set('artist', 'Student Example');
    artworkCoverReplacement.set('category', 'Sketchbook');
    artworkCoverReplacement.append('cover', new Blob(['new-cover'], { type: 'image/png' }), 'new-cover.png');
    const replacedArtworkCover = await authenticatedRequest('/api/set-folder-cover', {
      method: 'POST',
      body: artworkCoverReplacement
    });
    assert.equal(replacedArtworkCover.status, 200);
    assert.deepEqual(documents.get('drafts.album-student-example-sketchbook').pendingCoverAssetCleanup, [retainedArtworkAssetId]);

    const updatedTier = await authenticatedRequest('/api/update-artist-tier', {
      method: 'POST',
      body: { artist: 'Student Example', tier: 'Keith Zenda' }
    });
    assert.equal(updatedTier.status, 200);
    artwork = [...documents.values()].find(document => document._type === 'artwork');
    assert.equal(artwork.artistTier, 'Keith Zenda');

    const artworkIdBeforeReplacement = artwork._id;
    const artworkAssetIdBeforeReplacement = artwork.image.asset._ref;
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
    artworkEdit.append('imageFile', new Blob(['replacement-student-artwork'], { type: 'image/jpeg' }), 'student-work-revised.jpg');
    const editResponse = await authenticatedRequest('/api/edit-artwork', { method: 'POST', body: artworkEdit });
    assert.equal(editResponse.status, 200);
    artwork = [...documents.values()].find(document => document._type === 'artwork');
    assert.equal(artwork._id, artworkIdBeforeReplacement);
    assert.notEqual(artwork.image.asset._ref, artworkAssetIdBeforeReplacement);
    assert.equal([...documents.values()].filter(document => document._type === 'artwork'
      && document.artist === 'Student Example' && document.category === 'Sketchbook').length, 1);
    assert.match(artwork.sourcePath, /student-work-revised\.jpg$/);
    assert.equal(artwork.title, 'Edited Studio Work');
    assert.equal(artwork.medium, 'Oil on canvas');
    assert.equal(artwork.paymentLink, 'https://payments.example.test/student-work');

    const collisionSourcePath = 'ARTISTS/Student Example/Sketchbook/occupied.jpg';
    documents.set('artwork-existing-target', {
      _id: 'artwork-existing-target',
      _type: 'artwork',
      artist: 'Student Example',
      category: 'Sketchbook',
      filename: 'occupied.jpg',
      sourcePath: collisionSourcePath,
      imageUrl: 'https://cdn.sanity.io/images/mock/occupied.jpg'
    });
    const uploadsBeforeCollision = documents.uploads.length;
    const collidingArtworkEdit = new FormData();
    collidingArtworkEdit.set('originalSrc', artwork.sourcePath);
    collidingArtworkEdit.set('title', artwork.title);
    collidingArtworkEdit.set('artist', artwork.artist);
    collidingArtworkEdit.set('category', artwork.category);
    collidingArtworkEdit.set('purchaseType', 'inquire');
    collidingArtworkEdit.append('imageFile', new Blob(['collision-bytes'], { type: 'image/jpeg' }), 'occupied.jpg');
    const rejectedArtworkCollision = await authenticatedRequest('/api/edit-artwork', {
      method: 'POST',
      body: collidingArtworkEdit
    });
    assert.equal(rejectedArtworkCollision.status, 409);
    assert.match((await rejectedArtworkCollision.json()).error, /already uses that artist, folder, and filename/);
    assert.equal(documents.uploads.length, uploadsBeforeCollision);
    documents.delete('artwork-existing-target');

    const sketchbookAlbum = documents.get('drafts.album-student-example-sketchbook');
    documents.set('drafts.album-student-example-sketchbook', { ...sketchbookAlbum, coverSrc: artwork.imageUrl });
    const nextSketchbookArtwork = {
      _id: 'artwork-student-example-sketchbook-next',
      _type: 'artwork',
      artist: 'Student Example',
      category: 'Sketchbook',
      title: 'Next sketchbook work',
      filename: 'next-work.jpg',
      sourcePath: 'ARTISTS/Student Example/Sketchbook/next-work.jpg',
      imageUrl: 'https://cdn.sanity.io/images/mock/next-work.jpg'
    };
    documents.set(nextSketchbookArtwork._id, nextSketchbookArtwork);

    const deletion = await authenticatedRequest('/api/delete-artwork', {
      method: 'DELETE',
      body: { src: artwork.sourcePath }
    });
    assert.equal(deletion.status, 200);
    assert.equal([...documents.values()].find(document => document._type === 'artwork').isDeleted, true);
    assert.equal((await deletion.json()).coverUpdated, true);
    assert.equal(documents.get('drafts.album-student-example-sketchbook').coverSrc, nextSketchbookArtwork.imageUrl);
    documents.delete(nextSketchbookArtwork._id);

    const folderCoverAssetId = 'image-mock-folder-delete-cover';
    const folderCoverUrl = 'https://cdn.sanity.io/images/mock/folder-delete-cover.jpg';
    documents.set(folderCoverAssetId, {
      _id: folderCoverAssetId,
      _type: 'sanity.imageAsset',
      url: folderCoverUrl
    });
    documents.set('album-student-example-delete-me', {
      _id: 'album-student-example-delete-me',
      _type: 'album',
      artist: 'Student Example',
      name: 'Delete Me',
      coverSrc: folderCoverUrl
    });
    documents.set('artwork-student-example-delete-me-one', {
      _id: 'artwork-student-example-delete-me-one',
      _type: 'artwork',
      artist: 'Student Example',
      category: 'Delete Me',
      title: 'Folder child work',
      filename: 'folder-child.jpg',
      sourcePath: 'ARTISTS/Student Example/Delete Me/folder-child.jpg',
      imageUrl: 'https://cdn.sanity.io/images/mock/folder-child.jpg'
    });
    const folderDelete = await authenticatedRequest('/api/delete-artist-folder', {
      method: 'DELETE',
      body: { artist: 'Student Example', category: 'Delete Me' }
    });
    assert.equal(folderDelete.status, 200);
    const folderDeleteResult = await folderDelete.json();
    assert.equal(folderDeleteResult.artworkCount, 1);
    assert.equal(folderDeleteResult.publishRequired, true);
    assert.equal(documents.get('drafts.album-student-example-delete-me').isDeleted, true);
    assert.deepEqual(documents.get('drafts.album-student-example-delete-me').pendingCoverAssetCleanup, [folderCoverAssetId]);
    assert.equal(documents.get('drafts.artwork-student-example-delete-me-one').isDeleted, true);
    const galleryBeforeFolderPublishResponse = await request('/api/public-gallery');
    const galleryBeforeFolderPublish = await galleryBeforeFolderPublishResponse.json();
    assert.equal(galleryBeforeFolderPublish.data.artistsCollections['Student Example/Delete Me'].images.length, 1);

    const publishedStudentArtist = await authenticatedRequest('/api/create-artist-folder', {
      method: 'POST',
      body: { artist: 'Published Student Example', category: 'Portfolio', tier: 'Student Artists' }
    });
    assert.equal(publishedStudentArtist.status, 200);

    const publishedStudentUpload = new FormData();
    publishedStudentUpload.set('artist', 'Published Student Example');
    publishedStudentUpload.set('category', 'Portfolio');
    publishedStudentUpload.set('title', 'Published Student Work');
    publishedStudentUpload.set('medium', 'Acrylic');
    publishedStudentUpload.set('size', '30 x 40 cm');
    publishedStudentUpload.set('year', '2026');
    publishedStudentUpload.set('price', '$80');
    publishedStudentUpload.set('purchaseType', 'inquire');
    publishedStudentUpload.set('description', 'A published student artwork test.');
    publishedStudentUpload.append('images', new Blob(['published-student-artwork'], { type: 'image/jpeg' }), 'published-student-work.jpg');
    const publishedStudentUploadResponse = await authenticatedRequest('/api/upload-artwork', {
      method: 'POST',
      body: publishedStudentUpload
    });
    assert.equal(publishedStudentUploadResponse.status, 200);
    const stagedStudentArtwork = documents.get('drafts.artwork-published-student-example-portfolio-published-student-work-jpg');
    assert.equal(stagedStudentArtwork.artistTier, 'Student Artists');
    assert.equal(stagedStudentArtwork.category, 'Portfolio');

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
    journalFolderForm.set('eyebrow', 'Follow our socials for updates');
    journalFolderForm.set('coverHeading', 'More Exhibitions');
    journalFolderForm.set('coverSubheading', 'Coming Soon');
    journalFolderForm.set('updateText', 'Stay Updated');
    journalFolderForm.set('updateUrl', 'https://artgalzim.com/news');
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
    assert.equal(journalFolder.eyebrow, 'Follow our socials for updates');
    assert.equal(journalFolder.coverHeading, 'More Exhibitions');
    assert.equal(journalFolder.coverSubheading, 'Coming Soon');
    assert.equal(journalFolder.updateText, 'Stay Updated');
    assert.equal(journalFolder.updateUrl, 'https://artgalzim.com/news');
    assert.equal(journalFolder.cover.asset._ref.startsWith('image-mock-'), true);
    const replacedJournalCoverAssetId = journalFolder.cover.asset._ref;
    const replaceJournalFolderCover = new FormData();
    replaceJournalFolderCover.set('id', folderId);
    replaceJournalFolderCover.set('title', journalFolder.title);
    replaceJournalFolderCover.append('cover', new Blob(['new-journal-cover'], { type: 'image/jpeg' }), 'new-journal-cover.jpg');
    const journalFolderCoverReplacement = await authenticatedRequest('/api/journal/folders', {
      method: 'POST',
      body: replaceJournalFolderCover
    });
    assert.equal(journalFolderCoverReplacement.status, 200);
    assert.deepEqual(documents.get(`drafts.${folderId}`).pendingCoverAssetCleanup, [replacedJournalCoverAssetId]);
    const activeJournalCoverAssetId = documents.get(`drafts.${folderId}`).cover.asset._ref;
    const invalidFolderLinkForm = new FormData();
    invalidFolderLinkForm.set('title', 'Invalid Link Folder');
    invalidFolderLinkForm.set('updateUrl', 'javascript:alert(1)');
    const rejectedFolderLink = await authenticatedRequest('/api/journal/folders', {
      method: 'POST',
      body: invalidFolderLinkForm
    });
    assert.equal(rejectedFolderLink.status, 400);
    const editJournalFolder = new FormData();
    editJournalFolder.set('id', folderId);
    editJournalFolder.set('title', 'Domboshava Arts Partnership');
    editJournalFolder.set('category', 'Partnership');
    editJournalFolder.set('parentFolderId', '');
    editJournalFolder.set('description', 'Updated folder description.');
    const updatedJournalFolder = await authenticatedRequest('/api/journal/folders', {
      method: 'POST',
      body: editJournalFolder
    });
    assert.equal(updatedJournalFolder.status, 200);
    assert.equal(documents.get(`drafts.${folderId}`).title, 'Domboshava Arts Partnership');
    assert.equal(documents.get(`drafts.${folderId}`).parentFolderId, '');
    assert.equal(documents.get(`drafts.${folderId}`).organization, 'Domboshava Primary');
    assert.equal(documents.get(`drafts.${folderId}`).description, 'Updated folder description.');
    assert.equal(documents.get(`drafts.${folderId}`).eyebrow, journalFolder.eyebrow);
    assert.equal(documents.get(`drafts.${folderId}`).coverHeading, journalFolder.coverHeading);
    assert.equal(documents.get(`drafts.${folderId}`).coverSubheading, journalFolder.coverSubheading);
    assert.equal(documents.get(`drafts.${folderId}`).updateText, journalFolder.updateText);
    assert.equal(documents.get(`drafts.${folderId}`).updateUrl, 'https://artgalzim.com/news');
    assert.equal(documents.get(`drafts.${folderId}`).cover.asset._ref, activeJournalCoverAssetId);

    const parentFolderForm = new FormData();
    parentFolderForm.set('title', 'Nested Folder Parent');
    const createdParentFolder = await authenticatedRequest('/api/journal/folders', {
      method: 'POST',
      body: parentFolderForm
    });
    assert.equal(createdParentFolder.status, 200);
    const parentFolderId = (await createdParentFolder.json()).id;
    const childFolderForm = new FormData();
    childFolderForm.set('title', 'Nested Folder Child');
    childFolderForm.set('parentFolderId', parentFolderId);
    const createdChildFolder = await authenticatedRequest('/api/journal/folders', {
      method: 'POST',
      body: childFolderForm
    });
    assert.equal(createdChildFolder.status, 200);
    const childFolderId = (await createdChildFolder.json()).id;
    assert.equal(documents.get(`drafts.${childFolderId}`).parentFolderId, parentFolderId);

    const cyclicFolderUpdate = new FormData();
    cyclicFolderUpdate.set('id', parentFolderId);
    cyclicFolderUpdate.set('title', 'Nested Folder Parent');
    cyclicFolderUpdate.set('parentFolderId', childFolderId);
    const rejectedFolderCycle = await authenticatedRequest('/api/journal/folders', {
      method: 'POST',
      body: cyclicFolderUpdate
    });
    assert.equal(rejectedFolderCycle.status, 400);
    assert.match((await rejectedFolderCycle.json()).error, /cannot be moved inside itself/);

    const folderWithChildrenDelete = await authenticatedRequest(`/api/journal/folders/${encodeURIComponent(parentFolderId)}`, {
      method: 'DELETE'
    });
    assert.equal(folderWithChildrenDelete.status, 409);
    assert.match((await folderWithChildrenDelete.json()).error, /subfolders/);

    const missingParentFolder = new FormData();
    missingParentFolder.set('title', 'Missing Parent Folder');
    missingParentFolder.set('parentFolderId', 'does-not-exist');
    const rejectedMissingParent = await authenticatedRequest('/api/journal/folders', {
      method: 'POST',
      body: missingParentFolder
    });
    assert.equal(rejectedMissingParent.status, 400);

    const journalEntryForm = new FormData();
    journalEntryForm.set('folderId', folderId);
    journalEntryForm.set('destination', 'journal');
    journalEntryForm.set('entryType', 'Program');
    journalEntryForm.set('title', 'Student Art Workshop');
    journalEntryForm.set('artistCurator', 'Workshop artist');
    journalEntryForm.set('category', 'Education');
    journalEntryForm.set('excerpt', 'A day of collaborative art making.');
    journalEntryForm.set('body', 'Students and artists worked together.');
    journalEntryForm.set('eventDate', '2026-06-15');
    journalEntryForm.set('endDate', '2026-06-16');
    journalEntryForm.set('location', 'Domboshava Primary');
    journalEntryForm.set('author', 'Gallery team');
    journalEntryForm.set('mediaType', 'video');
    journalEntryForm.set('mediaUrl', 'https://www.youtube.com/watch?v=abcDEF12345');
    journalEntryForm.append('image', new Blob(['story-image'], { type: 'image/jpeg' }), 'workshop.jpg');
    journalEntryForm.append('images', new Blob(['gallery-image'], { type: 'image/jpeg' }), 'workshop-gallery.jpg');
    journalEntryForm.append('attachment', new Blob(['report-bytes'], { type: 'application/pdf' }), 'workshop-report.pdf');
    journalEntryForm.set('body', '<p>Students <strong>worked together</strong>, <u>shared ideas</u>, and <mark>made art</mark>.</p><a href="https://example.com">source</a><script>alert(1)</script><a href="javascript:alert(1)">bad link</a>');
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
    assert.equal(journalEntry.artistCurator, 'Workshop artist');
    assert.equal(journalEntry.category, 'Education');
    assert.equal(journalEntry.eventDate, '2026-06-15');
    assert.equal(journalEntry.endDate, '2026-06-16');
    assert.equal(journalEntry.mediaType, 'video');
    assert.equal(journalEntry.mediaUrl, 'https://www.youtube.com/watch?v=abcDEF12345');
    assert.equal(journalEntry.image.asset._ref.startsWith('image-mock-'), true);
    assert.equal(journalEntry.images.length, 2);
    assert.equal(journalEntry.imagesUrl.length, 2);
    assert.match(journalEntry.body, /<strong>worked together<\/strong>/);
    assert.match(journalEntry.body, /<u>shared ideas<\/u>/);
    assert.match(journalEntry.body, /<mark>made art<\/mark>/);
    assert.match(journalEntry.body, /href="https:\/\/example\.com"/);
    assert.doesNotMatch(journalEntry.body, /<script|javascript:/i);
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
      assert.equal(documents.get(`drafts.${entryId}`).author, 'Gallery team');
      assert.equal(documents.get(`drafts.${entryId}`).artistCurator, 'Workshop artist');
      assert.equal(documents.get(`drafts.${entryId}`).category, 'Education');
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
    assert.equal(documents.get(`drafts.${tvEntryId}`).videoOrientation, 'landscape');
    assert.equal(documents.get(`drafts.${tvEntryId}`).artistCurator, undefined);
    assert.equal(documents.get(`drafts.${tvEntryId}`).category, undefined);

    const shortEntryForm = new FormData();
    shortEntryForm.set('destination', 'tv');
    shortEntryForm.set('entryType', 'Program');
    shortEntryForm.set('title', 'Gallery short feature');
    shortEntryForm.set('mediaType', 'video');
    shortEntryForm.set('mediaUrl', 'https://www.youtube.com/shorts/abcDEF12345');
    shortEntryForm.set('videoOrientation', 'auto');
    const createdShortEntry = await authenticatedRequest('/api/journal/entries', {
      method: 'POST',
      body: shortEntryForm
    });
    assert.equal(createdShortEntry.status, 200);
    const shortEntryId = (await createdShortEntry.json()).id;
    assert.equal(documents.get(`drafts.${shortEntryId}`).videoOrientation, 'portrait');

    const invalidOrientation = new FormData();
    invalidOrientation.set('destination', 'tv');
    invalidOrientation.set('title', 'Invalid orientation');
    invalidOrientation.set('mediaType', 'video');
    invalidOrientation.set('mediaUrl', 'https://www.youtube.com/watch?v=abcDEF12345');
    invalidOrientation.set('videoOrientation', 'square');
    const rejectedOrientation = await authenticatedRequest('/api/journal/entries', {
      method: 'POST',
      body: invalidOrientation
    });
    assert.equal(rejectedOrientation.status, 400);

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
    assert.match(documents.queries.at(-1), /organization, parentFolderId, folderId/);
    assert.match(documents.queries.at(-1), /folderId, folderTitle, entryType, destination, mediaType/);
    assert.match(documents.queries.at(-1), /artistCurator, category/);
    assert.match(documents.queries.at(-1), /mediaType, mediaUrl, videoOrientation/);

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
    assert.equal(documents.has('drafts.album-student-example-delete-me'), false);
    assert.equal(documents.has('album-student-example-delete-me'), false);
    assert.equal(documents.has('artwork-student-example-delete-me-one'), false);
    assert.equal(documents.has(folderCoverAssetId), false);
    assert.equal(documents.deletedAssets.includes(folderCoverAssetId), true);
    assert.equal(documents.has('drafts.artwork-published-student-example-portfolio-published-student-work-jpg'), false);
    assert.equal(documents.has(replacedFolderCoverAssetId), false);
    assert.equal(documents.deletedAssets.includes(replacedFolderCoverAssetId), true);
    assert.equal(documents.has(replacedJournalCoverAssetId), false);
    assert.equal(documents.deletedAssets.includes(replacedJournalCoverAssetId), true);
    assert.equal(documents.has(retainedArtworkAssetId), true);
    assert.equal(documents.deletedAssets.includes(retainedArtworkAssetId), false);
    const publishedGalleryResponse = await request('/api/public-gallery');
    const publishedGallery = await publishedGalleryResponse.json();
    assert.deepEqual(publishedGallery.data.artistsCollections['Student Example/Empty Folder'], {
      images: [],
      cover: replacementCoverResult.cover
    });
    assert.equal(publishedGallery.data.artistsCollections['Student Example/Delete Me'], undefined);
    const publishedStudentFolder = publishedGallery.data.artistsCollections['Published Student Example/Portfolio'];
    assert.equal(publishedStudentFolder.images.length, 1);
    assert.deepEqual(publishedStudentFolder.images[0], {
      filename: 'published-student-work.jpg',
      src: documents.get('artwork-published-student-example-portfolio-published-student-work-jpg').imageUrl,
      artist: 'Published Student Example',
      artist_tier: 'Student Artists',
      category: 'Portfolio',
      title: 'Published Student Work',
      medium: 'Acrylic',
      size: '30 x 40 cm',
      year: '2026',
      price: '$80',
      purchaseType: 'inquire',
      paymentLink: '',
      description: 'A published student artwork test.'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
