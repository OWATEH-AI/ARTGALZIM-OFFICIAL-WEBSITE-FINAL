import { createSanityGateway } from './sanity-gateway.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const response = await createSanityGateway(env)(request);
      if (response) return response;
    }
    return env.ASSETS.fetch(request);
  }
};