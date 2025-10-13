/**
 * Phase 4: Customer Fraud Detection System
 * Analyzes orders and customers for fraudulent patterns
 */

export interface FraudIndicators {
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  patterns: string[];
  autoActions: string[];
  shouldBlock: boolean;
  shouldFlag: boolean;
}

export interface OrderFraudAnalysis {
  order: any;
  fraudIndicators: FraudIndicators;
  customerHistory?: CustomerRiskProfile;
}

export interface CustomerRiskProfile {
  customerId: string;
  totalOrders: number;
  successfulOrders: number;
  failedOrders: number;
  returnRate: number;
  addressChanges: number;
  suspiciousPatterns: string[];
  riskScore: number;
}

/**
 * Calculate fraud risk score for an order (0-100)
 */
export const calculateOrderFraudRisk = (
  order: any,
  customerOrders: any[] = [],
  allOrders: any[] = []
): FraudIndicators => {
  const flags: string[] = [];
  const patterns: string[] = [];
  const autoActions: string[] = [];
  let riskScore = 0;

  // 1. High-value order (>50,000 PKR)
  if (order.total_amount > 50000) {
    flags.push('High Value Order');
    riskScore += 20;
  }

  // 2. Multiple orders from same phone in short time
  const samePhoneOrders = allOrders.filter(o => 
    o.customer_phone === order.customer_phone && 
    o.id !== order.id &&
    (new Date(order.created_at).getTime() - new Date(o.created_at).getTime()) < 24 * 60 * 60 * 1000
  );
  if (samePhoneOrders.length >= 3) {
    flags.push(`${samePhoneOrders.length + 1} Orders in 24hrs`);
    patterns.push('Rapid Order Velocity');
    riskScore += 25;
  }

  // 3. Address changed from previous order
  const previousOrder = customerOrders
    .filter(o => o.id !== order.id && new Date(o.created_at) < new Date(order.created_at))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  
  if (previousOrder && order.customer_address !== previousOrder.customer_address) {
    flags.push('Address Changed');
    riskScore += 15;
  }

  // 4. Multiple addresses for same phone
  const uniqueAddresses = new Set(
    customerOrders.filter(o => o.customer_phone === order.customer_phone)
      .map(o => o.customer_address.toLowerCase().trim())
  );
  if (uniqueAddresses.size >= 4) {
    flags.push(`${uniqueAddresses.size} Different Addresses`);
    patterns.push('Address Hopping Pattern');
    riskScore += 20;
  }

  // 5. First-time customer with high-value order
  if (customerOrders.length <= 1 && order.total_amount > 30000) {
    flags.push('New Customer - High Value');
    riskScore += 20;
  }

  // 6. High return rate for customer
  const returnOrders = customerOrders.filter(o => o.status === 'cancelled' || o.status === 'returned');
  const returnRate = customerOrders.length > 0 ? (returnOrders.length / customerOrders.length) * 100 : 0;
  if (returnRate > 50 && customerOrders.length >= 3) {
    flags.push(`${returnRate.toFixed(0)}% Return Rate`);
    patterns.push('High Return Pattern');
    riskScore += 30;
  }

  // 7. Order verification status
  if (order.verification_status === 'disapproved') {
    flags.push('Address Disapproved');
    riskScore += 25;
  }

  // 8. Suspicious city/area patterns
  const suspiciousCities = ['test', 'fake', 'dummy'];
  if (suspiciousCities.some(city => order.city?.toLowerCase().includes(city))) {
    flags.push('Suspicious Location');
    patterns.push('Test/Fake Address Pattern');
    riskScore += 35;
  }

  // 9. Phone number patterns
  if (order.customer_phone?.includes('0000') || order.customer_phone?.includes('1111')) {
    flags.push('Suspicious Phone Pattern');
    riskScore += 25;
  }

  // 10. Multiple failed delivery attempts from same customer
  const failedDeliveries = customerOrders.filter(o => 
    o.status === 'cancelled' && 
    o.notes?.toLowerCase().includes('delivery failed')
  );
  if (failedDeliveries.length >= 2) {
    flags.push(`${failedDeliveries.length} Failed Deliveries`);
    patterns.push('Repeated Delivery Failures');
    riskScore += 20;
  }

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (riskScore >= 80) riskLevel = 'critical';
  else if (riskScore >= 60) riskLevel = 'high';
  else if (riskScore >= 40) riskLevel = 'medium';

  // Determine automated actions
  if (riskScore >= 80) {
    autoActions.push('AUTO-BLOCK: Order requires manual approval');
    autoActions.push('ALERT: Notify fraud team immediately');
  } else if (riskScore >= 60) {
    autoActions.push('FLAG: Mark order for review');
    autoActions.push('VERIFY: Require additional verification');
  } else if (riskScore >= 40) {
    autoActions.push('MONITOR: Track order closely');
  }

  return {
    riskScore: Math.min(riskScore, 100),
    riskLevel,
    flags,
    patterns,
    autoActions,
    shouldBlock: riskScore >= 80,
    shouldFlag: riskScore >= 60
  };
};

/**
 * Analyze customer risk profile across all their orders
 */
export const analyzeCustomerRisk = (
  customerId: string,
  customerOrders: any[]
): CustomerRiskProfile => {
  const totalOrders = customerOrders.length;
  const successfulOrders = customerOrders.filter(o => o.status === 'delivered').length;
  const failedOrders = customerOrders.filter(o => 
    o.status === 'cancelled' || o.status === 'returned'
  ).length;
  
  const returnRate = totalOrders > 0 ? (failedOrders / totalOrders) * 100 : 0;
  
  // Count address changes
  const addresses = new Set(customerOrders.map(o => o.customer_address?.toLowerCase().trim()));
  const addressChanges = addresses.size;

  // Detect suspicious patterns
  const suspiciousPatterns: string[] = [];
  
  if (returnRate > 40) suspiciousPatterns.push('High return rate');
  if (addressChanges >= 5) suspiciousPatterns.push('Frequent address changes');
  if (totalOrders > 10 && successfulOrders < 3) suspiciousPatterns.push('Low success rate');
  
  // Calculate overall customer risk score
  let riskScore = 0;
  riskScore += Math.min(returnRate, 40); // Max 40 points
  riskScore += Math.min(addressChanges * 5, 25); // Max 25 points
  if (totalOrders > 5 && successfulOrders === 0) riskScore += 35;

  return {
    customerId,
    totalOrders,
    successfulOrders,
    failedOrders,
    returnRate,
    addressChanges,
    suspiciousPatterns,
    riskScore: Math.min(riskScore, 100)
  };
};

/**
 * Batch analyze multiple orders for fraud
 */
export const batchAnalyzeOrders = (
  orders: any[],
  allOrders: any[]
): OrderFraudAnalysis[] => {
  return orders.map(order => {
    // Get customer's order history
    const customerOrders = allOrders.filter(o => 
      o.customer_phone === order.customer_phone || 
      o.customer_email === order.customer_email
    );

    const fraudIndicators = calculateOrderFraudRisk(order, customerOrders, allOrders);
    const customerHistory = order.customer_id 
      ? analyzeCustomerRisk(order.customer_id, customerOrders)
      : undefined;

    return {
      order,
      fraudIndicators,
      customerHistory
    };
  });
};

/**
 * Get fraud statistics for reporting
 */
export const getFraudStatistics = (analyses: OrderFraudAnalysis[]) => {
  const total = analyses.length;
  const critical = analyses.filter(a => a.fraudIndicators.riskLevel === 'critical').length;
  const high = analyses.filter(a => a.fraudIndicators.riskLevel === 'high').length;
  const medium = analyses.filter(a => a.fraudIndicators.riskLevel === 'medium').length;
  const low = analyses.filter(a => a.fraudIndicators.riskLevel === 'low').length;

  const blocked = analyses.filter(a => a.fraudIndicators.shouldBlock).length;
  const flagged = analyses.filter(a => a.fraudIndicators.shouldFlag).length;

  const avgRiskScore = total > 0 
    ? analyses.reduce((sum, a) => sum + a.fraudIndicators.riskScore, 0) / total 
    : 0;

  // Get most common fraud patterns
  const patternCounts = new Map<string, number>();
  analyses.forEach(a => {
    a.fraudIndicators.patterns.forEach(pattern => {
      patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
    });
  });

  const topPatterns = Array.from(patternCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pattern, count]) => ({ pattern, count }));

  return {
    total,
    critical,
    high,
    medium,
    low,
    blocked,
    flagged,
    avgRiskScore: Math.round(avgRiskScore),
    topPatterns
  };
};
