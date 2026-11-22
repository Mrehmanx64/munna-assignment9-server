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

  /**
   * PATCH /api/owner/bookings/:id/status
   * Owner: Update lifecycle status for own rental booking
   */
  public static updateStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const ownerId = req.user!.id;
    const bookingId = req.params.id as string;
    const { bookingStatus } = req.body;

    const updated = await BookingService.updateOwnerBookingStatus(
      ownerId,
      bookingId,
      bookingStatus
    );

    ResponseFormatter.ok(
      res,
      `Rental booking status updated to '${bookingStatus}' successfully`,
      updated
    );
  });
}
