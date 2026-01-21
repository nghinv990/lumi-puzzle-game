'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'
import { useGameStore } from '@/store/gameStore'
import { formatTime } from '@/lib/puzzleEngine'

export default function ResultPage() {
  const router = useRouter()
  const currentPlayer = useGameStore(state => state.currentPlayer)
  const puzzleResults = useGameStore(state => state.puzzleResults)
  const getFinalScore = useGameStore(state => state.getFinalScore)
  const resetGame = useGameStore(state => state.resetGame)
  const confettiRef = useRef(false)

  // Redirect if no player
  useEffect(() => {
    if (!currentPlayer) {
      router.push('/')
    }
  }, [currentPlayer, router])

  // Fire confetti
  useEffect(() => {
    if (confettiRef.current) return
    confettiRef.current = true

    const duration = 3000
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ['#3B82F6', '#F97316', '#22C55E'],
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ['#3B82F6', '#F97316', '#22C55E'],
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }

    frame()
  }, [])

  const handlePlayAgain = () => {
    resetGame()
    router.push('/')
  }

  if (!currentPlayer) return null

  const finalScore = getFinalScore()
  const totalTime = puzzleResults.reduce((sum, r) => sum + r.timeSeconds, 0)
  const totalMoves = puzzleResults.reduce((sum, r) => sum + r.moves, 0)

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-8 animate-slide-up">
          <div className="text-6xl mb-4 animate-float">🏆</div>
          <h1 className="text-4xl font-heading text-gradient mb-2">
            HOÀN THÀNH!
          </h1>
          <p className="text-xl text-slate-400">
            Chúc mừng {currentPlayer.name}!
          </p>
        </header>

        <div className="card-glass mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-linear-to-br from-blue-500 to-orange-500 flex items-center justify-center text-2xl font-heading text-white">
              {currentPlayer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-heading">{currentPlayer.name}</h2>
              <p className="text-slate-400">Người chơi xuất sắc</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-3xl font-heading text-gradient">{finalScore}</p>
              <p className="text-sm text-slate-400">điểm</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-heading text-blue-500">{puzzleResults.length}</p>
              <p className="text-sm text-slate-400">Câu đố</p>
            </div>
            <div>
              <p className="text-2xl font-heading text-orange-500">{formatTime(totalTime)}</p>
              <p className="text-sm text-slate-400">Thời gian</p>
            </div>
            <div>
              <p className="text-2xl font-heading text-green-500">{totalMoves}</p>
              <p className="text-sm text-slate-400">Lần di chuyển</p>
            </div>
          </div>
        </div>

        <div className="card mb-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-lg font-heading mb-4">Chi tiết từng câu đố</h2>
          <div className="space-y-2">
            {puzzleResults.map((result, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
              >
                <span className="text-slate-400">Câu đố #{index + 1}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span>⏱️ {formatTime(result.timeSeconds)}</span>
                  <span>🎯 {result.moves} lần</span>
                  <span className="font-heading text-green-500">+{result.score}</span>
                </div>
              </div>
            ))}
            {puzzleResults.length === 0 && (
              <p className="text-center text-slate-400">Chưa có kết quả nào.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <button
            onClick={handlePlayAgain}
            className="btn btn-accent btn-lg"
          >
            🔄 Chơi lại
          </button>
          <a
            href="https://lumi.vn"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-lg"
          >
            🏠 Khám phá Lumi
          </a>
        </div>
      </div>
    </div>
  )
}
