export interface SpaInfo {
  name: string;
  location: string;
  ownerName: string;
  avgTicketValue: number;
  monthlyAppointmentVolume: number;
  automationStartDate: string;
  buildCost: number;
  monthlyRetainer: number;
}

export interface KPIData {
  totalLeads: number;
  totalLeadsChangePct: number;
  avgResponseTimeSeconds: number;
  avgResponseTimeChangePct: number;
  leadToBookingRate: number;
  leadToBookingRateChangePct: number;
  appointmentShowRate: number;
  appointmentShowRateChangePct: number;
  reviewsGenerated: number;
  reviewsGeneratedChangePct: number;
  estimatedRevenueRecovered: number;
  estimatedRevenueRecoveredChangePct: number | null;
  previousAvgResponseMinutes: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
  dropOffPct: number;
  beforeCount?: number;
}

export interface LeadPipelineData {
  funnel: FunnelStage[];
  responseTimeDistribution: {
    bucket: string;
    count: number;
    isTarget: boolean;
  }[];
  leadsBySource: {
    source: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  leadsByHour: {
    hour: number;
    count: number;
    isAfterHours: boolean;
  }[];
  monthlyTrend: {
    month: string;
    leads: number;
    booked: number;
  }[];
  afterHoursLeadShare: number;
  contactedWithin60sPct: number;
}

export interface AppointmentData {
  noShowTrend: {
    month: string;
    noShowRate: number;
    industry: number;
  }[];
  showRateByTreatment: {
    treatment: string;
    showRate: number;
    appointmentCount: number;
  }[];
  reminderEffectiveness: {
    touchpoint: string;
    confirmationRate: number;
    showRate: number;
  }[];
  upcomingAtRisk: {
    id: string;
    initials: string;
    treatment: string;
    appointmentDate: string;
    appointmentTime: string;
    riskLevel: "high" | "medium" | "low";
    riskReason: string;
    revenueAtRisk: number;
  }[];
  currentNoShowRate: number;
  industryNoShowRate: number;
  monthlyNoShowSavings: number;
}

export interface ReactivationData {
  campaigns: {
    id: string;
    name: string;
    type: string;
    description: string;
    sent: number;
    opened: number;
    clicked: number;
    booked: number;
    revenue: number;
    openRate: number;
    bookingRate: number;
  }[];
  lapsedPatientBuckets: {
    daysLapsed: string;
    patientCount: number;
    estimatedRevenue: number;
    reachStatus: "reached" | "pending" | "not-reached";
  }[];
  monthlyReactivation: {
    month: string;
    sent: number;
    booked: number;
    revenue: number;
  }[];
  totalReactivated: number;
  totalRevenue: number;
  avgBookingRate: number;
  dormant90PlusCount: number;
  dormant90PlusRevenue: number;
}

export interface ReviewData {
  monthlyReviews: {
    month: string;
    requested: number;
    received: number;
    avgRating: number;
  }[];
  requestSendRate: number;
  conversionRate: number;
  currentAvgRating: number;
  previousAvgRating: number;
  totalReviewsGenerated: number;
  recentReviews: {
    id: string;
    initials: string;
    rating: number;
    text: string;
    treatment: string;
    daysAgo: number;
    platform: "Google" | "Yelp";
  }[];
}

export interface RevenueImpactData {
  noShowRevenueRecovered: number;
  reactivationRevenue: number;
  afterHoursLeadsValue: number;
  reviewsEstimatedValue: number;
  totalROI: number;
  buildCost: number;
  monthlyRetainer: number;
  totalInvestment: number;
  paybackDays: number;
  roiMultiple: number;
  monthlyBreakdown: {
    month: string;
    noShow: number;
    reactivation: number;
    afterHours: number;
    cumulative: number;
  }[];
}

export type DateRange = "30d" | "60d" | "90d";

export interface DashboardData {
  spa: SpaInfo;
  kpis: KPIData;
  leadPipeline: LeadPipelineData;
  appointments: AppointmentData;
  reactivation: ReactivationData;
  reviews: ReviewData;
  revenueImpact: RevenueImpactData;
  lastUpdated: string;
  dateRange: DateRange;
}
