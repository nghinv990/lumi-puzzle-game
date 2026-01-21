export interface ImageSlice {
  index: number
  dataUrl: string
}

export interface ShuffledPiece {
  originalIndex: number
  currentIndex: number
  dataUrl: string
}

/**
 * Slice an image into 9 equal pieces (3x3 grid)
 */
export async function sliceImage(imageSrc: string): Promise<ImageSlice[]> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const pieces: ImageSlice[] = []
      const pieceWidth = img.width / 3
      const pieceHeight = img.height / 3

      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const canvas = document.createElement('canvas')
          canvas.width = pieceWidth
          canvas.height = pieceHeight

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          ctx.drawImage(
            img,
            col * pieceWidth,
            row * pieceHeight,
            pieceWidth,
            pieceHeight,
            0,
            0,
            pieceWidth,
            pieceHeight
          )

          pieces.push({
            index: row * 3 + col,
            dataUrl: canvas.toDataURL('image/jpeg', 0.9),
          })
        }
      }

      resolve(pieces)
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = imageSrc
  })
}

/**
 * Fisher-Yates shuffle algorithm
 * Returns shuffled pieces with their original indices
 */
export function shufflePieces(pieces: ImageSlice[]): ShuffledPiece[] {
  const shuffled = [...pieces]

  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  // Ensure it's not already solved
  const isSolved = shuffled.every((piece, idx) => piece.index === idx)
  if (isSolved && shuffled.length > 1) {
    ;[shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]]
  }

  return shuffled.map((piece, currentIndex) => ({
    originalIndex: piece.index,
    currentIndex,
    dataUrl: piece.dataUrl,
  }))
}

/**
 * Validate if the puzzle is solved correctly
 * Each piece's originalIndex should match its position in the array
 */
export function validateSolution(pieces: ShuffledPiece[]): boolean {
  const isSolved = pieces.every((piece, idx) => piece.originalIndex === idx)

  console.log('[Puzzle] Validation:', {
    isSolved,
    pieces: pieces.map((p, i) => ({
      pos: i,
      orig: p.originalIndex,
      match: p.originalIndex === i
    }))
  })

  return isSolved
}

/**
 * Swap two pieces in the array
 */
export function swapPieces(
  pieces: ShuffledPiece[],
  fromIndex: number,
  toIndex: number
): ShuffledPiece[] {
  const newPieces = [...pieces]
  const fromPiece = { ...newPieces[fromIndex], currentIndex: toIndex }
  const toPiece = { ...newPieces[toIndex], currentIndex: fromIndex }

  newPieces[fromIndex] = toPiece
  newPieces[toIndex] = fromPiece

  return newPieces
}

/**
 * Calculate score based on time and moves
 * Higher score for faster completion with fewer moves
 */
export function calculateScore(timeSeconds: number, moves: number): number {
  // Base score
  const baseScore = 1000

  // Time penalty: lose 10 points per second after 30 seconds
  const timePenalty = Math.max(0, (timeSeconds - 30) * 10)

  // Move penalty: lose 5 points per move after 9 moves (minimum possible)
  const movePenalty = Math.max(0, (moves - 9) * 5)

  // Bonus for fast completion (under 20 seconds)
  const timeBonus = timeSeconds < 20 ? (20 - timeSeconds) * 20 : 0

  // Bonus for efficient moves (under 15 moves)
  const moveBonus = moves < 15 ? (15 - moves) * 10 : 0

  const finalScore = Math.max(0, baseScore - timePenalty - movePenalty + timeBonus + moveBonus)

  return Math.round(finalScore)
}

/**
 * Format time as MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}
