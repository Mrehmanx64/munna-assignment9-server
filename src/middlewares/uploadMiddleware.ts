import multer from "multer";
import { Request } from "express";
import { ApiError } from "../utils/ApiError";

// Memory storage keeps file buffers in RAM for direct transmission to imgbb
const storage = multer.memoryStorage();

// Permitted MIME types for equipment photography
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      ApiError.badRequest(
        `Unsupported file type: ${file.mimetype}. Permitted formats are JPEG, PNG, WEBP, and GIF.`
      )
    );
  }
};

export const uploadSingleImage = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter,
}).single("image");
