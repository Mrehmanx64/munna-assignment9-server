import mongoose, { Schema, Model, HydratedDocument } from "mongoose";
import { IEquipment } from "../types/equipment";

export type EquipmentDocument = HydratedDocument<IEquipment>;

const specificationSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const equipmentSchema = new Schema<IEquipment>(
  {
    name: {
      type: String,
      required: [true, "Equipment name is required"],
      trim: true,
      maxlength: [150, "Equipment name cannot exceed 150 characters"],
    },
    title: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [3000, "Description cannot exceed 3000 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      index: true,
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
      index: true,
    },
    rentalPrice: {
      type: Number,
      required: [true, "Rental price is required"],
      min: [0, "Rental price cannot be negative"],
      index: true,
    },
    rentalType: {
      type: String,
      enum: {
        values: ["Daily", "Weekly", "Monthly"],
        message: "{VALUE} is not a valid rental type (Daily, Weekly, Monthly)",
      },
      default: "Daily",
      index: true,
    },
    availableQuantity: {
      type: Number,
      required: [true, "Available quantity is required"],
      min: [0, "Available quantity cannot be negative"],
      default: 1,
    },
    totalQuantity: {
      type: Number,
      required: [true, "Total quantity is required"],
      min: [1, "Total quantity must be at least 1"],
      default: 1,
    },
    condition: {
      type: String,
      enum: {
        values: ["Like New", "Excellent", "Good", "Fair"],
        message: "{VALUE} is not a valid equipment condition",
      },
      default: "Excellent",
    },
    brand: {
      type: String,
      required: [true, "Brand is required"],
      trim: true,
    },
    model: {
      type: String,
      required: [true, "Model is required"],
      trim: true,
    },
    imageUrl: {
      type: String,
      required: [true, "Equipment image URL is required"],
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    rentalTerms: {
      type: String,
      required: [true, "Rental terms and conditions are required"],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ["Pending", "Approved", "Rejected"],
        message: "{VALUE} is not a valid equipment status",
      },
      default: "Pending",
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner ID is required"],
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    approvedAt: {
      type: Date,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    rejectedAt: {
      type: Date,
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    specifications: [specificationSchema],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-save middleware to sync name/title, images, and generate slug
equipmentSchema.pre("save", function (this: any) {
  if (this.name && !this.title) {
    this.title = this.name;
  } else if (this.title && !this.name) {
    this.name = this.title;
  }

  if (!this.slug && this.name) {
    const baseSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    this.slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
  }

  if (this.imageUrl && (!this.images || this.images.length === 0)) {
    this.images = [this.imageUrl];
  }
});

// Indexes for public searching and efficient multi-field filtering
equipmentSchema.index(
  {
    name: "text",
    title: "text",
    brand: "text",
    model: "text",
    description: "text",
    location: "text",
  },
  {
    weights: {
      name: 10,
      title: 10,
      brand: 5,
      model: 5,
      location: 3,
      description: 1,
    },
    name: "equipment_text_search_idx",
  }
);

equipmentSchema.index({ status: 1, category: 1, rentalPrice: 1 });
equipmentSchema.index({ status: 1, featured: 1, createdAt: -1 });
equipmentSchema.index({ owner: 1, createdAt: -1 });
equipmentSchema.index({ owner: 1, status: 1 });
equipmentSchema.index({ status: 1 });

export const Equipment: Model<IEquipment> =
  mongoose.models.Equipment ||
  mongoose.model<IEquipment>("Equipment", equipmentSchema);
