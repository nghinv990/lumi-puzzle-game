'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useGameStore, createPlayer } from '@/store/gameStore'
import { useSocket } from '@/hooks/useSocket'

// Lumi Logo SVG
const LumiLogo = () => (
  <svg viewBox="0 0 120 40" className="w-32 h-auto">
    <defs>
      <linearGradient id="lumiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#F97316" />
      </linearGradient>
    </defs>
    <text
      x="60"
      y="30"
      textAnchor="middle"
      fill="url(#lumiGradient)"
      fontFamily="'Russo One', sans-serif"
      fontSize="28"
      fontWeight="bold"
    >
      LUMI
    </text>
  </svg>
)

// User Icon
const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
)

// Crown Icon for Game Master
const CrownIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" />
  </svg>
)

// Generate QR Code URL (using QR code API)
const getQRCodeUrl = (gameUrl: string) => {
  const encodedUrl = encodeURIComponent(gameUrl)
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}&bgcolor=ffffff&color=0f172a`
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setCurrentPlayer = useGameStore(state => state.setCurrentPlayer)
  const { joinGame } = useSocket()

  const [name, setName] = useState('')
  const [isGameMaster, setIsGameMaster] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [gameUrl, setGameUrl] = useState('')

  // Set game URL on mount
  useEffect(() => {
    setGameUrl(`${window.location.origin}${window.location.pathname}`)
  }, [])

  // Auto-fill name from QR scan (via URL param)
  useEffect(() => {
    const nameFromQR = searchParams?.get('name')
    if (nameFromQR) {
      setName(nameFromQR)
    }
  }, [searchParams])

  // Auto-detect Game Master status if name is 'admin'
  useEffect(() => {
    setIsGameMaster(name.trim().toLowerCase() === 'admin')
  }, [name])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Vui lòng nhập tên của bạn')
      return
    }

    if (name.trim().length < 2) {
      setError('Tên phải có ít nhất 2 ký tự')
      return
    }

    setIsLoading(true)
    setError('')

    // Simulate loading
    await new Promise(resolve => setTimeout(resolve, 500))

    const player = createPlayer(name, isGameMaster)
    setCurrentPlayer(player)

    // Join via socket
    joinGame(player.id, player.name, player.isGameMaster)

    // Redirect admin to dashboard, regular players to lobby
    if (isGameMaster) {
      router.push('/admin')
    } else {
      router.push('/lobby')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-full h-full rounded-full opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)',
            top: '-50%',
            left: '-50%'
          }}
        />
        <div
          className="absolute w-full h-full rounded-full opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(circle, #F97316 0%, transparent 70%)',
            bottom: '-50%',
            right: '-50%'
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block animate-float">
            <LumiLogo />
          </div>
          <h1 className="text-3xl font-heading mt-4 text-gradient">
            PUZZLE GAME
          </h1>
          <p className="text-slate-400 mt-2">
            Thử thách trí tuệ - Ghép hình siêu tốc
          </p>
        </div>

        {/* Login Card */}
        <div className="card-glass">
          {/* QR Code Display */}
          <div className="text-center mb-6">
            <p className="text-sm text-slate-400 mb-3">
              Quét mã QR để tham gia trên thiết bị khác
            </p>
            <div className="relative inline-block p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 group">
              <div className="absolute inset-0 bg-blue-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-2 bg-white rounded-xl shadow-inner">
                {gameUrl && (
                  <img
                    src={getQRCodeUrl(gameUrl)}
                    alt="QR Code để tham gia game"
                    className="w-40 h-40"
                    loading="lazy"
                  />
                )}
                {/* Scanner Line Animation */}
                <div className="absolute inset-x-2 top-2 h-0.5 bg-blue-500/50 shadow-[0_0_10px_#3B82F6] animate-[scan_2s_linear_infinite]" />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-slate-600" />
            <span className="text-slate-400 text-sm">hoặc nhập tên</span>
            <div className="flex-1 h-px bg-slate-600" />
          </div>

          {/* Name Input Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="playerName" className="block text-sm font-medium mb-2">
                Nhập tên của bạn
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <UserIcon />
                </span>
                <input
                  id="playerName"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setError('')
                  }}
                  placeholder="VD: Nguyễn Văn A"
                  className="input pl-12! pr-12!"
                  maxLength={20}
                  autoComplete="off"
                  autoFocus
                />
                {isGameMaster && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-500 animate-scale-in flex items-center gap-1">
                    <CrownIcon />
                    <span className="text-[10px] font-bold uppercase tracking-wider">GM</span>
                  </span>
                )}
              </div>
              {error && (
                <p className="text-red-500 text-sm mt-2 animate-shake">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn btn-accent btn-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang tham gia...
                </span>
              ) : (
                isGameMaster ? 'Tạo phòng & Tham gia' : 'Tham gia ngay'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-400 text-sm mt-6">
          Nhà thông minh{' '}
          <a
            href="https://lumi.vn"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Lumi
          </a>
          {' '}© 2026
        </p>
      </div>
    </div>
  )
}
