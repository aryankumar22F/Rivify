import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/app';

let cachedApp: ReturnType<typeof createApiApp> | null = null;

function getApp() {
  if (!cachedApp) {
    cachedApp = createApiApp();
  }
  return cachedApp;
}

export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return new Promise<void>((resolve) => {
    const finish = () => {
      res.removeListener('finish', finish);
      res.removeListener('close', finish);
      resolve();
    };
    res.once('finish', finish);
    res.once('close', finish);

    try {
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

      const app = getApp();
      app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: err instanceof Error ? err.message : 'Serverless invocation failed.',
          })
        );
      }
      finish();
    }
  });
}
