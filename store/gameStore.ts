import { create } from 'zustand'

export interface Player {
  id: string
  name: string
  score: number
  completedPuzzles: number
  totalTime: number
  isReady: boolean
  isGameMaster: boolean
  currentMoves?: number
}

export interface PuzzleResult {
  puzzleIndex: number
  timeSeconds: number
  moves: number
  score: number
}

interface GameState {
  // Player
  currentPlayer: Player | null
  players: Player[]

  // Game
  isGameStarted: boolean
  currentPuzzleIndex: number
  totalPuzzles: number
  puzzleResults: PuzzleResult[]

  // Assets
  puzzleImages: string[]

  // Socket
  isConnected: boolean

  // Actions
  setCurrentPlayer: (player: Player | null) => void
  setPlayers: (players: Player[]) => void
  addPlayer: (player: Player) => void
  setPlayerReady: (playerId: string, isReady: boolean) => void
  setGameStarted: (started: boolean) => void
  setCurrentPuzzleIndex: (index: number) => void
  setTotalPuzzles: (total: number) => void
  setPuzzleImages: (images: string[]) => void
  addPuzzleResult: (result: PuzzleResult) => void
  updatePlayerScore: (score: number, time: number) => void
  nextPuzzle: () => boolean
  resetGame: () => void
  setConnected: (connected: boolean) => void

  // Computed
  isLastPuzzle: () => boolean
  getFinalScore: () => number
}

const generateId = () => Math.random().toString(36).substring(2, 9)

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  currentPlayer: null,
  players: [],
  isGameStarted: false,
  currentPuzzleIndex: 0,
  totalPuzzles: 0,
  puzzleResults: [],
  puzzleImages: [],
  isConnected: false,

  // Actions
  setCurrentPlayer: (player) => set({ currentPlayer: player }),

  setPlayers: (players) => set({ players }),

  addPlayer: (player) => set((state) => ({
    players: [...state.players, player]
  })),

  setPlayerReady: (playerId, isReady) => set((state) => ({
    players: state.players.map(p =>
      p.id === playerId ? { ...p, isReady } : p
    ),
    currentPlayer: state.currentPlayer?.id === playerId
      ? { ...state.currentPlayer, isReady }
      : state.currentPlayer
  })),

  setGameStarted: (started) => set({
    isGameStarted: started,
    currentPuzzleIndex: started ? 0 : get().currentPuzzleIndex,
    puzzleResults: started ? [] : get().puzzleResults
  }),

  setCurrentPuzzleIndex: (index) => set({ currentPuzzleIndex: index }),

  setTotalPuzzles: (total) => set({ totalPuzzles: total }),

  setPuzzleImages: (images) => set({
    puzzleImages: images,
    totalPuzzles: images.length
  }),

  addPuzzleResult: (result) => set((state) => {
    // Check if this puzzle result already exists (avoid duplicates)
    const existingIndex = state.puzzleResults.findIndex(r => r.puzzleIndex === result.puzzleIndex)

    let newResults: PuzzleResult[]
    if (existingIndex >= 0) {
      // Update existing result instead of adding duplicate
      newResults = [...state.puzzleResults]
      newResults[existingIndex] = result
    } else {
      // Add new result
      newResults = [...state.puzzleResults, result]
    }

    const totalScore = newResults.reduce((sum, r) => sum + r.score, 0)
    const totalTime = newResults.reduce((sum, r) => sum + r.timeSeconds, 0)

    return {
      puzzleResults: newResults,
      currentPlayer: state.currentPlayer ? {
        ...state.currentPlayer,
        score: totalScore,
        totalTime: totalTime,
        completedPuzzles: newResults.length
      } : null
    }
  }),

  updatePlayerScore: (score, time) => set((state) => ({
    currentPlayer: state.currentPlayer ? {
      ...state.currentPlayer,
      score: state.currentPlayer.score + score,
      totalTime: state.currentPlayer.totalTime + time,
      completedPuzzles: state.currentPlayer.completedPuzzles + 1
    } : null
  })),

  nextPuzzle: () => {
    const state = get()
    if (state.currentPuzzleIndex >= state.totalPuzzles - 1) {
      return false
    }
    set({ currentPuzzleIndex: state.currentPuzzleIndex + 1 })
    return true
  },

  resetGame: () => set({
    currentPlayer: null,
    players: [],
    isGameStarted: false,
    currentPuzzleIndex: 0,
    puzzleResults: [],
  }),

  setConnected: (connected) => set({ isConnected: connected }),

  // Computed
  isLastPuzzle: () => {
    const state = get()
    return state.currentPuzzleIndex >= state.totalPuzzles - 1
  },

  getFinalScore: () => {
    const state = get()
    return state.puzzleResults.reduce((sum, r) => sum + r.score, 0)
  }
}))

// Helper to create a new player
export function createPlayer(name: string, isGameMaster: boolean = false): Player {
  // Try to get existing player ID from localStorage (for reconnection)
  const storageKey = `lumi_puzzle_player_${name.trim().toLowerCase()}`
  let playerId: string

  if (typeof window !== 'undefined') {
    const existingId = localStorage.getItem(storageKey)
    if (existingId) {
      playerId = existingId
    } else {
      playerId = generateId()
      localStorage.setItem(storageKey, playerId)
    }
  } else {
    playerId = generateId()
  }

  return {
    id: playerId,
    name: name.trim(),
    score: 0,
    completedPuzzles: 0,
    totalTime: 0,
    isReady: false,
    isGameMaster,
  }
}
