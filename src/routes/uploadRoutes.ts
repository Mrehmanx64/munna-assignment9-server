import { Router } from "express";
import { UploadController } from "../controllers/uploadController";
import { verifyToken } from "../middlewares/authMiddleware";
import { uploadSingleImage } from "../middlewares/uploadMiddleware";

const router = Router();

// Public photo upload (supports registration avatar uploads without prior auth token)
router.post("/avatar", uploadSingleImage, UploadController.upload);

// Authenticated equipment photo uploads
router.use(verifyToken);

// Multipart form upload under field 'image' or JSON body with base64
router.post("/image", uploadSingleImage, UploadController.upload);
router.post("/", uploadSingleImage, UploadController.upload);

export const uploadRoutes = router;
