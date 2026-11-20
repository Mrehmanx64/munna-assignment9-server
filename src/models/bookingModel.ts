import mongoose, { Schema, Model, HydratedDocument } from "mongoose";
import { IBooking } from "../types/booking";

export type BookingDocument = HydratedDocument<IBooking>;

const bookingSchema = new Schema<IBooking>(
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
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner ID is required"],
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, "Rental start date is required"],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, "Rental end date is required"],
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, "Rental quantity is required"],
      min: [1, "Quantity must be at least 1"],
      default: 1,
    },
    contactNumber: {
      type: String,
      required: [true, "Contact number is required"],
      trim: true,
    },
    deliveryAddress: {
      type: String,
      required: [true, "Delivery address is required"],
      trim: true,
    },
    additionalNotes: {
      type: String,
      trim: true,
    },
    duration: {
      type: Number,
      required: [true, "Calculated duration is required"],
      min: [1, "Duration must be at least 1"],
    },
    rentalType: {
      type: String,
      enum: {
        values: ["Daily", "Weekly", "Monthly"],
        message: "{VALUE} is not a valid rental type",
      },
      required: [true, "Rental type is required"],
    },
    unitPrice: {
      type: Number,
      required: [true, "Unit price snapshot is required"],
      min: [0, "Unit price cannot be negative"],
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Total amount cannot be negative"],
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
    bookingStatus: {
      type: String,
      enum: {
        values: ["Pending", "Confirmed", "Active", "Completed", "Cancelled"],
        message: "{VALUE} is not a valid booking status",
      },
      default: "Pending",
      index: true,
    },
    stripeSessionId: {
      type: String,
      trim: true,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      trim: true,
      index: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
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

// Compound indexes for availability querying and tenant isolation
bookingSchema.index({
  equipment: 1,
  bookingStatus: 1,
  startDate: 1,
  endDate: 1,
});

bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ owner: 1, createdAt: -1 });
bookingSchema.index({ owner: 1, bookingStatus: 1 });
bookingSchema.index({ bookingStatus: 1, paymentStatus: 1, createdAt: -1 });
bookingSchema.index({ createdAt: -1 });

export const Booking: Model<IBooking> =
  mongoose.models.Booking ||
  mongoose.model<IBooking>("Booking", bookingSchema);
