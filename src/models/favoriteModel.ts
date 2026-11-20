import mongoose, { Schema, Model, HydratedDocument } from "mongoose";
import { IFavorite } from "../types/favorite";

export type FavoriteDocument = HydratedDocument<IFavorite>;

const favoriteSchema = new Schema<IFavorite>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer ID is required"],
      index: true,
    },
    equipment: {
      type: Schema.Types.ObjectId,
      ref: "Equipment",
      required: [true, "Equipment ID is required"],
      index: true,
    },
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

// Enforce one favorite per customer + equipment pair
favoriteSchema.index({ customer: 1, equipment: 1 }, { unique: true });

// Optimize customer favorites list sorted by most recently added
favoriteSchema.index({ customer: 1, createdAt: -1 });

export const Favorite: Model<IFavorite> =
  mongoose.models.Favorite ||
  mongoose.model<IFavorite>("Favorite", favoriteSchema);
