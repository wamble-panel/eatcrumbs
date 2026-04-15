import type { IncomingMessage, ServerResponse } from 'http'

// Use a lazy require() instead of a static import so that if the server
// module fails to load (missing env var, Node.js version mismatch, etc.)
// the error is caught here and returned as a JSON 500 rather than crashing
// the function with no response (FUNCTION_INVOCATION_FAILED).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const serverModule = (() => {
  try {
    return require('../src/server') as typeof import('../src/server')
  } catch (err) {
    console.error('[eatcrumbs] MODULE LOAD FAILED:', err)
    return null
  }
})()

let appPromise: Promise<any> | null = null

function getApp(): Promise<any> {
  if (!serverModule) {
    return Promise.reject(new Error('Server module failed to load — check logs for MODULE LOAD FAILED'))
  }
  if (!appPromise) {
    appPromise = serverModule.build()
      .then(async (app) => {
        await app.ready()
        console.log('[eatcrumbs] Fastify ready')
        return app
      })
      .catch((err: unknown) => {
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
  } catch (err: any) {
    console.error('[eatcrumbs] handler error:', err)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      // Include message temporarily so the error is visible in the response
      // body while diagnosing the Vercel deployment issue.
      res.end(JSON.stringify({
        error: 'Internal server error',
        message: err?.message,
        node: process.version,
      }))
    }
  }
}
