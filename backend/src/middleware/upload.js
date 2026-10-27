import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'backend/uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => {
    const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype];
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  }
});

export const uploadImages = multer({
  storage,
  limits: { files: 8, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new Error('Only JPG, PNG, and WebP images are accepted.'));
    }
    callback(null, true);
  }
});

export function verifyImageFiles(files = []) {
  const invalid = files.some((file) => {
    const header = fs.readFileSync(file.path).subarray(0, 12);
    const jpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const png = header.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp = header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
    return !((file.mimetype === 'image/jpeg' && jpeg) || (file.mimetype === 'image/png' && png) || (file.mimetype === 'image/webp' && webp));
  });
  if (invalid) {
    files.forEach((file) => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
    throw Object.assign(new Error('One or more uploaded files are not valid JPG, PNG, or WebP images.'), { status: 400 });
  }
}

export function uploadedPhotoPaths(files = []) {
  return files.map((file) => `/uploads/${path.basename(file.filename)}`);
}
