import type { IncomingMessage, ServerResponse } from 'http'
import { build } from '../src/server'

// Hold a single Fastify instance across warm invocations.
// Using a promise ensures concurrent cold-start requests share one
// initialisation rather than racing to create duplicate instances.
let appPromise: ReturnType<typeof build> | null = null

function getApp() {
  if (!appPromise) {
    appPromise = build().then(async (app) => {
      await app.ready()
      return app
    }).catch((err) => {
      // Reset so the next request retries initialisation
      appPromise = null
      throw err
    })
  }
  return appPromise
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp()
  app.server.emit('request', req, res)
}
