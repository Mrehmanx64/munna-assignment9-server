export interface IAdminOverviewAnalytics {
  totalUsers: number;
  totalEquipment: number;
  totalBookings: number;
  pendingApprovals: number;
  approvedEquipment: number;
  completedRentals: number;
  activeRentals: number;
  totalRevenue: number;
}

export interface IMonthlyBookingMetric {
  month: string; // "YYYY-MM"
  bookingsCount: number;
  revenue: number;
}

export interface IOwnerOverviewAnalytics {
  totalEquipment: number;
  activeListings: number;
  pendingListings: number;
  totalBookings: number;
  completedRentals: number;
  activeRentals: number;
  pendingRentals: number;
  totalEarnings: number;
}

export interface IMonthlyEarningMetric {
  month: string; // "YYYY-MM"
  earnings: number;
  rentalsCount: number;
}
