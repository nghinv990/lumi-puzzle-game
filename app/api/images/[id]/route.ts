import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const IMAGES_DIR = path.join(process.cwd(), 'public', 'puzzles')

// DELETE /api/images/[id] - Delete image by filename
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: filename } = await params
    const filepath = path.join(IMAGES_DIR, filename)

    if (!fs.existsSync(filepath)) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      )
    }

    fs.unlinkSync(filepath)
    console.log(`[API] Image deleted: ${filename}`)

    // Emit socket event if available
    const io = (global as any).io
    if (io) {
      io.emit('images:update')
    }

    return NextResponse.json({ success: true, message: 'Image deleted' })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
