import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/app';

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.url) {
    const url = new URL(req.url, 'http://localhost');
    const vpath = url.searchParams.get('__vpath');
    if (vpath !== null) {
      url.searchParams.delete('__vpath');
      const qs = url.searchParams.toString();
      req.url = `/api/${vpath.replace(/^\/+/, '')}${qs ? `?${qs}` : ''}`;
    } else if (!url.pathname.startsWith('/api')) {
      req.url = `/api${url.pathname.startsWith('/') ? '' : '/'}${url.pathname}${url.search}`;
    }
  }
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
