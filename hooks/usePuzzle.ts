'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  sliceImage,
  shufflePieces,
  swapPieces,
  validateSolution,
  calculateScore,
  type ShuffledPiece
} from '@/lib/puzzleEngine'

interface UsePuzzleOptions {
  imageSrc: string
  onComplete?: (score: number, time: number, moves: number) => void
}

interface UsePuzzleReturn {
  pieces: ShuffledPiece[]
  isLoading: boolean
  isComplete: boolean
  moves: number
  timeSeconds: number
  score: number
  handleSwap: (fromIndex: number, toIndex: number) => void
  reset: () => void
}

export function usePuzzle({ imageSrc, onComplete }: UsePuzzleOptions): UsePuzzleReturn {
  const [pieces, setPieces] = useState<ShuffledPiece[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isComplete, setIsComplete] = useState(false)
  const [moves, setMoves] = useState(0)
  const [timeSeconds, setTimeSeconds] = useState(0)
  const [score, setScore] = useState(0)
  const [timerActive, setTimerActive] = useState(false)

  // Use refs to track current values for callbacks (avoid stale closures)
  const movesRef = useRef(0)
  const timeRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  const isCompleteRef = useRef(false)

  // Keep refs in sync with state
  useEffect(() => {
    movesRef.current = moves
  }, [moves])

  useEffect(() => {
    timeRef.current = timeSeconds
  }, [timeSeconds])

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    isCompleteRef.current = isComplete
  }, [isComplete])

  // Load and slice image
  const loadPuzzle = useCallback(async () => {
    if (!imageSrc) return

    setIsLoading(true)
    setIsComplete(false)
    isCompleteRef.current = false
    setMoves(0)
    setTimeSeconds(0)
    setScore(0)
    setTimerActive(false)
    movesRef.current = 0
    timeRef.current = 0

    try {
      console.log('[Puzzle] Loading image:', imageSrc)
      const slices = await sliceImage(imageSrc)
      const shuffled = shufflePieces(slices)
      setPieces(shuffled)
      setTimerActive(true)
      console.log('[Puzzle] Loaded and shuffled', shuffled.length, 'pieces')
    } catch (error) {
      console.error('[Puzzle] Failed to load puzzle:', error)
    } finally {
      setIsLoading(false)
    }
  }, [imageSrc])

  // Load puzzle on mount or when image changes
  useEffect(() => {
    loadPuzzle()
  }, [loadPuzzle])

  // Timer
  useEffect(() => {
    if (!timerActive || isComplete) return

    const interval = setInterval(() => {
      setTimeSeconds(prev => {
        const newTime = prev + 1
        timeRef.current = newTime
        return newTime
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timerActive, isComplete])

  // Handle swap - use refs to get current values
  const handleSwap = useCallback((fromIndex: number, toIndex: number) => {
    if (isCompleteRef.current || fromIndex === toIndex) return

    // Increment moves first
    const newMoves = movesRef.current + 1
    movesRef.current = newMoves
    setMoves(newMoves)

    setPieces(prev => {
      const newPieces = swapPieces(prev, fromIndex, toIndex)

      // Check if solved using refs for current values
      if (validateSolution(newPieces)) {
        const currentTime = timeRef.current
        const currentMoves = movesRef.current

        console.log('[Puzzle] Solved!', { currentTime, currentMoves })

        setIsComplete(true)
        isCompleteRef.current = true
        setTimerActive(false)

        const finalScore = calculateScore(currentTime, currentMoves)
        setScore(finalScore)

        // Use timeout to ensure state updates are processed
        setTimeout(() => {
          console.log('[Puzzle] Calling onComplete callback')
          onCompleteRef.current?.(finalScore, currentTime, currentMoves)
        }, 100)
      }

      return newPieces
    })
  }, [])

  // Reset puzzle
  const reset = useCallback(() => {
    loadPuzzle()
  }, [loadPuzzle])

  return {
    pieces,
    isLoading,
    isComplete,
    moves,
    timeSeconds,
    score,
    handleSwap,
    reset,
  }
}
