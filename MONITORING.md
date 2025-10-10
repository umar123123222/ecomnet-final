# Production Monitoring Guide

## Overview

This guide provides comprehensive monitoring strategies for the Ecomnet Portal in production.

## Real-Time Monitoring Dashboard

### Key Metrics to Monitor

#### 1. Application Health
- **Uptime**: Target >99.9%
- **Error Rate**: Target <1%
- **Response Time**: Target <2s
- **Active Users**: Real-time count

#### 2. Database Performance
- **Connection Pool Usage**: Alert if >80%
- **Query Performance**: Alert if >1s
- **Active Connections**: Monitor trends
- **Cache Hit Rate**: Target >90%

#### 3. API Performance
- **Request Rate**: Monitor trends
- **Error Rate by Endpoint**: Alert if >5%
- **Response Time by Endpoint**: Alert if >2s
- **Rate Limit Hits**: Monitor for abuse

#### 4. Edge Functions
- **Execution Time**: Alert if >10s
- **Error Rate**: Alert if >5%
- **Invocation Count**: Monitor trends
- **Memory Usage**: Alert if >90%

## Supabase Monitoring Setup

### Access Monitoring Dashboards

1. **Database Metrics**:
   https://supabase.com/dashboard/project/lzitfcigdjbpymvebipp/reports/database

2. **API Metrics**:
   https://supabase.com/dashboard/project/lzitfcigdjbpymvebipp/reports/api

3. **Auth Metrics**:
   https://supabase.com/dashboard/project/lzitfcigdjbpymvebipp/reports/auth

4. **Edge Function Logs**:
   https://supabase.com/dashboard/project/lzitfcigdjbpymvebipp/functions

### Critical Metrics Configuration

#### Database Alerts
```sql
-- Monitor long-running queries
SELECT pid, now() - query_start as duration, query 
FROM pg_stat_activity 
WHERE state = 'active' 
AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;

-- Monitor connection pool
SELECT count(*) as total_connections,
       count(*) FILTER (WHERE state = 'active') as active_connections,
       count(*) FILTER (WHERE state = 'idle') as idle_connections
FROM pg_stat_activity;

-- Monitor table sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Performance Monitoring Queries

```sql
-- Identify slow queries
SELECT query, 
       mean_exec_time,
       calls,
       total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname,
       idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Monitor cache hit ratio
SELECT 
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;
```

## Application-Level Monitoring

### Performance Monitoring

The application has built-in performance monitoring via `usePerformance` hook:

```typescript
// Already implemented in src/hooks/usePerformance.ts
usePerformanceLogger('ComponentName');
useWebVitals();
```

### Activity Logging

All sensitive operations are logged to `activity_logs` table:

```sql
-- View recent activity
SELECT 
  al.created_at,
  p.full_name as user_name,
  al.entity_type,
  al.action,
  al.details
FROM activity_logs al
LEFT JOIN profiles p ON al.user_id = p.id
ORDER BY al.created_at DESC
LIMIT 100;

-- Monitor suspicious activity
SELECT 
  user_id,
  entity_type,
  COUNT(*) as action_count
FROM activity_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id, entity_type
HAVING COUNT(*) > 50  -- More than 50 actions per hour
ORDER BY action_count DESC;
```

### Error Monitoring

Monitor console errors and network failures:

```javascript
// Already implemented via ErrorBoundary
// Check browser console for:
// - React errors
// - Network failures
// - Unhandled promises
```

## Alert Configuration

### Critical Alerts (Immediate Response)

1. **Database Down**
   - Trigger: Cannot connect to database
   - Action: Check Supabase status, escalate immediately

2. **High Error Rate**
   - Trigger: Error rate >10%
   - Action: Investigate logs, consider rollback

3. **Authentication Failure**
   - Trigger: Auth service down
   - Action: Check Supabase auth, verify configuration

4. **Edge Function Timeout**
   - Trigger: Multiple function timeouts
   - Action: Review function logs, optimize code

### Warning Alerts (Monitor Closely)

1. **Increased Response Time**
   - Trigger: Average response >2s
   - Action: Review slow queries, optimize

2. **Connection Pool Usage**
   - Trigger: Usage >80%
   - Action: Review connection management

3. **Failed Login Attempts**
   - Trigger: >10 failures from same IP
   - Action: Review for security threats

4. **Low Cache Hit Rate**
   - Trigger: Cache hit rate <80%
   - Action: Review query patterns, adjust caching

### Informational Alerts (Review Daily)

1. **Usage Trends**
   - Monitor daily active users
   - Track feature adoption

2. **Performance Trends**
   - Review average response times
   - Check database query performance

3. **Storage Usage**
   - Monitor database size growth
   - Track file storage usage

## Daily Monitoring Checklist

### Morning Check (5 minutes)
- [ ] Review overnight error logs
- [ ] Check system uptime
- [ ] Verify automated backups completed
- [ ] Review key metrics dashboard

### Midday Check (5 minutes)
- [ ] Monitor active users
- [ ] Check performance metrics
- [ ] Review any new alerts
- [ ] Check edge function logs

### Evening Check (5 minutes)
- [ ] Review daily error summary
- [ ] Check performance trends
- [ ] Verify backup completion
- [ ] Plan any optimizations

## Weekly Monitoring Tasks

### Monday: Security Review (30 minutes)
- [ ] Review audit logs
- [ ] Check failed login attempts
- [ ] Review access patterns
- [ ] Check for unusual activity

### Wednesday: Performance Review (30 minutes)
- [ ] Analyze slow query log
- [ ] Review database performance
- [ ] Check API response times
- [ ] Review edge function performance

### Friday: Capacity Planning (30 minutes)
- [ ] Review storage usage trends
- [ ] Check database size growth
- [ ] Monitor connection pool trends
- [ ] Plan for scaling if needed

## Monthly Monitoring Tasks

### First Week: Comprehensive Review (2 hours)
- [ ] Full security audit
- [ ] Performance optimization review
- [ ] Cost analysis (Supabase usage)
- [ ] User feedback review
- [ ] Feature usage analysis

### Second Week: Infrastructure Review (1 hour)
- [ ] Review backup strategy
- [ ] Test disaster recovery
- [ ] Check dependency updates
- [ ] Review monitoring effectiveness

### Third Week: Optimization (2 hours)
- [ ] Implement performance improvements
- [ ] Optimize database queries
- [ ] Review and update indexes
- [ ] Optimize edge functions

### Fourth Week: Planning (1 hour)
- [ ] Review metrics and trends
- [ ] Plan next month's improvements
- [ ] Update documentation
- [ ] Team retrospective

## Incident Response

### Severity Levels

**SEV-1: Critical**
- Complete outage
- Data breach
- Authentication failure
- Response time: Immediate
- Resolution target: <1 hour

**SEV-2: High**
- Partial outage
- Severe performance degradation
- Edge function failures
- Response time: <15 minutes
- Resolution target: <4 hours

**SEV-3: Medium**
- Minor performance issues
- Isolated feature failures
- High error rates
- Response time: <1 hour
- Resolution target: <24 hours

**SEV-4: Low**
- Cosmetic issues
- Minor bugs
- Feature requests
- Response time: <24 hours
- Resolution target: Next release

### Incident Checklist

1. **Identify**: Determine severity level
2. **Notify**: Alert appropriate team members
3. **Investigate**: Review logs and metrics
4. **Mitigate**: Implement temporary fixes
5. **Resolve**: Deploy permanent solution
6. **Document**: Record incident details
7. **Review**: Post-mortem analysis
8. **Improve**: Implement preventive measures

## Useful Supabase Queries

### Real-Time Monitoring

```sql
-- Active users (last 5 minutes)
SELECT COUNT(DISTINCT user_id) 
FROM activity_logs 
WHERE created_at > NOW() - INTERVAL '5 minutes';

-- Recent errors
SELECT * FROM activity_logs 
WHERE details->>'error' IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;

-- Top active users
SELECT p.full_name, COUNT(*) as actions
FROM activity_logs al
JOIN profiles p ON al.user_id = p.id
WHERE al.created_at > NOW() - INTERVAL '1 day'
GROUP BY p.id, p.full_name
ORDER BY actions DESC
LIMIT 10;
```

### Performance Analysis

```sql
-- Slowest endpoints (requires pg_stat_statements)
SELECT query, 
       mean_exec_time,
       calls,
       total_exec_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Table bloat check
SELECT schemaname, tablename,
       pg_size_pretty(pg_table_size(schemaname||'.'||tablename)) as table_size,
       pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_table_size(schemaname||'.'||tablename) DESC;
```

## Monitoring Tools Integration

### Recommended Tools

1. **Uptime Monitoring**:
   - UptimeRobot (free tier available)
   - Pingdom
   - StatusCake

2. **Error Tracking**:
   - Sentry (recommended)
   - Rollbar
   - Bugsnag

3. **Performance Monitoring**:
   - Google Lighthouse
   - WebPageTest
   - New Relic (if budget allows)

4. **Log Management**:
   - Supabase built-in logs
   - Logtail
   - Papertrail

### Setting Up Sentry (Recommended)

```typescript
// Install Sentry
// npm install @sentry/react

// Add to src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production",
  tracesSampleRate: 0.1, // 10% of transactions
  integrations: [
    new Sentry.BrowserTracing(),
  ],
});

// Wrap App with Sentry
Sentry.withProfiler(App);
```

## Monitoring Dashboard

### Key Metrics Display

Create a monitoring dashboard with:

1. **System Health**:
   - Green: All systems operational
   - Yellow: Warnings present
   - Red: Critical issues

2. **Performance Gauges**:
   - Database response time
   - API response time
   - Error rate
   - Active users

3. **Trend Charts**:
   - Daily active users
   - Request volume
   - Error trends
   - Response time trends

4. **Recent Events**:
   - Latest errors
   - Recent deployments
   - System alerts
   - User activity spikes

---

*Monitoring guide last updated: 2025-10-10*  
*Review frequency: Monthly or after major incidents*
