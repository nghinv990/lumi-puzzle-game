import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const IMAGES_DIR = path.join(process.cwd(), 'public', 'puzzles')

// Ensure directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true })
}

// GET /api/images - List all puzzle images
export async function GET() {
  try {
    const files = fs.readdirSync(IMAGES_DIR)
    const images = files
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .map(filename => ({
        id: filename,
        filename,
        url: `/puzzles/${filename}`,
      }))

    return NextResponse.json({ success: true, images })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}

// POST /api/images - Upload new image
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Only JPEG, PNG, and WebP images are allowed' },
        { status: 400 }
      )
    }

    // Generate filename
    const ext = path.extname(file.name) || '.jpg'
    const filename = `puzzle_${uuidv4().slice(0, 8)}${ext}`
    const filepath = path.join(IMAGES_DIR, filename)

    // Write file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    fs.writeFileSync(filepath, buffer)

    console.log(`[API] Image uploaded: ${filename}`)

    // Emit socket event if available
    const io = (global as any).io
    if (io) {
      io.emit('images:update')
    }

    return NextResponse.json({
      success: true,
      image: {
        id: filename,
        filename,
        url: `/puzzles/${filename}`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
