export function calculatePaybackDays(
  buildCost: number,
  monthlyNoShowRecovery: number
): number {
  if (monthlyNoShowRecovery <= 0) return Infinity;
  return Math.round(buildCost / (monthlyNoShowRecovery / 30));
}

export function calculateROI(
  totalValueGenerated: number,
  totalInvestment: number
): number {
  if (totalInvestment <= 0) return 0;
  return ((totalValueGenerated - totalInvestment) / totalInvestment) * 100;
}

export function estimateAfterHoursValue(
  afterHoursLeadCount: number,
  bookingRate: number,
  avgTicket: number
): number {
  return Math.round(afterHoursLeadCount * (bookingRate / 100) * avgTicket);
}

export function estimateNoShowRecovery(
  totalAppointments: number,
  previousNoShowRate: number,
  currentNoShowRate: number,
  avgTicket: number
): number {
  const rateDiff = (previousNoShowRate - currentNoShowRate) / 100;
  return Math.round(totalAppointments * rateDiff * avgTicket);
}
