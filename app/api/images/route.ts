import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

// In-memory image storage for production (no file system access)
interface ImageData {
  id: string
  filename: string
  data: string // Base64 data URL or static path
  mimeType: string
  createdAt: number
  isDefault?: boolean // Mark as default image (from public/puzzles)
}

// Default images from public/puzzles folder
// These will always be available even after server restart
const DEFAULT_IMAGES: Omit<ImageData, 'createdAt'>[] = [
  { id: 'default_1', filename: '1.webp', data: '/puzzles/1.webp', mimeType: 'image/webp', isDefault: true },
  { id: 'default_2', filename: '2.webp', data: '/puzzles/2.webp', mimeType: 'image/webp', isDefault: true },
  { id: 'default_3', filename: '3.webp', data: '/puzzles/3.webp', mimeType: 'image/webp', isDefault: true },
  { id: 'default_4', filename: '4.webp', data: '/puzzles/4.webp', mimeType: 'image/webp', isDefault: true },
  { id: 'default_5', filename: '5.webp', data: '/puzzles/5.webp', mimeType: 'image/webp', isDefault: true },
  { id: 'default_6', filename: '6.webp', data: '/puzzles/6.webp', mimeType: 'image/webp', isDefault: true },
  { id: 'default_7', filename: '7.webp', data: '/puzzles/7.webp', mimeType: 'image/webp', isDefault: true },
]

// Global in-memory store
declare global {
  // eslint-disable-next-line no-var
  var imageStore: Map<string, ImageData> | undefined
}

// Initialize or get the global image store
function getImageStore(): Map<string, ImageData> {
  if (!global.imageStore) {
    global.imageStore = new Map<string, ImageData>()
    // Initialize with default images
    DEFAULT_IMAGES.forEach(img => {
      global.imageStore!.set(img.id, { ...img, createdAt: Date.now() })
    })
  }
  return global.imageStore
}

// GET /api/images - List all puzzle images
export async function GET() {
  try {
    const store = getImageStore()
    const images = Array.from(store.values()).map(img => ({
      id: img.id,
      filename: img.filename,
      url: img.data, // Return base64 data URL directly
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

    // Validate file size (max 5MB to avoid memory issues)
    const MAX_SIZE = 5 * 1024 * 1024 // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Image size must be less than 5MB' },
        { status: 400 }
      )
    }

    // Generate unique ID
    const id = `puzzle_${uuidv4().slice(0, 8)}`
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${id}.${ext}`

    // Convert to base64 data URL
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    // Store in memory
    const store = getImageStore()
    const imageData: ImageData = {
      id,
      filename,
      data: dataUrl,
      mimeType: file.type,
      createdAt: Date.now(),
    }
    store.set(id, imageData)

    console.log(`[API] Image uploaded: ${filename} (in-memory)`)

    // Emit socket event if available
    const io = (global as any).io
    if (io) {
      io.emit('images:update')
    }

    return NextResponse.json({
      success: true,
      image: {
        id,
        filename,
        url: dataUrl,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}

// PUT /api/images - Reset/Switch image set
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { set } = body // 'default' | 'test'

    const store = getImageStore()
    store.clear()

    let imagesToLoad: Omit<ImageData, 'createdAt'>[] = []

    if (set === 'test') {
      // Images from public/puzzles-test
      imagesToLoad = [
        { id: 'test_1', filename: '1.webp', data: '/puzzles-test/1.webp', mimeType: 'image/webp', isDefault: true },
        // { id: 'test_2', filename: '2.webp', data: '/puzzles-test/2.webp', mimeType: 'image/webp', isDefault: true },
        // { id: 'test_3', filename: '3.webp', data: '/puzzles-test/3.webp', mimeType: 'image/webp', isDefault: true },
        // { id: 'test_4', filename: '4.webp', data: '/puzzles-test/4.webp', mimeType: 'image/webp', isDefault: true },
        // { id: 'test_5', filename: '5.webp', data: '/puzzles-test/5.webp', mimeType: 'image/webp', isDefault: true },
      ]
    } else {
      // Default images
      imagesToLoad = DEFAULT_IMAGES
    }

    imagesToLoad.forEach(img => {
      store.set(img.id, { ...img, createdAt: Date.now() })
    })

    // Emit socket event if available
    const io = (global as any).io
    if (io) {
      io.emit('images:update')
    }

    const images = Array.from(store.values()).map(img => ({
      id: img.id,
      filename: img.filename,
      url: img.data,
    }))

    return NextResponse.json({ success: true, count: store.size, images })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
