import { Request, Response } from "express";
import { ImgBBService } from "../services/imgbbService";
import { ResponseFormatter } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";

export class UploadController {
  /**
   * POST /api/uploads/image
   * Accepts multipart file ('image') or JSON body with base64 ('image')
   */
  public static upload = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // 1. Multipart form file upload
    if (req.file) {
      const result = await ImgBBService.uploadBuffer(
        req.file.buffer,
        req.file.originalname
      );
      ResponseFormatter.created(res, "Image uploaded successfully to ImgBB", result);
      return;
    }

    // 2. Base64 payload in JSON
    if (req.body?.image && typeof req.body.image === "string") {
      const result = await ImgBBService.uploadBase64(
        req.body.image,
        req.body.name || "equipment-upload"
      );
      ResponseFormatter.created(res, "Image uploaded successfully to ImgBB", result);
      return;
    }

    throw ApiError.badRequest(
      "No image provided. Please upload a file via multipart/form-data under field 'image' or supply a base64 string in JSON."
    );
  });
}
