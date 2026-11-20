import { Request, Response } from "express";
import { BookingService } from "../services/bookingService";
import { ResponseFormatter } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export class OwnerBookingController {
  /**
   * GET /api/owner/bookings
   * Owner: View all rentals for equipment in their fleet
   */
  public static getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const ownerId = req.user!.id;
    const result = await BookingService.getOwnerBookings(ownerId, req.query as any);
    ResponseFormatter.ok(
      res,
      "Owner equipment rentals retrieved successfully",
      result.bookings,
      result.meta
    );
  });
}
