import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// ========================================
// STATE MANAGEMENT
// ========================================

interface Player {
  id: string
  name: string
  isGameMaster: boolean
  isReady: boolean
  currentPuzzle: number
  currentMoves: number
  completedPuzzles: number
  score: number
  totalTime: number
  lastUpdate: number
}

interface GameState {
  isStarted: boolean
  startTime: number | null
  totalPuzzles: number
}

const players = new Map<string, Player>()

let gameState: GameState = {
  isStarted: false,
  startTime: null,
  totalPuzzles: 0,
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url!, true)
      handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Socket.io setup
  const io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`)

    // Player joins the game
    socket.on('player:join', (playerData: { id?: string; name: string; isGameMaster: boolean }) => {
      const player: Player = {
        id: playerData.id || socket.id,
        name: playerData.name,
        isGameMaster: playerData.isGameMaster || false,
        isReady: false,
        currentPuzzle: 0,
        currentMoves: 0,
        completedPuzzles: 0,
        score: 0,
        totalTime: 0,
        lastUpdate: Date.now(),
      }

      players.set(socket.id, player)
      console.log(`[Socket] Player joined: ${player.name} (GM: ${player.isGameMaster})`)

      io.emit('players:update', Array.from(players.values()))
      socket.emit('game:state', gameState)
    })

    // Player sets ready status
    socket.on('player:ready', (isReady: boolean) => {
      const player = players.get(socket.id)
      if (player) {
        player.isReady = isReady
        player.lastUpdate = Date.now()
        io.emit('players:update', Array.from(players.values()))
      }
    })

    // Player progress update
    socket.on('player:progress', (progressData: {
      currentPuzzle: number
      currentMoves: number
      score: number
      totalTime: number
    }) => {
      const player = players.get(socket.id)
      if (player) {
        player.currentPuzzle = progressData.currentPuzzle
        player.currentMoves = progressData.currentMoves || 0
        player.score = progressData.score
        player.totalTime = progressData.totalTime
        player.lastUpdate = Date.now()

        io.emit('players:update', Array.from(players.values()))
      }
    })

    // Player completes a puzzle
    socket.on('player:complete', (completeData: {
      completedPuzzles: number
      score: number
      totalTime: number
      currentPuzzle: number
      puzzleIndex: number
      puzzleScore: number
    }) => {
      const player = players.get(socket.id)
      if (player) {
        player.completedPuzzles = completeData.completedPuzzles
        player.score = completeData.score
        player.totalTime = completeData.totalTime
        player.currentPuzzle = completeData.currentPuzzle
        player.lastUpdate = Date.now()

        console.log(`[Socket] Player ${player.name} completed puzzle: Score ${player.score}`)
        io.emit('players:update', Array.from(players.values()))

        io.emit('player:completed', {
          playerId: socket.id,
          playerName: player.name,
          puzzleIndex: completeData.puzzleIndex,
          puzzleScore: completeData.puzzleScore,
          totalScore: player.score,
        })
      }
    })

    // Admin starts the game
    socket.on('game:start', (data: { totalPuzzles: number }) => {
      const player = players.get(socket.id)
      if (player && player.isGameMaster) {
        gameState = {
          isStarted: true,
          startTime: Date.now(),
          totalPuzzles: data.totalPuzzles || 5,
        }

        console.log(`[Socket] Game started by ${player.name}`)
        io.emit('game:started', gameState)
      }
    })

    // Admin resets the game
    socket.on('game:reset', () => {
      const player = players.get(socket.id)
      if (player && player.isGameMaster) {
        gameState = {
          isStarted: false,
          startTime: null,
          totalPuzzles: 0,
        }

        players.forEach((p) => {
          p.isReady = false
          p.currentPuzzle = 0
          p.currentMoves = 0
          p.completedPuzzles = 0
          p.score = 0
          p.totalTime = 0
        })

        console.log(`[Socket] Game reset by ${player.name}`)
        io.emit('game:reset', gameState)
        io.emit('players:update', Array.from(players.values()))
      }
    })

    // Disconnect
    socket.on('disconnect', () => {
      const player = players.get(socket.id)
      if (player) {
        console.log(`[Socket] Player disconnected: ${player.name}`)
        players.delete(socket.id)
        io.emit('players:update', Array.from(players.values()))
      }
    })
  })

    // Store io instance for API routes
    ; (global as any).io = io

  httpServer.listen(port, () => {
    console.log(`
🚀 Lumi Puzzle Game Server
📡 Ready at http://${hostname}:${port}
    `)
  })
})
