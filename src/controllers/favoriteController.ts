import { Request, Response } from "express";
import { FavoriteService } from "../services/favoriteService";
import { asyncHandler } from "../utils/asyncHandler";
import { ResponseFormatter } from "../utils/ApiResponse";
import { FavoriteQueryInput } from "../validators/favoriteValidators";

export class FavoriteController {
  /**
   * POST /api/favorites/:equipmentId
   * Add equipment to customer's favorites
   */
  public static addFavorite = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const customerId = req.user!.id;
    const equipmentId = req.params.equipmentId as string;

    const result = await FavoriteService.addFavorite(customerId, equipmentId);

    ResponseFormatter.created(res, result.message, {
      favorited: result.favorited,
      favorite: result.favorite,
    });
  });

  /**
   * GET /api/favorites
   * List authenticated customer's saved favorites
   */
  public static getFavorites = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const customerId = req.user!.id;
    const query = req.query as unknown as FavoriteQueryInput;

    const result = await FavoriteService.getFavorites(customerId, query);

    ResponseFormatter.ok(
      res,
      "Favorites retrieved successfully",
      result.favorites,
      result.meta
    );
  });

  /**
   * DELETE /api/favorites/:equipmentId
   * Remove equipment from customer's favorites
   */
  public static removeFavorite = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const customerId = req.user!.id;
    const equipmentId = req.params.equipmentId as string;

    const result = await FavoriteService.removeFavorite(customerId, equipmentId);

    ResponseFormatter.ok(res, result.message, {
      favorited: result.favorited,
    });
  });

  /**
   * GET /api/favorites/:equipmentId/status
   * Check if equipment is favorited by authenticated customer
   */
  public static checkFavoriteStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const customerId = req.user!.id;
    const equipmentId = req.params.equipmentId as string;

    const result = await FavoriteService.isFavorite(customerId, equipmentId);

    ResponseFormatter.ok(res, "Favorite status retrieved", result);
  });
}
