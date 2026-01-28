'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useGameStore } from '@/store/gameStore'

export interface PlayerData {
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

export interface GameStateData {
  isStarted: boolean
  startTime: number | null
  totalPuzzles: number
}

export interface PlayerCompletedEvent {
  playerId: string
  playerName: string
  puzzleIndex: number
  puzzleScore: number
  totalScore: number
}

interface UseSocketOptions {
  autoConnect?: boolean
  onPlayersUpdate?: (players: PlayerData[]) => void
  onGameStarted?: (gameState: GameStateData) => void
  onGameEnded?: (gameState: GameStateData) => void
  onGameReset?: () => void
  onPlayerCompleted?: (event: PlayerCompletedEvent) => void
  onImagesUpdate?: () => void
}

interface UseSocketReturn {
  isConnected: boolean
  players: PlayerData[]
  gameState: GameStateData | null

  // Actions
  joinGame: (playerId: string, name: string, isGameMaster: boolean) => void
  setReady: (isReady: boolean) => void
  updateProgress: (data: { currentPuzzle: number; currentMoves: number; score: number; totalTime: number }) => void
  completeLevel: (data: {
    completedPuzzles: number
    score: number
    totalTime: number
    currentPuzzle: number
    puzzleIndex: number
    puzzleScore: number
  }) => void
  startGame: (totalPuzzles: number) => void
  endGame: () => void
  resetGame: () => void
}

// Singleton socket instance
let globalSocket: Socket | null = null
let socketRefCount = 0

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [players, setPlayers] = useState<PlayerData[]>([])
  const [gameState, setGameState] = useState<GameStateData | null>(null)

  const { autoConnect = true } = options
  const callbacksRef = useRef(options)
  callbacksRef.current = options

  const setConnectedStore = useGameStore(state => state.setConnected)

  useEffect(() => {
    if (!autoConnect) return

    socketRefCount++

    // Determine socket URL - same origin in production
    const socketUrl = typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000'

    if (!globalSocket) {
      globalSocket = io(socketUrl, {
        path: '/api/socketio',
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      })

      globalSocket.on('connect', () => {
        console.log('[Socket] Connected:', globalSocket?.id)
      })

      globalSocket.on('disconnect', () => {
        console.log('[Socket] Disconnected')
      })

      globalSocket.on('connect_error', (error) => {
        console.log('[Socket] Connection error:', error.message)
      })
    }

    const socket = globalSocket

    const updateConnected = () => {
      setIsConnected(socket.connected)
      setConnectedStore(socket.connected)
    }
    updateConnected()

    socket.on('connect', updateConnected)
    socket.on('disconnect', updateConnected)

    // Event handlers
    const handlePlayersUpdate = (updatedPlayers: PlayerData[]) => {
      console.log('[Socket] Players update:', updatedPlayers.length, 'players')
      setPlayers(updatedPlayers)
      callbacksRef.current.onPlayersUpdate?.(updatedPlayers)
    }

    const handleGameState = (state: GameStateData) => {
      setGameState(state)
    }

    const handleGameStarted = (state: GameStateData) => {
      setGameState(state)
      callbacksRef.current.onGameStarted?.(state)
    }

    const handleGameEnded = (state: GameStateData) => {
      setGameState({ ...state, isStarted: false })
      callbacksRef.current.onGameEnded?.(state)
    }

    const handleGameReset = () => {
      setGameState({ isStarted: false, startTime: null, totalPuzzles: 0 })
      callbacksRef.current.onGameReset?.()
    }

    const handlePlayerCompleted = (event: PlayerCompletedEvent) => {
      callbacksRef.current.onPlayerCompleted?.(event)
    }

    const handleImagesUpdate = () => {
      callbacksRef.current.onImagesUpdate?.()
    }

    socket.on('players:update', handlePlayersUpdate)
    socket.on('game:state', handleGameState)
    socket.on('game:started', handleGameStarted)
    socket.on('game:ended', handleGameEnded)
    socket.on('game:reset', handleGameReset)
    socket.on('player:completed', handlePlayerCompleted)
    socket.on('images:update', handleImagesUpdate)

    return () => {
      socket.off('connect', updateConnected)
      socket.off('disconnect', updateConnected)
      socket.off('players:update', handlePlayersUpdate)
      socket.off('game:state', handleGameState)
      socket.off('game:started', handleGameStarted)
      socket.off('game:ended', handleGameEnded)
      socket.off('game:reset', handleGameReset)
      socket.off('player:completed', handlePlayerCompleted)
      socket.off('images:update', handleImagesUpdate)

      socketRefCount--
      if (socketRefCount === 0 && globalSocket) {
        globalSocket.disconnect()
        globalSocket = null
      }
    }
  }, [autoConnect, setConnectedStore])

  const joinGame = useCallback((playerId: string, name: string, isGameMaster: boolean) => {
    console.log('[Socket] Joining game as:', name, 'id:', playerId, 'isGameMaster:', isGameMaster)
    globalSocket?.emit('player:join', { id: playerId, name, isGameMaster })
  }, [])

  const setReady = useCallback((isReady: boolean) => {
    globalSocket?.emit('player:ready', isReady)
  }, [])

  const updateProgress = useCallback((data: { currentPuzzle: number; currentMoves: number; score: number; totalTime: number }) => {
    globalSocket?.emit('player:progress', data)
  }, [])

  const completeLevel = useCallback((data: {
    completedPuzzles: number
    score: number
    totalTime: number
    currentPuzzle: number
    puzzleIndex: number
    puzzleScore: number
  }) => {
    globalSocket?.emit('player:complete', data)
  }, [])

  const startGame = useCallback((totalPuzzles: number) => {
    globalSocket?.emit('game:start', { totalPuzzles })
  }, [])

  const endGame = useCallback(() => {
    globalSocket?.emit('game:end')
  }, [])

  const resetGame = useCallback(() => {
    globalSocket?.emit('game:reset')
  }, [])

  return {
    isConnected,
    players,
    gameState,
    joinGame,
    setReady,
    updateProgress,
    completeLevel,
    startGame,
    endGame,
    resetGame,
  }
}
