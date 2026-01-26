'use client'

import React, { useEffect, useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { useGameStore } from '@/store/gameStore'
import { usePuzzle } from '@/hooks/usePuzzle'
import { useSocket } from '@/hooks/useSocket'
import { formatTime, type ShuffledPiece } from '@/lib/puzzleEngine'

// Sortable Puzzle Piece Component
function SortablePiece({ piece, pieceId, disabled, aspectRatio }: { piece: ShuffledPiece; pieceId: string; disabled: boolean; aspectRatio: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pieceId, disabled })

  const style: React.CSSProperties = {
    // Force GPU acceleration to prevent glitches in some browsers
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: isDragging ? 'none' : transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.9 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    willChange: isDragging ? 'transform' : 'auto',
    aspectRatio: aspectRatio,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`puzzle-piece ${isDragging ? 'dragging' : ''}`}
    >
      <img src={piece.dataUrl} alt={`Piece ${piece.originalIndex}`} draggable={false} />
    </div>
  )
}

// Timer Display
function Timer({ seconds }: { seconds: number }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
      <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="font-heading text-xl tabular-nums">{formatTime(seconds)}</span>
    </div>
  )
}

// Moves Counter
function MovesCounter({ moves }: { moves: number }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
      <span className="font-heading text-xl tabular-nums">{moves}</span>
    </div>
  )
}

// Progress Bar
function ProgressBar({ current, total }: { current: number; total: number }) {
  const progress = total > 0 ? ((current + 1) / total) * 100 : 0

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-slate-400 mb-1">
        <span>Câu đố {current + 1}/{total}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-blue-500 to-orange-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export default function GamePage() {
  const router = useRouter()
  const {
    currentPlayer,
    isGameStarted,
    currentPuzzleIndex,
    totalPuzzles,
    puzzleImages,
    setPuzzleImages,
    addPuzzleResult,
    nextPuzzle: storeNextPuzzle,
    isLastPuzzle,
  } = useGameStore()

  // Fetch puzzle images if not loaded
  useEffect(() => {
    if (puzzleImages.length === 0) {
      fetch('/api/images')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.images.length > 0) {
            // Sort randomly or by name
            const urls = data.images.map((img: any) => img.url)
            setPuzzleImages(urls)
          }
        })
        .catch(err => console.error('Failed to fetch images:', err))
    }
  }, [puzzleImages.length, setPuzzleImages])

  const currentImage = puzzleImages[currentPuzzleIndex] || ''

  // Socket for real-time updates
  const { updateProgress, completeLevel, joinGame: socketJoin, isConnected } = useSocket()
  const hasJoinedSocket = useRef(false)

  // Join socket on mount if missed
  useEffect(() => {
    if (currentPlayer && isConnected && !hasJoinedSocket.current) {
      socketJoin(currentPlayer.id, currentPlayer.name, false)
      hasJoinedSocket.current = true
    }
  }, [currentPlayer, isConnected, socketJoin])

  // Puzzle hook
  const {
    pieces,
    isLoading,
    isComplete,
    moves,
    timeSeconds,
    score,
    aspectRatio,
    handleSwap,
    reset,
  } = usePuzzle({
    imageSrc: currentImage,
    onComplete: (finalScore, time, totalMoves) => {
      console.log('Puzzle completed callback:', { finalScore, time, totalMoves })

      // Update store
      addPuzzleResult({
        puzzleIndex: currentPuzzleIndex,
        score: finalScore,
        timeSeconds: time,
        moves: totalMoves
      })

      // Emit socket event
      if (isConnected && currentPlayer) {
        completeLevel({
          completedPuzzles: currentPuzzleIndex + 1,
          score: (currentPlayer.score || 0) + finalScore,
          totalTime: (currentPlayer.totalTime || 0) + time,
          currentPuzzle: currentPuzzleIndex,
          puzzleIndex: currentPuzzleIndex,
          puzzleScore: finalScore,
        })
      }
    },
  })

  // Emit progress periodically
  useEffect(() => {
    if (!isConnected || !currentPlayer || isLoading || isComplete) return

    // Throttle updates because moves change often
    const timer = setTimeout(() => {
      updateProgress({
        currentPuzzle: currentPuzzleIndex,
        currentMoves: moves,
        score: currentPlayer.score || 0,
        totalTime: (currentPlayer.totalTime || 0) + timeSeconds,
      })
    }, 500)

    return () => clearTimeout(timer)
  }, [moves, timeSeconds, isConnected, currentPlayer, isLoading, isComplete, currentPuzzleIndex, updateProgress])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    })
  )

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const fromArrayIndex = pieces.findIndex(p => `piece-${p.originalIndex}` === active.id)
      const toArrayIndex = pieces.findIndex(p => `piece-${p.originalIndex}` === over.id)

      if (fromArrayIndex !== -1 && toArrayIndex !== -1) {
        handleSwap(fromArrayIndex, toArrayIndex)
      }
    }
  }, [handleSwap, pieces])

  // Handle next puzzle
  const handleNext = useCallback(() => {
    if (isLastPuzzle()) {
      router.push('/result')
    } else {
      storeNextPuzzle()
      // Note: reset() in usePuzzle will be triggered by imageSrc change
    }
  }, [isLastPuzzle, storeNextPuzzle, router])

  // Redirect if invalid state
  useEffect(() => {
    if (!currentPlayer) {
      router.push('/')
    } else if (!isGameStarted && !currentPlayer.isGameMaster) { // Allow GM to test? maybe not
      // Actually if game not started, should be in lobby
      // router.push('/lobby')
    }
  }, [currentPlayer, isGameStarted, router])

  if (!currentPlayer) return null

  // Fallback if no images
  if (puzzleImages.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        <div className="text-center">
          <p className="mb-4">Chưa có hình ảnh puzzle nào.</p>
          <p>Vui lòng yêu cầu Game Master upload hình ảnh.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col">
      <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <header className="mb-6">
          <ProgressBar current={currentPuzzleIndex} total={totalPuzzles || puzzleImages.length} />
        </header>

        {/* Stats */}
        <div className="flex justify-center gap-4 mb-6">
          <Timer seconds={timeSeconds} />
          <MovesCounter moves={moves} />
        </div>

        {/* Puzzle Board */}
        <div className="flex-1 flex items-center justify-center">
          {isLoading ? (
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Đang tải câu đố...</p>
            </div>
          ) : (
            <div className="w-full relative">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={pieces.map(p => `piece-${p.originalIndex}`)}
                  strategy={rectSortingStrategy}
                >
                  <div className="puzzle-grid" style={{ aspectRatio }}>
                    {pieces.map(piece => (
                      <SortablePiece
                        key={`piece-${piece.originalIndex}`}
                        pieceId={`piece-${piece.originalIndex}`}
                        piece={piece}
                        aspectRatio={aspectRatio}
                        disabled={isComplete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Completion - just show next button below the completed puzzle */}
              {isComplete && (
                <div className="mt-4 animate-slide-up">
                  <button
                    onClick={handleNext}
                    className="btn btn-accent btn-lg w-full glow-accent"
                  >
                    {isLastPuzzle() ? 'Xem kết quả 🏆' : 'Câu đố tiếp theo →'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Player Info */}
        <footer className="mt-6 text-center">
          <p className="text-slate-400">
            Người chơi: <span className="text-blue-500 font-medium">{currentPlayer.name}</span>
          </p>
        </footer>
      </div>
    </div>
  )
}
