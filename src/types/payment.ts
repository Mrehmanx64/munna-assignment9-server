import { Types } from "mongoose";
import { PaymentStatus } from "./booking";

export interface IPayment {
  _id: Types.ObjectId;
  booking: Types.ObjectId;
  customer: Types.ObjectId;
  owner: Types.ObjectId;
  equipment: Types.ObjectId;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  amount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  transactionDate: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
