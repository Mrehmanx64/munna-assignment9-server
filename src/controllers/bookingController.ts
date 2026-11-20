import { Request, Response } from "express";
import { BookingService } from "../services/bookingService";
import { ResponseFormatter } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export class BookingController {
  /**
   * POST /api/bookings
   * Customer: Create a rental booking and initiate Stripe Checkout
   */
  public static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const customerId = req.user!.id;
    const customerEmail = req.user!.email;

    const result = await BookingService.createBooking(
      customerId,
      customerEmail,
      req.body
    );

    ResponseFormatter.created(
      res,
      "Rental booking created successfully. Proceed to Stripe Checkout to confirm reservation.",
      result
    );
  });

  /**
   * GET /api/bookings/my-rentals
   * Customer: Get list of own rental bookings
   */
  public static getMyRentals = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const customerId = req.user!.id;
    const result = await BookingService.getCustomerBookings(
      customerId,
      req.query as any
    );

    ResponseFormatter.ok(
      res,
      "Customer rental bookings retrieved successfully",
      result.bookings,
      result.meta
    );
  });

  /**
   * GET /api/bookings/:id
   * Customer / Owner / Admin: Get single booking details
   */
  public static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params.id as string;
    const requesterId = req.user!.id;
    const requesterRole = req.user!.role;

    const booking = await BookingService.getBookingById(
      bookingId,
      requesterId,
      requesterRole
    );

    ResponseFormatter.ok(res, "Booking details retrieved successfully", booking);
  });

  /**
   * POST /api/bookings/:id/checkout
   * Customer: Re-initiate Stripe Checkout session for pending booking
   */
  public static checkout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params.id as string;
    const customerId = req.user!.id;
    const customerEmail = req.user!.email;

    const result = await BookingService.reinitiateCheckout(
      customerId,
      customerEmail,
      bookingId
    );

    ResponseFormatter.ok(res, "Checkout session initialized successfully", result);
  });

  /**
   * GET /api/equipment/:id/availability
   * Public / Customer: Check equipment availability for specific rental dates
   */
  public static checkAvailability = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const equipmentId = req.params.id as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const quantity = req.query.quantity
      ? parseInt(req.query.quantity as string, 10)
      : 1;

    const availability = await BookingService.checkEquipmentAvailability(
      equipmentId,
      startDate,
      endDate,
      quantity
    );

    ResponseFormatter.ok(
      res,
      "Equipment availability calculated successfully",
      availability
    );
  });
}
