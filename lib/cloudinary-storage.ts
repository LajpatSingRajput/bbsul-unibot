/**
 * Cloudinary storage adapter — replaces Firebase Storage.
 * Stores raw document files as base64 "raw" resources so they can be
 * downloaded and re-extracted during reprocess / delete flows.
 */
import { v2 as cloudinary } from "cloudinary";

function client() {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  )
    throw new Error("Cloudinary configuration is incomplete.");
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

/**
 * Upload a file Buffer to Cloudinary.
 * @param storagePath  e.g. "documents/uuid/source.pdf"
 * @param bytes        file contents
 */
export async function cloudinaryUpload(
  storagePath: string,
  bytes: Buffer,
): Promise<void> {
  const cl = client();
  // Convert storagePath to a safe Cloudinary public_id (no extension needed for raw)
  const publicId = storagePath.replace(/\.[^/.]+$/, "").replace(/\//g, "__");
  await new Promise<void>((resolve, reject) => {
    const stream = cl.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
        overwrite: true,
        use_filename: false,
      },
      (err, result) => {
        if (err) reject(err);
        else resolve();
      },
    );
    stream.end(bytes);
  });
}

/**
 * Download a file from Cloudinary and return it as a Buffer.
 * @param storagePath  e.g. "documents/uuid/source.pdf"
 */
export async function cloudinaryDownload(storagePath: string): Promise<Buffer> {
  client(); // validates config
  const publicId = storagePath.replace(/\.[^/.]+$/, "").replace(/\//g, "__");
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const url = `https://res.cloudinary.com/${cloudName}/raw/upload/${publicId}`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Cloudinary download failed: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Delete a file from Cloudinary (ignores "not found" errors).
 * @param storagePath  e.g. "documents/uuid/source.pdf"
 */
export async function cloudinaryDelete(storagePath: string): Promise<void> {
  const cl = client();
  const publicId = storagePath.replace(/\.[^/.]+$/, "").replace(/\//g, "__");
  try {
    await cl.uploader.destroy(publicId, { resource_type: "raw" });
  } catch {
    // ignore — file may already be gone
  }
}
