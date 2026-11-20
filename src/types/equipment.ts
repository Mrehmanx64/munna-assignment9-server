import { Types } from "mongoose";

export type RentalType = "Daily" | "Weekly" | "Monthly";

export type EquipmentCondition = "Like New" | "Excellent" | "Good" | "Fair";

export type EquipmentStatus = "Pending" | "Approved" | "Rejected";

export interface IEquipmentSpecification {
  label: string;
  value: string;
}

export interface IEquipment {
  _id: Types.ObjectId;
  name: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  location: string;
  rentalPrice: number;
  rentalType: RentalType;
  availableQuantity: number;
  totalQuantity: number;
  condition: EquipmentCondition;
  brand: string;
  model: string;
  imageUrl: string;
  images: string[];
  rentalTerms: string;
  status: EquipmentStatus;
  owner: Types.ObjectId;
  rejectionReason?: string;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectedBy?: Types.ObjectId;
  featured?: boolean;
  rating?: number;
  reviewCount?: number;
  specifications?: IEquipmentSpecification[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipmentQueryFilters {
  search?: string;
  category?: string;
  location?: string;
  rentalType?: RentalType;
  minPrice?: number;
  maxPrice?: number;
  available?: boolean;
  sort?: "price_asc" | "price_desc" | "newest" | "rating";
  page?: number;
  limit?: number;
}
