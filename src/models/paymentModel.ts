import mongoose, { Schema, Model, HydratedDocument } from "mongoose";
import { IPayment } from "../types/payment";

export type PaymentDocument = HydratedDocument<IPayment>;

const paymentSchema = new Schema<IPayment>(
  {
    booking: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: [true, "Booking ID is required"],
      index: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer ID is required"],
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner ID is required"],
      index: true,
    },
    equipment: {
      type: Schema.Types.ObjectId,
      ref: "Equipment",
      required: [true, "Equipment ID is required"],
      index: true,
    },
    stripeSessionId: {
      type: String,
      required: [true, "Stripe Session ID is required"],
      unique: true,
      trim: true,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      default: "usd",
      lowercase: true,
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ["Pending", "Paid", "Failed", "Refunded"],
        message: "{VALUE} is not a valid payment status",
      },
      default: "Pending",
      index: true,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: Schema.Types.Mixed,
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

paymentSchema.index({ customer: 1, createdAt: -1 });
paymentSchema.index({ owner: 1, createdAt: -1 });

export const Payment: Model<IPayment> =
  mongoose.models.Payment ||
  mongoose.model<IPayment>("Payment", paymentSchema);
