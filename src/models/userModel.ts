import mongoose, { Schema, Document, Model } from "mongoose";

export type UserRole = "customer" | "owner" | "admin";

export interface IUser extends Document {
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string;
  avatarUrl?: string;
  role: UserRole;
  phone?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    image: {
      type: String,
      trim: true,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: {
        values: ["customer", "owner", "admin"],
        message: "{VALUE} is not a valid role",
      },
      default: "customer",
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "user", // Aligns with BetterAuth MongoDB collection
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id ? (ret._id as { toString(): string }).toString() : undefined;
        // Prefer avatarUrl, fallback to image
        if (!ret.avatarUrl && ret.image) {
          ret.avatarUrl = ret.image;
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Prevent mongoose OverwriteModelError in watch/hot-reload mode
export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
