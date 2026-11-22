import mongoose, { Types, SortOrder } from "mongoose";
import { Equipment } from "../models/equipmentModel";
import { IEquipment } from "../types/equipment";
import {
  CreateEquipmentInput,
  UpdateEquipmentInput,
  EquipmentQueryInput,
} from "../validators/equipmentValidators";
import { ApiError } from "../utils/ApiError";
import { escapeRegex } from "../utils/sanitize";

export class EquipmentService {
  /**
   * Helper to validate MongoDB ObjectId
   */
  public static validateObjectId(id: string, entityName = "Equipment"): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest(`Invalid ${entityName} ID format: ${id}`);
    }
    return new Types.ObjectId(id);
  }

  /**
   * Owner: Create a new equipment listing
   * Ownership is bound strictly to authenticated user's ID.
   * Status is forced to "Pending".
   */
  public static async createEquipment(
    ownerId: string,
    data: CreateEquipmentInput
  ): Promise<IEquipment> {
    const ownerObjectId = this.validateObjectId(ownerId, "Owner");

    const equipmentName = data.name || data.title || "Unnamed Equipment";
    const equipmentTitle = data.title || data.name || equipmentName;

    const newEquipment = new Equipment({
      ...data,
      name: equipmentName,
      title: equipmentTitle,
      owner: ownerObjectId,
      status: "Pending", // Owner listings strictly default to Pending
      availableQuantity: data.availableQuantity ?? 1,
      totalQuantity: data.totalQuantity ?? (data.availableQuantity || 1),
    });

    const saved = await newEquipment.save();
    return saved.toJSON() as IEquipment;
  }

  /**
   * Owner: Get all equipment listings for the authenticated owner
   */
  public static async getOwnerEquipment(
    ownerId: string,
    query: EquipmentQueryInput
  ): Promise<{ equipment: IEquipment[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const ownerObjectId = this.validateObjectId(ownerId, "Owner");

    const filter: Record<string, any> = { owner: ownerObjectId };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.category) {
      filter.category = { $regex: new RegExp(`^${escapeRegex(query.category.trim())}$`, "i") };
    }

    if (query.search || query.q) {
      const term = escapeRegex((query.search || query.q || "").trim());
      filter.$or = [
        { name: { $regex: term, $options: "i" } },
        { title: { $regex: term, $options: "i" } },
        { brand: { $regex: term, $options: "i" } },
        { model: { $regex: term, $options: "i" } },
        { location: { $regex: term, $options: "i" } },
      ];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 12));
    const skip = (page - 1) * limit;

    const [equipmentDocs, total] = await Promise.all([
      Equipment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Equipment.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      equipment: equipmentDocs.map((doc: any) => ({
        ...doc,
        id: doc._id.toString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Owner: Get a single equipment listing owned by authenticated owner
   */
  public static async getOwnerEquipmentById(
    ownerId: string,
    equipmentId: string
  ): Promise<IEquipment> {
    const eqId = this.validateObjectId(equipmentId, "Equipment");
    const ownerObjectId = this.validateObjectId(ownerId, "Owner");

    const equipment = await Equipment.findOne({ _id: eqId, owner: ownerObjectId });
    if (!equipment) {
      // Check if equipment exists but belongs to someone else
      const exists = await Equipment.findById(eqId);
      if (exists) {
        throw ApiError.forbidden("You are not authorized to view this equipment listing");
      }
      throw ApiError.notFound("Equipment not found");
    }

    return equipment.toJSON() as IEquipment;
  }

  /**
   * Owner: Update own equipment listing
   * Prevents altering owner or self-approving.
   */
  public static async updateOwnerEquipment(
    ownerId: string,
    equipmentId: string,
    data: UpdateEquipmentInput
  ): Promise<IEquipment> {
    const eqId = this.validateObjectId(equipmentId, "Equipment");
    const ownerObjectId = this.validateObjectId(ownerId, "Owner");

    const equipment = await Equipment.findById(eqId);
    if (!equipment) {
      throw ApiError.notFound("Equipment not found");
    }

    if (equipment.owner.toString() !== ownerObjectId.toString()) {
      throw ApiError.forbidden("You are not authorized to modify another owner's equipment");
    }

    // Prepare update data, stripping owner or status tampering
    const updateData: Record<string, any> = { ...data };
    delete updateData.owner;
    delete updateData.status;
    delete updateData.approvedAt;
    delete updateData.approvedBy;
    delete updateData.rejectedAt;
    delete updateData.rejectedBy;

    if (updateData.name && !updateData.title) {
      updateData.title = updateData.name;
    } else if (updateData.title && !updateData.name) {
      updateData.name = updateData.title;
    }

    // Material change policy: If an approved listing's core details are modified, reset to Pending review
    const materialFields = [
      "name",
      "title",
      "description",
      "category",
      "rentalPrice",
      "rentalType",
      "condition",
      "brand",
      "model",
      "imageUrl",
      "images",
      "rentalTerms",
    ];
    const isMateriallyModified = materialFields.some((f) => updateData[f] !== undefined);

    if (equipment.status === "Approved" && isMateriallyModified) {
      equipment.status = "Pending";
      console.log(`ℹ️ Equipment ${equipment._id} reset to Pending status due to material modifications by owner.`);
    }

    Object.assign(equipment, updateData);
    const updated = await equipment.save();
    return updated.toJSON() as IEquipment;
  }

  /**
   * Owner: Delete own equipment listing
   */
  public static async deleteOwnerEquipment(
    ownerId: string,
    equipmentId: string
  ): Promise<{ message: string; id: string }> {
    const eqId = this.validateObjectId(equipmentId, "Equipment");
    const ownerObjectId = this.validateObjectId(ownerId, "Owner");

    const equipment = await Equipment.findById(eqId);
    if (!equipment) {
      throw ApiError.notFound("Equipment not found");
    }

    if (equipment.owner.toString() !== ownerObjectId.toString()) {
      throw ApiError.forbidden("You are not authorized to delete another owner's equipment");
    }

    await Equipment.findByIdAndDelete(eqId);
    return {
      message: "Equipment listing deleted successfully",
      id: eqId.toString(),
    };
  }

  /**
   * Public: Get approved equipment with server-side search, filtering, and sorting
   */
  public static async getPublicEquipment(
    query: EquipmentQueryInput
  ): Promise<{ equipment: IEquipment[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    // Public queries ONLY return Approved equipment
    const filter: Record<string, any> = { status: "Approved" };

    // Search query (across name, title, brand, model, description, location)
    if (query.search || query.q) {
      const term = escapeRegex((query.search || query.q || "").trim());
      filter.$or = [
        { name: { $regex: term, $options: "i" } },
        { title: { $regex: term, $options: "i" } },
        { brand: { $regex: term, $options: "i" } },
        { model: { $regex: term, $options: "i" } },
        { description: { $regex: term, $options: "i" } },
        { location: { $regex: term, $options: "i" } },
      ];
    }

    // Category filter (case-insensitive exact match)
    if (query.category) {
      filter.category = { $regex: new RegExp(`^${escapeRegex(query.category.trim())}$`, "i") };
    }

    // Location filter
    if (query.location) {
      filter.location = { $regex: escapeRegex(query.location.trim()), $options: "i" };
    }

    // Rental Type filter (Daily, Weekly, Monthly)
    if (query.rentalType) {
      filter.rentalType = query.rentalType;
    }

    // Price range filters
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.rentalPrice = {};
      if (query.minPrice !== undefined) {
        filter.rentalPrice.$gte = query.minPrice;
      }
      if (query.maxPrice !== undefined) {
        filter.rentalPrice.$lte = query.maxPrice;
      }
    }

    // Availability filter
    if (query.available === true) {
      filter.availableQuantity = { $gt: 0 };
    } else if (query.available === false) {
      filter.availableQuantity = { $lte: 0 };
    }

    // Sorting
    const sortOption: Record<string, SortOrder> = {};
    switch (query.sort) {
      case "price_asc":
        sortOption.rentalPrice = 1;
        break;
      case "price_desc":
        sortOption.rentalPrice = -1;
        break;
      case "rating":
        sortOption.rating = -1;
        sortOption.createdAt = -1;
        break;
      case "newest":
      default:
        sortOption.createdAt = -1;
        break;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 12));
    const skip = (page - 1) * limit;

    const [equipmentDocs, total] = await Promise.all([
      Equipment.find(filter)
        .populate("owner", "name email avatarUrl phone")
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      Equipment.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      equipment: equipmentDocs.map((doc: any) => ({
        ...doc,
        id: doc._id.toString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Public: Get featured equipment (maximum 6 using MongoDB limit)
   */
  public static async getFeaturedEquipment(limit = 6): Promise<IEquipment[]> {
    const maxLimit = Math.min(Math.max(1, limit), 6); // Hard-capped at 6 per requirement

    const docs = await Equipment.find({ status: "Approved" })
      .populate("owner", "name email avatarUrl phone")
      .sort({ featured: -1, rating: -1, createdAt: -1 })
      .limit(maxLimit)
      .lean();

    return docs.map((doc: any) => ({
      ...doc,
      id: doc._id.toString(),
    }));
  }

  /**
   * Public: Get equipment details by ID
   * Visible publicly only if status is "Approved", unless viewed by owner or admin.
   */
  public static async getEquipmentById(
    equipmentId: string,
    viewerUserId?: string,
    viewerRole?: string
  ): Promise<IEquipment> {
    const eqId = this.validateObjectId(equipmentId, "Equipment");

    const equipment = await Equipment.findById(eqId)
      .populate("owner", "name email avatarUrl phone role")
      .lean();

    if (!equipment) {
      throw ApiError.notFound("Equipment not found");
    }

    // Only approved equipment is publicly accessible
    const isOwner = viewerUserId && (equipment.owner as any)?._id?.toString() === viewerUserId;
    const isAdmin = viewerRole === "admin";

    if (equipment.status !== "Approved" && !isOwner && !isAdmin) {
      throw ApiError.notFound("Equipment not found or pending approval");
    }

    return {
      ...equipment,
      id: equipment._id.toString(),
    } as any;
  }

  /**
   * Public: Get available categories with active equipment counts
   */
  public static async getCategoriesSummary(): Promise<Array<{ category: string; count: number }>> {
    const result = await Equipment.aggregate([
      { $match: { status: "Approved" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $project: { category: "$_id", count: 1, _id: 0 } },
      { $sort: { count: -1 } },
    ]);

    return result;
  }

  /**
   * Admin: Get all equipment across all statuses with filtering and search
   */
  public static async getAdminEquipment(
    query: EquipmentQueryInput
  ): Promise<{ equipment: IEquipment[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const filter: Record<string, any> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.category) {
      filter.category = { $regex: new RegExp(`^${escapeRegex(query.category.trim())}$`, "i") };
    }

    if (query.search || query.q) {
      const term = escapeRegex((query.search || query.q || "").trim());
      filter.$or = [
        { name: { $regex: term, $options: "i" } },
        { title: { $regex: term, $options: "i" } },
        { brand: { $regex: term, $options: "i" } },
        { model: { $regex: term, $options: "i" } },
        { location: { $regex: term, $options: "i" } },
      ];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 12));
    const skip = (page - 1) * limit;

    const [equipmentDocs, total] = await Promise.all([
      Equipment.find(filter)
        .populate("owner", "name email avatarUrl phone role")
        .populate("approvedBy", "name email")
        .populate("rejectedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Equipment.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      equipment: equipmentDocs.map((doc: any) => ({
        ...doc,
        id: doc._id.toString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Admin: Approve equipment listing
   */
  public static async approveEquipment(
    equipmentId: string,
    adminId: string
  ): Promise<IEquipment> {
    const eqId = this.validateObjectId(equipmentId, "Equipment");
    const adminObjectId = this.validateObjectId(adminId, "Admin");

    const equipment = await Equipment.findById(eqId);
    if (!equipment) {
      throw ApiError.notFound("Equipment not found");
    }

    equipment.status = "Approved";
    equipment.approvedAt = new Date();
    equipment.approvedBy = adminObjectId;
    equipment.rejectedAt = undefined;
    equipment.rejectedBy = undefined;
    equipment.rejectionReason = undefined;

    const saved = await equipment.save();
    return saved.toJSON() as IEquipment;
  }

  /**
   * Admin: Reject equipment listing
   */
  public static async rejectEquipment(
    equipmentId: string,
    adminId: string,
    reason: string
  ): Promise<IEquipment> {
    const eqId = this.validateObjectId(equipmentId, "Equipment");
    const adminObjectId = this.validateObjectId(adminId, "Admin");

    if (!reason || reason.trim().length === 0) {
      throw ApiError.badRequest("Rejection reason is required");
    }

    const equipment = await Equipment.findById(eqId);
    if (!equipment) {
      throw ApiError.notFound("Equipment not found");
    }

    equipment.status = "Rejected";
    equipment.rejectionReason = reason.trim();
    equipment.rejectedAt = new Date();
    equipment.rejectedBy = adminObjectId;
    equipment.approvedAt = undefined;
    equipment.approvedBy = undefined;

    const saved = await equipment.save();
    return saved.toJSON() as IEquipment;
  }

  /**
   * Admin: Update any equipment listing
   */
  public static async adminUpdateEquipment(
    equipmentId: string,
    data: UpdateEquipmentInput
  ): Promise<IEquipment> {
    const eqId = this.validateObjectId(equipmentId, "Equipment");

    const equipment = await Equipment.findById(eqId);
    if (!equipment) {
      throw ApiError.notFound("Equipment not found");
    }

    const updateData: Record<string, any> = { ...data };
    delete updateData.owner;

    if (updateData.name && !updateData.title) {
      updateData.title = updateData.name;
    } else if (updateData.title && !updateData.name) {
      updateData.name = updateData.title;
    }

    Object.assign(equipment, updateData);
    const updated = await equipment.save();
    return updated.toJSON() as IEquipment;
  }

  /**
   * Admin: Delete any equipment listing
   */
  public static async adminDeleteEquipment(
    equipmentId: string
  ): Promise<{ message: string; id: string }> {
    const eqId = this.validateObjectId(equipmentId, "Equipment");

    const equipment = await Equipment.findByIdAndDelete(eqId);
    if (!equipment) {
      throw ApiError.notFound("Equipment not found");
    }

    return {
      message: "Equipment deleted successfully by administrator",
      id: eqId.toString(),
    };
  }
}
