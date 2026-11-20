import { Router } from "express";
import { UploadController } from "../controllers/uploadController";
import { verifyToken } from "../middlewares/authMiddleware";
import { uploadSingleImage } from "../middlewares/uploadMiddleware";

const router = Router();

// Uploading equipment photos requires authentication
router.use(verifyToken);

// Multipart form upload under field 'image' or JSON body with base64
router.post("/image", uploadSingleImage, UploadController.upload);
router.post("/", uploadSingleImage, UploadController.upload);

export const uploadRoutes = router;
