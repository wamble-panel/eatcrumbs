import type { IncomingMessage, ServerResponse } from 'http'
import { build } from '../src/server'

// Hold a single Fastify instance across warm invocations.
let appPromise: ReturnType<typeof build> | null = null

function getApp() {
  if (!appPromise) {
    appPromise = build()
      .then(async (app) => {
        await app.ready()
        console.log('[eatcrumbs] Fastify ready')
        return app
      })
      .catch((err) => {
        // Log the full error so it appears in Vercel function logs
        console.error('[eatcrumbs] STARTUP FAILED:', err)
        appPromise = null
        throw err
      })
  }
  return appPromise
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp()
    app.server.emit('request', req, res)
  } catch (err) {
    console.error('[eatcrumbs] handler error:', err)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
  }
}
