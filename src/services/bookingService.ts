import { Types } from "mongoose";
import { Booking } from "../models/bookingModel";
import { Equipment } from "../models/equipmentModel";
import { IBooking, BookingStatus } from "../types/booking";
import { IEquipment, RentalType } from "../types/equipment";
import {
  CreateBookingInput,
  BookingQueryInput,
} from "../validators/bookingValidators";
import { StripeService } from "./stripeService";
import { ApiError } from "../utils/ApiError";

export interface PricingCalculationResult {
  duration: number;
  rentalType: RentalType;
  unitPrice: number;
  totalDays: number;
  totalAmount: number;
}

export interface EquipmentAvailabilityResult {
  totalQuantity: number;
  bookedQuantity: number;
  availableQuantity: number;
  isAvailable: boolean;
  maxBookable: number;
  bookedSchedules?: Array<{
    startDate: string;
    endDate: string;
    quantity: number;
    bookingStatus: string;
  }>;
}

export class BookingService {
  /**
   * Helper to validate MongoDB ObjectId
   */
  public static validateObjectId(id: string, entityName = "Booking"): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest(`Invalid ${entityName} ID format: ${id}`);
    }
    return new Types.ObjectId(id);
  }

  /**
   * Server-side duration and pricing calculation
   * Rules:
   *  - Daily: duration = totalDays (minimum 1 day)
   *  - Weekly: duration = Math.ceil(totalDays / 7) (minimum 1 week)
   *  - Monthly: duration = Math.ceil(totalDays / 30) (minimum 1 month)
   *  - Total Amount: unitPrice * duration * quantity
   */
  public static calculatePricingAndDuration(
    equipment: IEquipment,
    startDateStr: string,
    endDateStr: string,
    quantity = 1
  ): PricingCalculationResult {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      throw ApiError.badRequest("Rental end date must be on or after the start date");
    }

    const diffMs = end.getTime() - start.getTime();
    // Same-day rental (diffMs === 0) counts as 1 full day
    const dayCount = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const totalDays = Math.max(1, dayCount === 0 ? 1 : dayCount);

    let duration: number;
    const rentalType = equipment.rentalType || "Daily";

    switch (rentalType) {
      case "Weekly":
        duration = Math.max(1, Math.ceil(totalDays / 7));
        break;
      case "Monthly":
        duration = Math.max(1, Math.ceil(totalDays / 30));
        break;
      case "Daily":
      default:
        duration = totalDays;
        break;
    }

    const unitPrice = equipment.rentalPrice;
    const totalAmount = unitPrice * duration * quantity;

    return {
      duration,
      rentalType,
      unitPrice,
      totalDays,
      totalAmount,
    };
  }

  /**
   * Check equipment stock availability for specific rental dates
   * Considers:
   *  1. Confirmed and Active bookings
   *  2. Pending bookings placed within the last 30 minutes (active checkout window)
   * Prevents double-booking and stock overselling
   */
  public static async checkEquipmentAvailability(
    equipmentId: string,
    startDateStr?: string,
    endDateStr?: string,
    requestedQuantity = 1
  ): Promise<EquipmentAvailabilityResult> {
    const eqObjectId = this.validateObjectId(equipmentId, "Equipment");

    const equipment = await Equipment.findById(eqObjectId);
    if (!equipment) {
      throw ApiError.notFound("Equipment not found");
    }

    if (equipment.status !== "Approved") {
      throw ApiError.badRequest("Equipment is not approved for public booking");
    }

    const totalStock = equipment.totalQuantity || equipment.availableQuantity || 1;

    // Active checkout hold window: 30 minutes
    const holdCutoff = new Date(Date.now() - 30 * 60 * 1000);
    const now = new Date();

    // Query all upcoming confirmed, active, or pending bookings for this equipment
    const upcomingBookings = await Booking.find({
      equipment: eqObjectId,
      endDate: { $gte: now },
      $or: [
        { bookingStatus: { $in: ["Confirmed", "Active"] } },
        {
          bookingStatus: "Pending",
          paymentStatus: "Pending",
          createdAt: { $gte: holdCutoff },
        },
      ],
    })
      .select("startDate endDate quantity bookingStatus")
      .sort({ startDate: 1 })
      .lean();

    const bookedSchedules = (Array.isArray(upcomingBookings) ? upcomingBookings : [])
      .filter((b) => b && b.startDate && b.endDate)
      .map((b) => {
        const s = b.startDate instanceof Date ? b.startDate : new Date(b.startDate);
        const e = b.endDate instanceof Date ? b.endDate : new Date(b.endDate);
        const validStart = !isNaN(s.getTime());
        const validEnd = !isNaN(e.getTime());
        return {
          startDate: validStart ? s.toISOString() : new Date().toISOString(),
          endDate: validEnd ? e.toISOString() : new Date().toISOString(),
          quantity: b.quantity || 1,
          bookingStatus: b.bookingStatus || "Confirmed",
        };
      });

    if (startDateStr && endDateStr) {
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);

      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
        throw ApiError.badRequest("Invalid rental date range: end date must be on or after start date");
      }

      // If start and end are same day, set effectiveEnd to end of that day for proper overlap query
      const effectiveEnd =
        end.getTime() === start.getTime()
          ? new Date(end.getTime() + 24 * 60 * 60 * 1000 - 1)
          : end;

      const overlapFilter: Record<string, any> = {
        equipment: eqObjectId,
        startDate: { $lt: effectiveEnd },
        endDate: { $gt: start },
        $or: [
          { bookingStatus: { $in: ["Confirmed", "Active"] } },
          {
            bookingStatus: "Pending",
            paymentStatus: "Pending",
            createdAt: { $gte: holdCutoff },
          },
        ],
      };

      const overlappingBookings = await Booking.find(overlapFilter).select("quantity");
      const bookedQuantity = overlappingBookings.reduce(
        (sum, b) => sum + (b.quantity || 1),
        0
      );

      const availableQuantity = Math.max(0, totalStock - bookedQuantity);
      const isAvailable = availableQuantity >= requestedQuantity;

      return {
        totalQuantity: totalStock,
        bookedQuantity,
        availableQuantity,
        isAvailable,
        maxBookable: availableQuantity,
        bookedSchedules,
      };
    }

    return {
      totalQuantity: totalStock,
      bookedQuantity: 0,
      availableQuantity: totalStock,
      isAvailable: totalStock >= requestedQuantity,
      maxBookable: totalStock,
      bookedSchedules,
    };
  }

  /**
   * Create a new booking reservation and initialize Stripe Checkout Session
   * Restricted strictly to Customer role.
   */
  public static async createBooking(
    customerId: string,
    customerEmail: string,
    data: CreateBookingInput
  ): Promise<{
    booking: IBooking;
    checkoutUrl: string;
    sessionId: string;
  }> {
    const customerObjectId = this.validateObjectId(customerId, "Customer");
    const eqObjectId = this.validateObjectId(data.equipmentId, "Equipment");

    const equipment = await Equipment.findById(eqObjectId);
    if (!equipment) {
      throw ApiError.notFound("Equipment not found");
    }

    if (equipment.status !== "Approved") {
      throw ApiError.badRequest("This equipment is pending review and cannot be booked");
    }

    // Availability validation: ensures date overlap doesn't exceed stock
    const availability = await this.checkEquipmentAvailability(
      data.equipmentId,
      data.startDate,
      data.endDate,
      data.quantity
    );

    if (!availability.isAvailable) {
      throw ApiError.conflict(
        `Insufficient equipment availability for selected dates. Available: ${availability.availableQuantity}, Requested: ${data.quantity}`
      );
    }

    // Server-side pricing and duration calculation
    const pricing = this.calculatePricingAndDuration(
      equipment,
      data.startDate,
      data.endDate,
      data.quantity
    );

    // Create reservation in Pending state
    const newBooking = new Booking({
      customer: customerObjectId,
      equipment: eqObjectId,
      owner: equipment.owner,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      quantity: data.quantity,
      contactNumber: data.contactNumber,
      deliveryAddress: data.deliveryAddress,
      additionalNotes: data.additionalNotes,
      duration: pricing.duration,
      rentalType: pricing.rentalType,
      unitPrice: pricing.unitPrice,
      totalAmount: pricing.totalAmount,
      paymentStatus: "Pending",
      bookingStatus: "Pending",
    });

    const savedBooking = await newBooking.save();

    // Create Stripe Checkout Session
    const checkoutSession = await StripeService.createCheckoutSession(
      savedBooking as unknown as IBooking,
      equipment.name || equipment.title,
      customerEmail
    );

    savedBooking.stripeSessionId = checkoutSession.sessionId;
    await savedBooking.save();

    return {
      booking: savedBooking.toJSON() as IBooking,
      checkoutUrl: checkoutSession.checkoutUrl,
      sessionId: checkoutSession.sessionId,
    };
  }

  /**
   * Customer: Re-initiate Stripe Checkout session for an existing pending booking
   */
  public static async reinitiateCheckout(
    customerId: string,
    customerEmail: string,
    bookingId: string
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    const bookingObjectId = this.validateObjectId(bookingId, "Booking");
    const customerObjectId = this.validateObjectId(customerId, "Customer");

    const booking = await Booking.findById(bookingObjectId);
    if (!booking) {
      throw ApiError.notFound("Booking not found");
    }

    if (booking.customer.toString() !== customerObjectId.toString()) {
      throw ApiError.forbidden("You are not authorized to checkout this booking");
    }

    if (booking.paymentStatus === "Paid") {
      throw ApiError.badRequest("This booking has already been paid for and confirmed");
    }

    if (booking.bookingStatus === "Cancelled") {
      throw ApiError.badRequest("This booking reservation has been cancelled. Please submit a new reservation.");
    }

    const equipment = await Equipment.findById(booking.equipment);
    if (!equipment) {
      throw ApiError.notFound("Associated equipment no longer exists");
    }

    // Recheck stock availability prior to regenerating payment session
    const availability = await this.checkEquipmentAvailability(
      booking.equipment.toString(),
      booking.startDate.toISOString(),
      booking.endDate.toISOString(),
      booking.quantity
    );

    if (!availability.isAvailable) {
      throw ApiError.conflict(
        `Equipment stock is no longer available for these rental dates (Available: ${availability.availableQuantity}, Required: ${booking.quantity}).`
      );
    }

    const checkoutSession = await StripeService.createCheckoutSession(
      booking as unknown as IBooking,
      equipment.name || equipment.title,
      customerEmail
    );

    booking.stripeSessionId = checkoutSession.sessionId;
    await booking.save();

    return checkoutSession;
  }

  /**
   * Customer: View own rental bookings
   */
  public static async getCustomerBookings(
    customerId: string,
    query: BookingQueryInput
  ): Promise<{ bookings: IBooking[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const customerObjectId = this.validateObjectId(customerId, "Customer");

    const filter: Record<string, any> = { customer: customerObjectId };

    if (query.status) {
      filter.bookingStatus = query.status;
    }

    if (query.paymentStatus) {
      filter.paymentStatus = query.paymentStatus;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const [bookingsDocs, total] = await Promise.all([
      Booking.find(filter)
        .populate("equipment", "name title imageUrl category location rentalPrice rentalType")
        .populate("owner", "name email phone avatarUrl")
        .populate("paymentId", "stripePaymentIntentId amount paymentStatus transactionDate")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      bookings: bookingsDocs.map((doc: any) => ({
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
   * Customer / Owner / Admin: View single booking details
   */
  public static async getBookingById(
    bookingId: string,
    requesterId: string,
    requesterRole: string
  ): Promise<IBooking> {
    const bookingObjectId = this.validateObjectId(bookingId, "Booking");

    const booking = await Booking.findById(bookingObjectId)
      .populate("equipment")
      .populate("customer", "name email phone avatarUrl")
      .populate("owner", "name email phone avatarUrl")
      .populate("paymentId")
      .lean();

    if (!booking) {
      throw ApiError.notFound("Booking not found");
    }

    const isCustomer = (booking.customer as any)?._id?.toString() === requesterId || (booking.customer as any)?.toString() === requesterId;
    const isOwner = (booking.owner as any)?._id?.toString() === requesterId || (booking.owner as any)?.toString() === requesterId;
    const isAdmin = requesterRole === "admin";

    if (!isCustomer && !isOwner && !isAdmin) {
      throw ApiError.forbidden("You are not authorized to view this booking record");
    }

    return {
      ...booking,
      id: booking._id.toString(),
    } as any;
  }

  /**
   * Owner: View rentals associated with their fleet
   */
  public static async getOwnerBookings(
    ownerId: string,
    query: BookingQueryInput
  ): Promise<{ bookings: IBooking[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const ownerObjectId = this.validateObjectId(ownerId, "Owner");

    const filter: Record<string, any> = { owner: ownerObjectId };

    if (query.status) {
      filter.bookingStatus = query.status;
    }

    if (query.paymentStatus) {
      filter.paymentStatus = query.paymentStatus;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const [bookingsDocs, total] = await Promise.all([
      Booking.find(filter)
        .populate("equipment", "name title imageUrl category location")
        .populate("customer", "name email phone avatarUrl")
        .populate("paymentId", "stripePaymentIntentId amount paymentStatus transactionDate")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      bookings: bookingsDocs.map((doc: any) => ({
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
   * Admin: View all bookings across platform
   */
  public static async getAdminBookings(
    query: BookingQueryInput
  ): Promise<{ bookings: IBooking[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const filter: Record<string, any> = {};

    if (query.status) {
      filter.bookingStatus = query.status;
    }

    if (query.paymentStatus) {
      filter.paymentStatus = query.paymentStatus;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const [bookingsDocs, total] = await Promise.all([
      Booking.find(filter)
        .populate("equipment", "name title imageUrl category location rentalPrice rentalType")
        .populate("customer", "name email phone avatarUrl")
        .populate("owner", "name email phone avatarUrl")
        .populate("paymentId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      bookings: bookingsDocs.map((doc: any) => ({
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
   * Admin: Update booking status (e.g. Active, Completed, Cancelled)
   */
  public static async updateBookingStatus(
    bookingId: string,
    newStatus: BookingStatus
  ): Promise<IBooking> {
    const bookingObjectId = this.validateObjectId(bookingId, "Booking");

    const booking = await Booking.findById(bookingObjectId);
    if (!booking) {
      throw ApiError.notFound("Booking not found");
    }

    booking.bookingStatus = newStatus;
    const saved = await booking.save();
    return saved.toJSON() as IBooking;
  }

  /**
   * Owner: Update booking lifecycle status for own equipment rental
   * Strictly verifies booking belongs to current owner.
   * Allows allowed lifecycle actions: Confirmed, Active, Completed, Cancelled.
   * Strictly disallows modifying payment status (payments are controlled solely via Stripe).
   */
  public static async updateOwnerBookingStatus(
    ownerId: string,
    bookingId: string,
    newStatus: BookingStatus
  ): Promise<IBooking> {
    const bookingObjectId = this.validateObjectId(bookingId, "Booking");
    const ownerObjectId = this.validateObjectId(ownerId, "Owner ID");

    const booking = await Booking.findById(bookingObjectId);
    if (!booking) {
      throw ApiError.notFound("Booking not found");
    }

    if (booking.owner.toString() !== ownerObjectId.toString()) {
      throw ApiError.forbidden("You are not authorized to update another owner's rental booking");
    }

    booking.bookingStatus = newStatus;
    const saved = await booking.save();
    return saved.toJSON() as IBooking;
  }
}
