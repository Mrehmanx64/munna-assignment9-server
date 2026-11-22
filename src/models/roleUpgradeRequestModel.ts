import { Schema, model, Document, Types } from "mongoose";

export interface IRoleUpgradeRequest extends Document {
  user: Types.ObjectId;
  userName: string;
  userEmail: string;
  requestedRole: "owner";
  reason?: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: Types.ObjectId;
  reviewedByName?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const roleUpgradeRequestSchema = new Schema<IRoleUpgradeRequest>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: { type: String, required: true, trim: true },
    userEmail: { type: String, required: true, trim: true },
    requestedRole: { type: String, default: "owner", trim: true },
    reason: {
      type: String,
      default: "Contractor requested account upgrade to Fleet Owner to list heavy machinery assets.",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedByName: { type: String, trim: true },
    reviewedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

roleUpgradeRequestSchema.index({ user: 1, status: 1 });
roleUpgradeRequestSchema.index({ createdAt: -1 });

export const RoleUpgradeRequest = model<IRoleUpgradeRequest>(
  "RoleUpgradeRequest",
  roleUpgradeRequestSchema
);
