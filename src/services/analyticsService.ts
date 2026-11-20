import { Types } from "mongoose";
import { User } from "../models/userModel";
import { Equipment } from "../models/equipmentModel";
import { Booking } from "../models/bookingModel";
import { Payment } from "../models/paymentModel";
import {
  IAdminOverviewAnalytics,
  IMonthlyBookingMetric,
  IOwnerOverviewAnalytics,
  IMonthlyEarningMetric,
} from "../types/analytics";
import { ApiError } from "../utils/ApiError";

export class AnalyticsService {
  /**
   * Helper to validate MongoDB ObjectId
   */
  public static validateObjectId(id: string, entityName = "ID"): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest(`Invalid ${entityName} format: ${id}`);
    }
    return new Types.ObjectId(id);
  }

  /**
   * Helper to generate a continuous array of "YYYY-MM" strings for the last N calendar months
   */
  public static generateMonthSequence(monthsCount: number): string[] {
    const sequence: string[] = [];
    const now = new Date();
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      sequence.push(`${year}-${month}`);
    }
    return sequence;
  }

  // =========================================================================
  // ADMIN DASHBOARD ANALYTICS
  // =========================================================================

  /**
   * Admin: Get high-level platform analytics overview
   * Aggregates live data across User, Equipment, Booking, and Payment collections
   */
  public static async getAdminOverview(): Promise<IAdminOverviewAnalytics> {
    const [
      totalUsers,
      totalEquipment,
      totalBookings,
      pendingApprovals,
      approvedEquipment,
      completedRentals,
      activeRentals,
      revenueAgg,
    ] = await Promise.all([
      User.countDocuments(),
      Equipment.countDocuments(),
      Booking.countDocuments(),
      Equipment.countDocuments({ status: "Pending" }),
      Equipment.countDocuments({ status: "Approved" }),
      Booking.countDocuments({ bookingStatus: "Completed" }),
      Booking.countDocuments({ bookingStatus: { $in: ["Confirmed", "Active"] } }),
      Payment.aggregate([
        { $match: { paymentStatus: "Paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const totalRevenue =
      revenueAgg && revenueAgg.length > 0 && typeof revenueAgg[0].total === "number"
        ? Math.round(revenueAgg[0].total * 100) / 100
        : 0;

    return {
      totalUsers,
      totalEquipment,
      totalBookings,
      pendingApprovals,
      approvedEquipment,
      completedRentals,
      activeRentals,
      totalRevenue,
    };
  }

  /**
   * Admin: Get monthly booking counts and verified payment revenue
   * Covers recent N months, guaranteeing zero-booking months are represented
   */
  public static async getAdminMonthlyBookings(
    monthsCount = 6
  ): Promise<IMonthlyBookingMetric[]> {
    const validMonths = Math.min(24, Math.max(1, monthsCount));
    const monthSequence = this.generateMonthSequence(validMonths);

    // Calculate earliest timestamp in window (start of first month in sequence)
    const [firstYear, firstMonth] = monthSequence[0].split("-").map(Number);
    const startDate = new Date(firstYear, firstMonth - 1, 1);

    // 1. Aggregate bookings by month
    const bookingAggPromise = Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          bookingStatus: { $nin: ["Cancelled"] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]);

    // 2. Aggregate verified payment revenue by month
    const revenueAggPromise = Payment.aggregate([
      {
        $match: {
          paymentStatus: "Paid",
          transactionDate: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$transactionDate" } },
          revenue: { $sum: "$amount" },
        },
      },
    ]);

    const [bookingResults, revenueResults] = await Promise.all([
      bookingAggPromise,
      revenueAggPromise,
    ]);

    const bookingMap = new Map<string, number>();
    for (const b of bookingResults) {
      if (b._id) bookingMap.set(b._id, b.count);
    }

    const revenueMap = new Map<string, number>();
    for (const r of revenueResults) {
      if (r._id) revenueMap.set(r._id, Math.round(r.revenue * 100) / 100);
    }

    // Merge into contiguous chronological month array with zero fallbacks
    return monthSequence.map((monthKey) => ({
      month: monthKey,
      bookingsCount: bookingMap.get(monthKey) || 0,
      revenue: revenueMap.get(monthKey) || 0,
    }));
  }

  // =========================================================================
  // OWNER DASHBOARD ANALYTICS
  // =========================================================================

  /**
   * Owner: Get overview metrics isolated strictly to the authenticated owner's fleet
   */
  public static async getOwnerOverview(
    ownerId: string
  ): Promise<IOwnerOverviewAnalytics> {
    const ownerObjectId = this.validateObjectId(ownerId, "Owner ID");

    const [
      totalEquipment,
      activeListings,
      pendingListings,
      totalBookings,
      completedRentals,
      activeRentals,
      pendingRentals,
      earningsAgg,
    ] = await Promise.all([
      Equipment.countDocuments({ owner: ownerObjectId }),
      Equipment.countDocuments({ owner: ownerObjectId, status: "Approved" }),
      Equipment.countDocuments({ owner: ownerObjectId, status: "Pending" }),
      Booking.countDocuments({ owner: ownerObjectId }),
      Booking.countDocuments({ owner: ownerObjectId, bookingStatus: "Completed" }),
      Booking.countDocuments({
        owner: ownerObjectId,
        bookingStatus: { $in: ["Confirmed", "Active"] },
      }),
      Booking.countDocuments({ owner: ownerObjectId, bookingStatus: "Pending" }),
      Payment.aggregate([
        { $match: { owner: ownerObjectId, paymentStatus: "Paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const totalEarnings =
      earningsAgg && earningsAgg.length > 0 && typeof earningsAgg[0].total === "number"
        ? Math.round(earningsAgg[0].total * 100) / 100
        : 0;

    return {
      totalEquipment,
      activeListings,
      pendingListings,
      totalBookings,
      completedRentals,
      activeRentals,
      pendingRentals,
      totalEarnings,
    };
  }

  /**
   * Owner: Get monthly earnings breakdown isolated strictly to the authenticated owner
   * Covers recent N months, guaranteeing zero-earning months are represented
   */
  public static async getOwnerMonthlyEarnings(
    ownerId: string,
    monthsCount = 6
  ): Promise<IMonthlyEarningMetric[]> {
    const ownerObjectId = this.validateObjectId(ownerId, "Owner ID");
    const validMonths = Math.min(24, Math.max(1, monthsCount));
    const monthSequence = this.generateMonthSequence(validMonths);

    // Calculate earliest timestamp in window
    const [firstYear, firstMonth] = monthSequence[0].split("-").map(Number);
    const startDate = new Date(firstYear, firstMonth - 1, 1);

    // Aggregate verified payments for this owner by month
    const earningsAgg = await Payment.aggregate([
      {
        $match: {
          owner: ownerObjectId,
          paymentStatus: "Paid",
          transactionDate: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$transactionDate" } },
          earnings: { $sum: "$amount" },
          rentalsCount: { $sum: 1 },
        },
      },
    ]);

    const earningsMap = new Map<string, { earnings: number; count: number }>();
    for (const e of earningsAgg) {
      if (e._id) {
        earningsMap.set(e._id, {
          earnings: Math.round(e.earnings * 100) / 100,
          count: e.rentalsCount || 0,
        });
      }
    }

    // Merge into contiguous chronological month array with zero fallbacks
    return monthSequence.map((monthKey) => {
      const entry = earningsMap.get(monthKey);
      return {
        month: monthKey,
        earnings: entry ? entry.earnings : 0,
        rentalsCount: entry ? entry.count : 0,
      };
    });
  }
}
