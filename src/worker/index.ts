import { handleUpload } from './uploadParser';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      return handleUpload(request);
    }
    return new Response('Not found', { status: 404 });
  }
}; 