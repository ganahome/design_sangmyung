import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'sangmyung-storage';

export const isSupabaseStorageEnabled = Boolean(supabaseUrl && supabaseKey);

export let supabaseClient = null;
if (isSupabaseStorageEnabled) {
  supabaseClient = createClient(supabaseUrl, supabaseKey);
  console.log('[Storage] Supabase Storage client initialized for bucket:', bucketName);
} else {
  console.log('[Storage] Running with local disk storage (SUPABASE_URL not configured).');
}

/**
 * Upload a local file to Supabase Storage if configured
 * Returns the public URL if uploaded, or null to keep local relative path
 */
export async function uploadToSupabaseStorage(localFilePath, destinationPath, mimeType) {
  if (!isSupabaseStorageEnabled || !supabaseClient) return null;

  try {
    const fileBuffer = await fs.promises.readFile(localFilePath);
    const { data, error } = await supabaseClient.storage
      .from(bucketName)
      .upload(destinationPath, fileBuffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error('[Storage] Supabase upload failed:', error.message);
      return null;
    }

    const { data: publicData } = supabaseClient.storage
      .from(bucketName)
      .getPublicUrl(destinationPath);

    return publicData.publicUrl;
  } catch (err) {
    console.error('[Storage] Error during Supabase upload:', err.message);
    return null;
  }
}
