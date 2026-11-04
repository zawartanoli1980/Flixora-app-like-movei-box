import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicMediaService} from './public-media.js';

test('public media service returns only licensed archive MP4 sources', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('advancedsearch.php')) {
      return new Response(JSON.stringify({response: {docs: [
        {identifier: 'licensed-film', title: 'Licensed Film', licenseurl: 'https://creativecommons.org/publicdomain/mark/1.0/', downloads: 1200},
        {identifier: 'unknown-rights', title: 'Unknown Rights', downloads: 9999},
      ]}}), {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    if (url.endsWith('/metadata/licensed-film')) {
      return new Response(JSON.stringify({
        metadata: {title: 'Licensed Film', description: '<p>A legal classic.</p>', year: '1940', licenseurl: 'https://creativecommons.org/publicdomain/mark/1.0/'},
        files: [
          {name: 'licensed-film.ogv', format: 'Ogg Video', size: '100'},
          {name: 'licensed film.mp4', format: 'MPEG4', size: '2000'},
        ],
      }), {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  const service = createPublicMediaService({fetchImpl, baseUrl: 'https://archive.test'});
  const result = await service.list({limit: 8});
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, 'Licensed Film');
  assert.equal(result.items[0].description, 'A legal classic.');
  assert.equal(result.items[0].sources[0].url, 'https://archive.org/download/licensed-film/licensed%20film.mp4');
  assert.match(result.items[0].licenseUrl, /creativecommons\.org\/publicdomain/);
});
