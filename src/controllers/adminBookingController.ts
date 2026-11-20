import { Request, Response } from "express";
import { BookingService } from "../services/bookingService";
import { ResponseFormatter } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { BookingStatus } from "../types/booking";

export class AdminBookingController {
  /**
   * GET /api/admin/bookings
   * Admin: View all platform rentals
   */
  public static getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await BookingService.getAdminBookings(req.query as any);
    ResponseFormatter.ok(
      res,
      "All platform bookings retrieved successfully",
      result.bookings,
      result.meta
    );
  });

  /**
   * PATCH /api/admin/bookings/:id/status
   * Admin: Update booking status (e.g. Confirmed, Active, Completed, Cancelled)
   */
  public static updateStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params.id as string;
    const { bookingStatus } = req.body as { bookingStatus: BookingStatus };

    const updated = await BookingService.updateBookingStatus(
      bookingId,
      bookingStatus
    );

    ResponseFormatter.ok(res, `Booking status updated to ${bookingStatus}`, updated);
  });
}
