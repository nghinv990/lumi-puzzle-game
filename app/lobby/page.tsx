'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/store/gameStore'
import { useSocket } from '@/hooks/useSocket'

// Icons
const UserGroupIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
)

const CheckCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
)

const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
)

const PuzzleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
    />
  </svg>
)

const CrownIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" />
  </svg>
)

export default function LobbyPage() {
  const router = useRouter()
  const currentPlayer = useGameStore(state => state.currentPlayer)
  const setPlayerReady = useGameStore(state => state.setPlayerReady)
  const setGameStarted = useGameStore(state => state.setGameStarted)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Socket connection
  const {
    isConnected,
    players,
    gameState,
    joinGame: socketJoin,
    setReady: socketSetReady,
    startGame: socketStartGame,
  } = useSocket({
    onGameStarted: useCallback((state: any) => {
      // Game started by admin, start countdown
      console.log('Game started event received', state)
      setGameStarted(true)
      setCountdown(3)
    }, [setGameStarted]),
  })

  // Ensure socket join if refreshed
  useEffect(() => {
    if (currentPlayer && isConnected) {
      // Re-join if needed (socket might have disconnected)
      if (!players.find(p => p.id === currentPlayer.id)) {
        socketJoin(currentPlayer.id, currentPlayer.name, currentPlayer.isGameMaster)
      }
    }
  }, [currentPlayer, isConnected, socketJoin, players])

  // Redirect if no player
  useEffect(() => {
    if (!currentPlayer) {
      router.push('/')
    }
  }, [currentPlayer, router])

  // Countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) return

    const timer = setTimeout(() => {
      if (countdown === 1) {
        router.push('/game')
      } else {
        setCountdown(countdown - 1)
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown, router])

  // Handle ready toggle
  const handleReadyToggle = () => {
    if (!currentPlayer) return

    // Optimistic update
    setPlayerReady(currentPlayer.id, !currentPlayer.isReady)

    if (isConnected) {
      socketSetReady(!currentPlayer.isReady)
    }
  }

  // Handle Game Master start
  const handleStartGame = () => {
    if (currentPlayer?.isGameMaster) {
      socketStartGame(5) // Default 5 puzzles for now, will get from API later
    }
  }

  if (!currentPlayer) return null

  const readyCount = players.filter(p => p.isReady).length
  const totalPuzzles = gameState?.totalPuzzles || 0
  const isGameMaster = currentPlayer.isGameMaster

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 animate-slide-up">
          <h1 className="text-3xl md:text-4xl font-heading text-gradient mb-2">
            Phòng Chờ
          </h1>
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {isConnected ? 'Đã kết nối server' : 'Chế độ offline'}
          </div>
          <p className="text-slate-400 mt-2">
            {isGameMaster
              ? 'Bạn là Game Master - Nhấn nút để bắt đầu game!'
              : 'Chờ Game Master (admin) bắt đầu game'
            }
          </p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="card text-center">
            <div className="flex items-center justify-center gap-2 text-blue-500 mb-1">
              <UserGroupIcon />
              <span className="text-2xl font-heading">{players.length}</span>
            </div>
            <p className="text-sm text-slate-400">Người chơi</p>
          </div>

          <div className="card text-center">
            <div className="flex items-center justify-center gap-2 text-green-500 mb-1">
              <CheckCircleIcon />
              <span className="text-2xl font-heading">{readyCount}</span>
            </div>
            <p className="text-sm text-slate-400">Sẵn sàng</p>
          </div>

          <div className="card text-center hidden md:block">
            <div className="flex items-center justify-center gap-2 text-orange-500 mb-1">
              <PuzzleIcon />
              <span className="text-2xl font-heading">?</span>
            </div>
            <p className="text-sm text-slate-400">Câu đố</p>
          </div>
        </div>

        {/* Countdown Overlay */}
        {countdown !== null && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="text-center animate-scale-in">
              <p className="text-slate-400 text-xl mb-4">
                Game bắt đầu sau
              </p>
              <div className="text-8xl font-heading text-gradient glow-text animate-pulse-glow">
                {countdown}
              </div>
            </div>
          </div>
        )}

        {/* Waiting for admin message */}
        {gameState?.isStarted && countdown === null && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="text-center animate-scale-in">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400 text-xl">Game đang bắt đầu...</p>
            </div>
          </div>
        )}

        {/* Player List */}
        <div className="card-glass mb-8">
          <h2 className="text-xl font-heading mb-4! flex items-center gap-2">
            <UserGroupIcon />
            Danh sách người chơi
          </h2>

          <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {players.filter(p => !p.isGameMaster).map((player, index) => (
              <div
                key={player.id}
                className={`
                  flex items-center justify-between p-3 rounded-lg
                  ${player.name === currentPlayer.name
                    ? 'bg-blue-500/20 border border-blue-500/30'
                    : 'bg-slate-800'
                  }
                `}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-heading relative
                    ${player.name === currentPlayer.name
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-700'
                    }
                  `}>
                    {player.name.charAt(0).toUpperCase()}
                    {player.isGameMaster && (
                      <span className="absolute -top-1 -right-1 text-yellow-400">
                        <CrownIcon />
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {player.name}
                      {player.isGameMaster && (
                        <span className="text-yellow-400 text-xs font-medium px-2 py-0.5 bg-yellow-400/20 rounded-full">
                          Game Master
                        </span>
                      )}
                      {(player.name === currentPlayer.name) && (
                        <span className="text-blue-500 text-sm">(Bạn)</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className={`
                  px-3 py-1 rounded-full text-sm font-medium
                  ${player.isReady
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-slate-700 text-slate-400'
                  }
                `}>
                  {player.isReady ? 'Sẵn sàng' : 'Đang chờ'}
                </div>
              </div>
            ))}

            {players.filter(p => !p.isGameMaster).length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <p>Đang chờ người chơi tham gia...</p>
              </div>
            )}
          </div>
        </div>

        {/* Game Rules */}
        <div className="card mb-8">
          <h2 className="text-lg font-heading mb-3!">📋 Luật chơi</h2>
          <ul className="space-y-2 text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              Ghép đúng các hình ảnh theo thứ tự
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              Kéo thả các mảnh ghép để hoán đổi vị trí
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              Điểm số tính theo thời gian và số lần di chuyển
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              Top 5 người chơi xuất sắc nhất sẽ được vinh danh!
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {/* Ready Button - for regular players */}
          {!isGameMaster && (
            <button
              onClick={handleReadyToggle}
              className={`
                btn btn-lg min-w-[200px]
                ${currentPlayer.isReady ? 'btn-outline' : 'btn-accent'}
              `}
            >
              {currentPlayer.isReady ? (
                <>
                  <ClockIcon />
                  Đợi Game Master...
                </>
              ) : (
                <>
                  <CheckCircleIcon />
                  Tôi sẵn sàng!
                </>
              )}
            </button>
          )}

          {/* Start Button - for Game Master only */}
          {isGameMaster && (
            <button
              onClick={handleStartGame}
              disabled={countdown !== null}
              className="btn btn-accent btn-lg min-w-[250px] glow-accent disabled:opacity-50"
            >
              {countdown !== null ? 'Đang bắt đầu...' : 'BẮT ĐẦU GAME!'}
            </button>
          )}
        </div>

        {/* Game Master Info */}
        {isGameMaster && (
          <div className="text-center mt-4">
            <p className="text-slate-400 text-sm">
              Khi bạn nhấn nút, tất cả người chơi sẽ cùng bắt đầu game
            </p>
            <button
              onClick={() => router.push('/admin')}
              className="mt-4 text-blue-500 hover:text-blue-400 text-sm underline"
            >
              Tôi là admin - Chuyển sang Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
