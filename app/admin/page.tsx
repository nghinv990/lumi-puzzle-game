'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/store/gameStore'
import { useSocket, type PlayerData, type PlayerCompletedEvent } from '@/hooks/useSocket'
import { formatTime } from '@/lib/puzzleEngine'

// Animated Score Counter
function AnimatedScore({ value, duration = 500 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0)
  const previousValue = useRef(0)

  useEffect(() => {
    const startValue = previousValue.current
    const endValue = value
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const current = Math.round(startValue + (endValue - startValue) * easeOutQuart)

      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        previousValue.current = endValue
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration])

  return <span className="tabular-nums">{displayValue.toLocaleString()}</span>
}

// Player Card with Progress
function PlayerCard({
  player,
  rank,
  totalPuzzles,
  isHighlighted
}: {
  player: PlayerData
  rank: number
  totalPuzzles: number
  isHighlighted: boolean
}) {
  const progress = totalPuzzles > 0 ? (player.completedPuzzles / totalPuzzles) * 100 : 0

  const getRankEmoji = () => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getStatusColor = () => {
    if (player.completedPuzzles === totalPuzzles && totalPuzzles > 0) return 'text-green-500'
    if (player.isReady) return 'text-blue-500'
    return 'text-yellow-500'
  }

  return (
    <div
      className={`
        relative p-4 rounded-xl transition-all duration-500
        ${isHighlighted ? 'bg-linear-to-r from-orange-500/20 to-blue-500/20 scale-105 shadow-lg shadow-orange-500/20' : 'bg-slate-800/50'}
        ${isHighlighted ? 'animate-pulse-once' : ''}
      `}
    >
      <div className="absolute -top-2 -left-2 w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center font-bold text-sm">
        {getRankEmoji()}
      </div>

      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg ${getStatusColor()}`}>
          {player.name[0].toUpperCase()}
        </div>

        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-white">{player.name}</span>
            <span className="text-lg font-heading text-gradient">
              <AnimatedScore value={player.score} />
            </span>
          </div>

          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-blue-500 to-orange-500 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between mt-1 text-xs text-slate-400">
            <span>Puzzle {player.completedPuzzles}/{totalPuzzles}</span>
            <span className="text-blue-400">🎯 {player.currentMoves || 0} moves</span>
            <span>{formatTime(player.totalTime)}</span>
          </div>
        </div>
      </div>

      {isHighlighted && (
        <div className="absolute inset-0 rounded-xl border-2 border-orange-500/50 animate-pulse pointer-events-none" />
      )}
    </div>
  )
}

// Toast notification for events
function Toast({ message, isVisible }: { message: string; isVisible: boolean }) {
  return (
    <div
      className={`
        fixed top-4 right-4 p-4 bg-linear-to-r from-green-500 to-emerald-600 
        text-white rounded-lg shadow-lg transition-all duration-300 z-50
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      {message}
    </div>
  )
}

// Image Card for Manager
interface ImageItem {
  id: string
  filename: string
  url: string
}

function ImageCard({ image, onDelete }: { image: ImageItem; onDelete: (id: string) => void }) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (confirm('Xác nhận xóa hình này?')) {
      setIsDeleting(true)
      await onDelete(image.id)
    }
  }

  return (
    <div className={`relative group rounded-lg overflow-hidden ${isDeleting ? 'opacity-50' : ''}`}>
      <img
        src={image.url}
        alt={image.filename}
        className="w-full h-32 object-cover"
      />
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-2 bg-red-500 hover:bg-red-600 rounded-full text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/70 text-xs text-slate-300 truncate">
        {image.filename}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const router = useRouter()
  const currentPlayer = useGameStore(state => state.currentPlayer)
  const puzzleImages = useGameStore(state => state.puzzleImages)
  const setPuzzleImages = useGameStore(state => state.setPuzzleImages)

  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState('')
  const [showToast, setShowToast] = useState(false)
  const [images, setImages] = useState<ImageItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'images'>('leaderboard')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const showNotification = useCallback((message: string) => {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }, [])

  const {
    isConnected,
    players,
    gameState,
    startGame,
    resetGame,
    joinGame: socketJoinGame,
  } = useSocket({
    onPlayerCompleted: useCallback((event: PlayerCompletedEvent) => {
      setHighlightedPlayer(event.playerId)
      showNotification(`🎉 ${event.playerName} hoàn thành puzzle +${event.puzzleScore} điểm!`)
      setTimeout(() => setHighlightedPlayer(null), 2000)
    }, [showNotification]),
    onImagesUpdate: useCallback(() => {
      fetchImages()
    }, [])
  })

  useEffect(() => {
    if (currentPlayer && isConnected) {
      socketJoinGame(currentPlayer.id, currentPlayer.name, true)
    }
  }, [currentPlayer, isConnected, socketJoinGame])

  useEffect(() => {
    if (!currentPlayer || !currentPlayer.isGameMaster) {
      router.push('/')
    }
  }, [currentPlayer, router])

  const fetchImages = useCallback(async () => {
    try {
      const res = await fetch('/api/images')
      const data = await res.json()
      if (data.success) {
        setImages(data.images)
        const urls = data.images.map((img: any) => img.url)
        setPuzzleImages(urls)
      }
    } catch (error) {
      console.error('Failed to fetch images:', error)
    }
  }, [setPuzzleImages])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        showNotification('✅ Đã upload hình mới!')
        fetchImages()
      } else {
        showNotification(`❌ Upload thất bại: ${data.error}`)
      }
    } catch (error) {
      showNotification('❌ Upload thất bại!')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteImage = async (id: string) => {
    try {
      const res = await fetch(`/api/images/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        showNotification('🗑️ Đã xóa hình!')
        fetchImages()
      }
    } catch (error) {
      showNotification('❌ Xóa thất bại!')
    }
  }

  const handleStartGame = () => {
    const count = images.length || 5
    startGame(count)
    showNotification('🚀 Game đã bắt đầu!')
  }

  const handleResetGame = () => {
    if (confirm('Xác nhận reset game?')) {
      resetGame()
      showNotification('🔄 Game đã reset!')
    }
  }

  const sortedPlayers = [...players]
    .filter(p => !p.isGameMaster)
    .sort((a, b) => b.score - a.score)

  if (!currentPlayer?.isGameMaster) {
    return null
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <Toast message={toastMessage} isVisible={showToast} />

      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-heading text-gradient mb-2">Admin Dashboard</h1>
              <div className="flex items-center gap-3">
                <span className={`flex items-center gap-1 text-sm ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
                <span className="text-slate-400 text-sm">
                  {sortedPlayers.length} người chơi online
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleResetGame}
                className="btn btn-secondary"
              >
                Reset Game
              </button>
              <button
                onClick={handleStartGame}
                disabled={gameState?.isStarted || sortedPlayers.length === 0}
                className="btn btn-accent"
              >
                {gameState?.isStarted ? 'Đang chơi...' : 'Bắt đầu Game'}
              </button>
            </div>
          </div>
        </header>

        <div className="flex gap-2 mb-6 border-b border-slate-700 pb-2">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors border-b-2 ${activeTab === 'leaderboard'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-slate-400 hover:text-white'
              }`}
          >
            🏆 Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-colors border-b-2 ${activeTab === 'images'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-slate-400 hover:text-white'
              }`}
          >
            🖼️ Quản lý hình ({images.length})
          </button>
        </div>

        {activeTab === 'leaderboard' ? (
          <div className="space-y-4">
            {sortedPlayers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 card">
                <div className="text-6xl mb-4">👥</div>
                <p>Chưa có người chơi nào tham gia</p>
                <p className="text-sm mt-2">Đợi người chơi quét mã QR để kết nối...</p>
              </div>
            ) : (
              sortedPlayers.map((player, index) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  rank={index + 1}
                  totalPuzzles={gameState?.totalPuzzles || images.length}
                  isHighlighted={player.id === highlightedPlayer}
                />
              ))
            )}
          </div>
        ) : (
          <div className="animate-slide-up">
            <div className="mb-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUpload}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className={`btn btn-accent inline-flex items-center gap-2 cursor-pointer ${isUploading ? 'opacity-50 cursor-wait' : ''}`}
              >
                {isUploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang upload...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Upload hình mới
                  </>
                )}
              </label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map(image => (
                <ImageCard
                  key={image.id}
                  image={image}
                  onDelete={handleDeleteImage}
                />
              ))}
              {images.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-400 card">
                  <div className="text-6xl mb-4">🖼️</div>
                  <p>Chưa có hình puzzle nào</p>
                  <p className="text-sm mt-2">Upload hình mới để bắt đầu</p>
                </div>
              )}
            </div>
          </div>
        )}

        {gameState?.isStarted && (
          <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur border-t border-slate-700 p-4 z-40">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-500 font-medium">Game đang diễn ra (Move: {gameState.totalPuzzles})</span>
              </div>
              <div className="text-slate-400">
                {sortedPlayers.filter(p => p.completedPuzzles === (gameState?.totalPuzzles || 0)).length} / {sortedPlayers.length} đã hoàn thành
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
