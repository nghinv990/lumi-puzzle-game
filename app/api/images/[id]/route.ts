import { NextRequest, NextResponse } from 'next/server'

// Get reference to the global image store
// Type matches the ImageData interface in ../route.ts
declare global {
  // eslint-disable-next-line no-var
  var imageStore: Map<string, {
    id: string
    filename: string
    data: string
    mimeType: string
    createdAt: number
    isDefault?: boolean
  }> | undefined
}

function getImageStore(): Map<string, any> {
  if (!global.imageStore) {
    global.imageStore = new Map<string, any>()
  }
  return global.imageStore
}

// DELETE /api/images/[id] - Delete image by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const store = getImageStore()

    // Try to find image by id
    if (!store.has(id)) {
      // Also try to find by filename (for backwards compatibility)
      let found = false
      for (const [key, value] of store.entries()) {
        if (value.filename === id) {
          store.delete(key)
          found = true
          break
        }
      }
      if (!found) {
        return NextResponse.json(
          { success: false, error: 'Image not found' },
          { status: 404 }
        )
      }
    } else {
      store.delete(id)
    }

    console.log(`[API] Image deleted: ${id}`)

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
