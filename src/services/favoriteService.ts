import { Types } from "mongoose";
import { Favorite } from "../models/favoriteModel";
import { Equipment } from "../models/equipmentModel";
import { IFavorite } from "../types/favorite";
import { FavoriteQueryInput } from "../validators/favoriteValidators";
import { ApiError } from "../utils/ApiError";

export class FavoriteService {
  /**
   * Helper to validate MongoDB ObjectId
   */
  public static validateObjectId(id: string, entityName = "ID"): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest(`Invalid ${entityName} format: ${id}`);
    }
    return new Types.ObjectId(id);
  }

  /**
   * Customer: Add equipment to favorites
   * Idempotent: If already in favorites, returns the existing record cleanly.
   * Only 'Approved' equipment can be favorited.
   */
  public static async addFavorite(
    customerId: string,
    equipmentId: string
  ): Promise<{ favorited: boolean; message: string; favorite: IFavorite }> {
    const customerObjectId = this.validateObjectId(customerId, "Customer ID");
    const equipmentObjectId = this.validateObjectId(equipmentId, "Equipment ID");

    // 1. Verify equipment existence
    const equipment = await Equipment.findById(equipmentObjectId);
    if (!equipment) {
      throw ApiError.notFound("Equipment listing not found");
    }

    // 2. Validate listing approval status
    if (equipment.status !== "Approved") {
      throw ApiError.badRequest(
        `Cannot favorite equipment with '${equipment.status}' status. Only approved equipment listings can be favorited.`
      );
    }

    // 3. Idempotency check: if already favorited, return existing record
    const existing = await Favorite.findOne({
      customer: customerObjectId,
      equipment: equipmentObjectId,
    }).populate("equipment", "name title imageUrl category location rentalPrice rentalType status");

    if (existing) {
      return {
        favorited: true,
        message: "Equipment is already in your favorites",
        favorite: existing.toJSON() as IFavorite,
      };
    }

    // 4. Create new favorite record
    const newFavorite = new Favorite({
      customer: customerObjectId,
      equipment: equipmentObjectId,
    });

    const saved = await newFavorite.save();
    await saved.populate("equipment", "name title imageUrl category location rentalPrice rentalType status");

    return {
      favorited: true,
      message: "Equipment added to favorites successfully",
      favorite: saved.toJSON() as IFavorite,
    };
  }

  /**
   * Customer: Get list of saved favorites with populated equipment
   * Gracefully filters out any equipment records that may have been deleted.
   */
  public static async getFavorites(
    customerId: string,
    query: FavoriteQueryInput
  ): Promise<{
    favorites: IFavorite[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const customerObjectId = this.validateObjectId(customerId, "Customer ID");

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [favoriteDocs, total] = await Promise.all([
      Favorite.find({ customer: customerObjectId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "equipment",
          select:
            "name title slug description category location rentalPrice rentalType availableQuantity totalQuantity condition brand model imageUrl images status rating reviewCount",
        })
        .lean(),
      Favorite.countDocuments({ customer: customerObjectId }),
    ]);

    // Gracefully handle deleted equipment: filter nulls so client never encounters broken cards
    const validFavorites = favoriteDocs
      .filter((doc: any) => doc.equipment != null)
      .map((doc: any) => ({
        ...doc,
        id: doc._id.toString(),
      }));

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      favorites: validFavorites as IFavorite[],
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Customer: Remove equipment from favorites
   * Idempotent: If not found, still returns success indicating it is not favorited.
   */
  public static async removeFavorite(
    customerId: string,
    equipmentId: string
  ): Promise<{ favorited: boolean; message: string }> {
    const customerObjectId = this.validateObjectId(customerId, "Customer ID");
    const equipmentObjectId = this.validateObjectId(equipmentId, "Equipment ID");

    await Favorite.findOneAndDelete({
      customer: customerObjectId,
      equipment: equipmentObjectId,
    });

    return {
      favorited: false,
      message: "Equipment removed from favorites successfully",
    };
  }

  /**
   * Customer: Check if specific equipment is in customer's favorites
   */
  public static async isFavorite(
    customerId: string,
    equipmentId: string
  ): Promise<{ isFavorite: boolean }> {
    const customerObjectId = this.validateObjectId(customerId, "Customer ID");
    const equipmentObjectId = this.validateObjectId(equipmentId, "Equipment ID");

    const exists = await Favorite.exists({
      customer: customerObjectId,
      equipment: equipmentObjectId,
    });

    return {
      isFavorite: !!exists,
    };
  }
}
