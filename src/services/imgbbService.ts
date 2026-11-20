import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

export interface ImgBBUploadResult {
  url: string;
  displayUrl: string;
  deleteUrl?: string;
  thumbnail?: string;
  id?: string;
  title?: string;
}

export class ImgBBService {
  private static readonly IMGBB_API_URL = "https://api.imgbb.com/1/upload";

  /**
   * Upload image buffer to ImgBB
   */
  public static async uploadBuffer(
    buffer: Buffer,
    fileName = "equipment-photo"
  ): Promise<ImgBBUploadResult> {
    const isTest = process.env.NODE_ENV === "test" || env.NODE_ENV === "test";
    if (!env.IMGBB_API_KEY || env.IMGBB_API_KEY === "placeholder_imgbb_key") {
      // In development or test without valid live ImgBB key, provide clear operational error or simulation
      if (isTest) {
        return {
          url: `https://i.ibb.co/test/${Date.now()}-${fileName}.jpg`,
          displayUrl: `https://i.ibb.co/test/${Date.now()}-${fileName}.jpg`,
          deleteUrl: `https://ibb.co/delete/test`,
        };
      }
      throw ApiError.badRequest(
        "ImgBB API key is not configured or is a placeholder. Please set a valid IMGBB_API_KEY in server/.env"
      );
    }

    const base64String = buffer.toString("base64");
    return this.sendToImgBB(base64String, fileName);
  }

  /**
   * Upload base64 encoded image to ImgBB
   */
  public static async uploadBase64(
    base64Data: string,
    name = "equipment-photo"
  ): Promise<ImgBBUploadResult> {
    const isTest = process.env.NODE_ENV === "test" || env.NODE_ENV === "test";
    if (!env.IMGBB_API_KEY || env.IMGBB_API_KEY === "placeholder_imgbb_key") {
      if (isTest) {
        return {
          url: `https://i.ibb.co/test/${Date.now()}-${name}.jpg`,
          displayUrl: `https://i.ibb.co/test/${Date.now()}-${name}.jpg`,
          deleteUrl: `https://ibb.co/delete/test`,
        };
      }
      throw ApiError.badRequest(
        "ImgBB API key is not configured or is a placeholder. Please set a valid IMGBB_API_KEY in server/.env"
      );
    }

    // Strip Data URI prefix if present (e.g. data:image/png;base64,...)
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");
    return this.sendToImgBB(cleanBase64, name);
  }

  /**
   * Internal helper to execute HTTP POST to ImgBB
   */
  private static async sendToImgBB(
    base64Image: string,
    name: string
  ): Promise<ImgBBUploadResult> {
    try {
      const formData = new FormData();
      formData.append("image", base64Image);
      formData.append("name", name);

      const url = `${this.IMGBB_API_URL}?key=${encodeURIComponent(env.IMGBB_API_KEY)}`;

      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      const responseData: any = await response.json();

      if (!response.ok || !responseData.success) {
        const errorMsg =
          responseData?.error?.message ||
          `ImgBB upload failed with status ${response.status}`;
        throw ApiError.badRequest(`ImgBB upload error: ${errorMsg}`);
      }

      const data = responseData.data;

      return {
        url: data.url,
        displayUrl: data.display_url || data.url,
        deleteUrl: data.delete_url,
        thumbnail: data.thumb?.url,
        id: data.id,
        title: data.title,
      };
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw ApiError.badRequest(
        `Failed to reach ImgBB service: ${err.message || "Network error"}`
      );
    }
  }
}
