// AgriLink Bharat — realtime mini-service
//   :3003  socket.io gateway (client connects via io('/?XTransformPort=3003'))
//   :3004  internal POST /emit endpoint for the Next.js API layer (server-to-server)
import { Server } from 'socket.io'

const io = new Server(3003, {
  // DO NOT change the path — Caddy forwards on this path
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  console.log(`dashboard connected: ${socket.id}`)
  socket.emit('hello', { service: 'agrilink-realtime', ts: Date.now() })
  socket.on('disconnect', () => console.log(`dashboard disconnected: ${socket.id}`))
  socket.on('error', (e) => console.error(`socket error (${socket.id}):`, e))
})

// internal fan-out endpoint (never exposed through the gateway)
Bun.serve({
  port: 3004,
  async fetch(req) {
    if (req.method === 'POST' && new URL(req.url).pathname === '/emit') {
      try {
        const { type, payload } = (await req.json()) as { type?: string; payload?: unknown }
        if (typeof type === 'string') {
          io.emit(type, payload ?? {})
          console.log(`[emit] ${type}`)
          return Response.json({ ok: true, clients: io.engine.clientsCount })
        }
        return Response.json({ ok: false, error: 'type required' }, { status: 400 })
      } catch {
        return Response.json({ ok: false, error: 'bad json' }, { status: 400 })
      }
    }
    return Response.json({ service: 'agrilink-realtime', clients: io.engine.clientsCount })
  },
})

console.log('AgriLink realtime service: socket.io :3003, emit endpoint :3004')

process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
