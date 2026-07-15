import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';

const safePart = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');

function configureCloudinary() {
  // This is intentionally evaluated at request time, after dotenv has loaded.
  if (!process.env.CLOUDINARY_URL) throw new Error('CLOUDINARY_URL is not configured.');
  cloudinary.config(true);
}

export function mediaStorageConfigured() {
  return Boolean(process.env.CLOUDINARY_URL);
}

export async function uploadMedia(file: Express.Multer.File, requestedFolder: string) {
  configureCloudinary();
  const folder = safePart(requestedFolder || 'general') || 'general';

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: `media/${folder}`,
      unique_filename: true,
      overwrite: false,
      resource_type: 'image',
      use_filename: true,
    }, (error?: UploadApiErrorResponse, uploaded?: UploadApiResponse) => {
      if (error) return reject(error);
      if (!uploaded) return reject(new Error('Cloudinary did not return an upload result.'));
      resolve(uploaded);
    });

    stream.end(file.buffer);
  });

  return { key: result.public_id, url: result.secure_url, folder };
}

export async function deleteMedia(publicId: string) {
  configureCloudinary();
  const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new Error(`Cloudinary could not delete ${publicId}.`);
  }
}
