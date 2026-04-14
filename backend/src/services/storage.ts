import { supabase } from '../config/supabase'
import { v4 as uuidv4 } from 'uuid'

const BUCKET = 'restaurant-images'

export async function uploadItemImage(
  restaurantId: number,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<string> {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  const path = `${restaurantId}/items/${uuidv4()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, fileBuffer, {
    contentType: mimeType,
    upsert: false,
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteImage(url: string): Promise<void> {
  // Extract path from public URL
  const bucketPrefix = `/storage/v1/object/public/${BUCKET}/`
  const idx = url.indexOf(bucketPrefix)
  if (idx === -1) return
  const path = url.slice(idx + bucketPrefix.length)
  await supabase.storage.from(BUCKET).remove([path])
}

export async function ensureBucketExists(): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (buckets?.find((b) => b.name === BUCKET)) return
  await supabase.storage.createBucket(BUCKET, { public: true })
}
