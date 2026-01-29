import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

// Conditional logging - only log in development to prevent memory leak
const log = dev ? console.log.bind(console) : () => { }

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
  isOnline: boolean
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

const players = new Map<string, Player>() // Key: player.id (from localStorage)
const socketToPlayer = new Map<string, string>() // Key: socket.id -> Value: player.id

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
    log(`[Socket] Client connected: ${socket.id}`)

    // Player joins the game
    socket.on('player:join', (playerData: { id?: string; name: string; isGameMaster: boolean }) => {
      const playerId = playerData.id || socket.id

      // Check if player already exists (reconnecting)
      const existingPlayer = players.get(playerId)

      if (existingPlayer) {
        // Player reconnecting - update their socket mapping and online status
        existingPlayer.isOnline = true
        existingPlayer.lastUpdate = Date.now()
        socketToPlayer.set(socket.id, playerId)
        log(`[Socket] Player reconnected: ${existingPlayer.name}`)
      } else {
        // New player
        const player: Player = {
          id: playerId,
          name: playerData.name,
          isGameMaster: playerData.isGameMaster || false,
          isReady: false,
          isOnline: true,
          currentPuzzle: 0,
          currentMoves: 0,
          completedPuzzles: 0,
          score: 0,
          totalTime: 0,
          lastUpdate: Date.now(),
        }

        players.set(playerId, player)
        socketToPlayer.set(socket.id, playerId)
        log(`[Socket] Player joined: ${player.name} (GM: ${player.isGameMaster})`)
      }

      io.emit('players:update', Array.from(players.values()))
      socket.emit('game:state', gameState)
    })

    // Player sets ready status
    socket.on('player:ready', (isReady: boolean) => {
      const playerId = socketToPlayer.get(socket.id)
      const player = playerId ? players.get(playerId) : null
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
      const playerId = socketToPlayer.get(socket.id)
      const player = playerId ? players.get(playerId) : null
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
      const playerId = socketToPlayer.get(socket.id)
      const player = playerId ? players.get(playerId) : null
      if (player) {
        player.completedPuzzles = completeData.completedPuzzles
        player.score = completeData.score
        player.totalTime = completeData.totalTime
        player.currentPuzzle = completeData.currentPuzzle
        player.lastUpdate = Date.now()

        log(`[Socket] Player ${player.name} completed puzzle: Score ${player.score}`)
        io.emit('players:update', Array.from(players.values()))

        io.emit('player:completed', {
          playerId: player.id,
          playerName: player.name,
          puzzleIndex: completeData.puzzleIndex,
          puzzleScore: completeData.puzzleScore,
          totalScore: player.score,
        })
      }
    })

    // Admin starts the game
    socket.on('game:start', (data: { totalPuzzles: number }) => {
      const playerId = socketToPlayer.get(socket.id)
      const player = playerId ? players.get(playerId) : null
      if (player && player.isGameMaster) {
        gameState = {
          isStarted: true,
          startTime: Date.now(),
          totalPuzzles: data.totalPuzzles || 5,
        }

        log(`[Socket] Game started by ${player.name}`)
        io.emit('game:started', gameState)
      }
    })

    // Admin ends the game (keep results)
    socket.on('game:end', () => {
      const playerId = socketToPlayer.get(socket.id)
      const player = playerId ? players.get(playerId) : null
      if (player && player.isGameMaster) {
        gameState = {
          isStarted: false,
          startTime: null,
          totalPuzzles: gameState.totalPuzzles, // Keep totalPuzzles for showing results
        }

        log(`[Socket] Game ended by ${player.name} - keeping results`)
        io.emit('game:ended', gameState)
      }
    })

    // Admin resets the game (clear all results for new game)
    socket.on('game:reset', () => {
      const playerId = socketToPlayer.get(socket.id)
      const player = playerId ? players.get(playerId) : null
      if (player && player.isGameMaster) {
        gameState = {
          isStarted: false,
          startTime: null,
          totalPuzzles: 0,
        }

        // Clear all non-admin players, reset admin stats
        const adminPlayerId = playerId
        const adminSocketId = socket.id

        players.forEach((p, key) => {
          if (!p.isGameMaster) {
            players.delete(key)
          } else {
            // Reset admin stats but keep them
            p.isReady = false
            p.currentPuzzle = 0
            p.currentMoves = 0
            p.completedPuzzles = 0
            p.score = 0
            p.totalTime = 0
          }
        })

        // Clear socketToPlayer but re-add admin
        socketToPlayer.clear()
        if (adminPlayerId) {
          socketToPlayer.set(adminSocketId, adminPlayerId)
        }

        log(`[Socket] Game reset by ${player.name} - all player results cleared`)
        io.emit('game:reset', gameState)
        io.emit('players:update', Array.from(players.values()))
      }
    })

    // Disconnect - mark as offline instead of deleting (to keep results)
    socket.on('disconnect', () => {
      const playerId = socketToPlayer.get(socket.id)
      const player = playerId ? players.get(playerId) : null

      if (player && playerId) {
        log(`[Socket] Player disconnected: ${player.name}`)

        // If game is not active (no results to keep) or player is game master, remove them
        // Otherwise keep their results
        if (!gameState.isStarted && gameState.totalPuzzles === 0) {
          players.delete(playerId)
        } else if (player.isGameMaster) {
          players.delete(playerId)
        }
        // Don't delete regular players during/after game - keep their results
      }

      socketToPlayer.delete(socket.id)
      io.emit('players:update', Array.from(players.values()))
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
