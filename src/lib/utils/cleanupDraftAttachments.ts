import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'message-attachments'
const DRAFT_ROOT = 'draft'
const DRAFT_RETENTION_MS = 24 * 60 * 60 * 1000
const LIST_LIMIT = 1000

type StorageEntry = {
  name: string
  id?: string | null
  created_at?: string | null
  updated_at?: string | null
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

/** Removes only stale draft objects that are not attached to a message. */
export async function cleanupOrphanedDraftAttachments(userId: string): Promise<number> {
  const adminClient = createAdminClient()
  const storage = adminClient.storage.from(BUCKET)
  const userRoot = `${DRAFT_ROOT}/${userId}`
  const cutoff = Date.now() - DRAFT_RETENTION_MS

  const { data: draftFolders, error: folderError } = await storage.list(userRoot, {
    limit: LIST_LIMIT,
    sortBy: { column: 'created_at', order: 'asc' },
  })

  if (folderError) {
    throw folderError
  }

  const draftFiles: Array<{ path: string; createdAt: number }> = []
  for (const folder of (draftFolders || []) as StorageEntry[]) {
    // A draft upload creates a UUID folder under draft/{userId}.
    if (folder.id !== null && folder.id !== undefined) continue

    const folderPath = `${userRoot}/${folder.name}`
    const { data: files, error: fileError } = await storage.list(folderPath, {
      limit: LIST_LIMIT,
      sortBy: { column: 'created_at', order: 'asc' },
    })

    if (fileError) {
      throw fileError
    }

    for (const file of (files || []) as StorageEntry[]) {
      const createdAt = new Date(file.created_at || file.updated_at || 0).getTime()
      if (file.id && createdAt > 0 && createdAt < cutoff) {
        draftFiles.push({ path: `${folderPath}/${file.name}`, createdAt })
      }
    }
  }

  if (draftFiles.length === 0) return 0

  const paths = draftFiles.map((file) => file.path)
  const { data: references, error: referenceError } = await adminClient
    .from('message_attachments')
    .select('file_path')
    .in('file_path', paths)

  if (referenceError) {
    throw referenceError
  }

  const referencedPaths = new Set((references || []).map((row) => row.file_path))
  const orphanPaths = paths.filter((path) => !referencedPaths.has(path))
  let deletedCount = 0

  for (const pathChunk of chunks(orphanPaths, 100)) {
    const { error: removeError } = await storage.remove(pathChunk)
    if (removeError) throw removeError
    deletedCount += pathChunk.length
  }

  return deletedCount
}
