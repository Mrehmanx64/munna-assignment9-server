import { Types } from "mongoose";
import { RentalType } from "./equipment";

export type PaymentStatus = "Pending" | "Paid" | "Failed" | "Refunded";

export type BookingStatus =
  | "Pending"
  | "Confirmed"
  | "Active"
  | "Completed"
  | "Cancelled";

export interface IBooking {
  _id: Types.ObjectId;
  customer: Types.ObjectId;
  equipment: Types.ObjectId;
  owner: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  quantity: number;
  contactNumber: string;
  deliveryAddress: string;
  additionalNotes?: string;
  duration: number;
  rentalType: RentalType;
  unitPrice: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  paymentId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
