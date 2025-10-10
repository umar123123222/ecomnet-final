# Production Deployment Guide - Ecomnet Portal

## Pre-Deployment Checklist

### 1. Security ✅
- [x] All tables have RLS enabled
- [x] User roles stored in separate `user_roles` table
- [x] Audit trail configured for sensitive operations
- [x] Input validation implemented
- [x] Rate limiting in place
- [x] Error boundaries protecting the app
- [x] No hardcoded secrets in codebase
- [x] All API keys stored in Supabase secrets

### 2. Performance ✅
- [x] React Query caching configured
- [x] Component memoization implemented
- [x] Lazy loading for routes
- [x] Optimized bundle size
- [x] Image optimization
- [x] Database queries indexed

### 3. Code Quality ✅
- [x] TypeScript strict mode enabled
- [x] ESLint configured and passing
- [x] No console errors
- [x] Consistent code style
- [x] Design system tokens used
- [x] Responsive design implemented

### 4. Testing ✅
- [x] Authentication flow tested
- [x] CRUD operations verified
- [x] Real-time features working
- [x] Error handling validated
- [x] Mobile responsiveness checked

## Deployment Steps

### Option 1: Deploy via Lovable (Recommended)

1. **Click the Publish button** in the top right of the Lovable editor
2. **Review the deployment preview**
3. **Confirm deployment**
4. **Your app will be live at**: `https://your-project.lovable.app`

### Option 2: Deploy to Custom Domain

1. **Purchase a domain** from a registrar (Namecheap, GoDaddy, etc.)
2. **In Lovable, go to**: Project Settings → Domains
3. **Click "Connect Domain"** and enter your domain
4. **Configure DNS records**:
   ```
   Type: A
   Name: @ (root domain)
   Value: 185.158.133.1
   
   Type: A
   Name: www
   Value: 185.158.133.1
   ```
5. **Wait for DNS propagation** (up to 48 hours)
6. **SSL will be automatically provisioned** by Lovable

### Option 3: Self-Host via GitHub

1. **Connect to GitHub** via the GitHub button in Lovable
2. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/your-repo.git
   cd your-repo
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Build for production**:
   ```bash
   npm run build
   ```
5. **Deploy to your hosting provider**:
   - Vercel: `vercel deploy`
   - Netlify: `netlify deploy --prod`
   - AWS Amplify, Cloudflare Pages, etc.

## Post-Deployment Configuration

### 1. Supabase Settings

**Authentication Settings** (https://supabase.com/dashboard/project/{project_id}/auth/providers):

1. **Site URL**: Set to your production domain
   ```
   https://your-domain.com
   ```

2. **Redirect URLs**: Add all valid redirect URLs
   ```
   https://your-domain.com
   https://www.your-domain.com
   https://your-project.lovable.app
   ```

3. **Email Templates**: Customize email templates for:
   - Confirmation emails
   - Password reset emails
   - Magic link emails

4. **Rate Limits**: Review and adjust as needed
   - Default: 10 requests per second per IP

### 2. Edge Functions Configuration

All edge functions are automatically deployed. Verify they're working:

1. **Check Edge Function Logs**:
   https://supabase.com/dashboard/project/lzitfcigdjbpymvebipp/functions

2. **Test Critical Functions**:
   - `manage-stock`: Stock management operations
   - `stock-transfer-request`: Stock transfer requests
   - `manage-user`: User management
   - `low-stock-alerts`: Inventory alerts
   - `inventory-reports`: Report generation

### 3. Database Optimization

**Run these SQL optimizations** (https://supabase.com/dashboard/project/lzitfcigdjbpymvebipp/sql/new):

```sql
-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON dispatches(status);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(return_status);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_outlet_id ON inventory(outlet_id);

-- Analyze tables for query optimization
ANALYZE orders;
ANALYZE dispatches;
ANALYZE returns;
ANALYZE inventory;
ANALYZE customers;
```

### 4. Monitoring Setup

**Enable Supabase Monitoring**:

1. **Database Metrics**: 
   - https://supabase.com/dashboard/project/lzitfcigdjbpymvebipp/reports/database
   - Monitor connection pool usage
   - Track query performance
   - Watch for slow queries

2. **API Metrics**:
   - https://supabase.com/dashboard/project/lzitfcigdjbpymvebipp/reports/api
   - Monitor request rates
   - Track error rates
   - Review response times

3. **Auth Metrics**:
   - https://supabase.com/dashboard/project/lzitfcigdjbpymvebipp/reports/auth
   - Monitor active users
   - Track authentication events
   - Review failed login attempts

4. **Edge Function Logs**:
   - https://supabase.com/dashboard/project/lzitfcigdjbpymvebipp/functions
   - Check for errors
   - Monitor execution times
   - Review usage patterns

### 5. Backup Strategy

**Database Backups**:
- Supabase automatically backs up your database daily
- Backups are retained for 7 days (free tier) or 30 days (paid tier)
- Manual backups available in Supabase dashboard

**Critical Data to Backup Regularly**:
- Orders
- Customers
- Inventory
- User roles and permissions

**Backup Verification Schedule**:
- Weekly: Verify automated backups are running
- Monthly: Test backup restoration
- Quarterly: Review backup retention policy

## Environment-Specific Configuration

### Development
- Use Lovable preview URL
- Supabase development project (if separate)
- Test data only
- Debug logging enabled

### Staging (Optional)
- Separate Lovable deployment
- Clone of production Supabase project
- Production-like data
- Performance monitoring enabled

### Production
- Custom domain or Lovable production URL
- Production Supabase project (lzitfcigdjbpymvebipp)
- Real user data
- Full monitoring and logging
- Error tracking enabled

## Performance Optimization

### Client-Side
1. **React Query Configuration** (already implemented):
   ```typescript
   staleTime: 5 * 60 * 1000, // 5 minutes
   gcTime: 10 * 60 * 1000,   // 10 minutes
   ```

2. **Lazy Loading** (already implemented):
   - All routes are lazy-loaded
   - Reduces initial bundle size

3. **Image Optimization**:
   - Use WebP format when possible
   - Implement lazy loading for images
   - Use appropriate image sizes

### Server-Side
1. **Database Connection Pooling**:
   - Supabase handles automatically
   - Monitor pool usage in dashboard

2. **Query Optimization**:
   - Use indexes (see SQL above)
   - Avoid N+1 queries
   - Use pagination for large datasets

3. **Caching Strategy**:
   - React Query handles client-side caching
   - Consider Redis for server-side caching (future enhancement)

## Security Hardening

### 1. Review RLS Policies
Run the Supabase linter to check for security issues:
```bash
# Already run - check results in dashboard
```

### 2. Secure Headers
These are automatically configured by Lovable, but verify:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

### 3. Rate Limiting
- Implemented in `inputValidation.ts`
- Adjust limits based on usage patterns

### 4. Audit Trail
- Automatically logging sensitive operations
- Review logs regularly in `activity_logs` table

## Monitoring and Alerts

### Set Up Alerts

1. **Database Alerts**:
   - High connection pool usage (>80%)
   - Slow queries (>1 second)
   - Failed queries

2. **API Alerts**:
   - Error rate >5%
   - Response time >2 seconds
   - Request rate anomalies

3. **Auth Alerts**:
   - Multiple failed login attempts
   - Unusual authentication patterns
   - New user registrations spike

4. **Edge Function Alerts**:
   - Function errors
   - Timeout errors
   - High execution times

### Weekly Review Checklist

- [ ] Review error logs
- [ ] Check performance metrics
- [ ] Verify backup completion
- [ ] Review user feedback
- [ ] Check for security updates
- [ ] Monitor resource usage
- [ ] Review audit logs

## Rollback Procedure

### If Issues Occur After Deployment

1. **Using Lovable Version History**:
   - Go to Edit History in Lovable
   - Find the last working version
   - Click "Restore" to rollback

2. **Using GitHub** (if connected):
   ```bash
   # Revert to previous commit
   git revert HEAD
   git push origin main
   ```

3. **Database Rollback**:
   - Use Supabase Point-in-Time Recovery
   - Available for paid plans
   - Can restore to any point in last 7-30 days

## Post-Launch Tasks

### Day 1
- [ ] Monitor error logs closely
- [ ] Check authentication flow
- [ ] Verify critical user paths
- [ ] Monitor performance metrics
- [ ] Be available for immediate fixes

### Week 1
- [ ] Review user feedback
- [ ] Analyze usage patterns
- [ ] Check for performance bottlenecks
- [ ] Verify all features working
- [ ] Document any issues

### Month 1
- [ ] Comprehensive performance review
- [ ] Security audit
- [ ] Backup verification
- [ ] Cost analysis (Supabase usage)
- [ ] Plan for optimizations

## Scaling Considerations

### When to Upgrade Supabase Plan

**Free Tier Limits**:
- 500 MB database size
- 1 GB file storage
- 2 GB bandwidth/month
- 50,000 monthly active users

**Upgrade When**:
- Database size >400 MB
- Monthly active users >40,000
- Need Point-in-Time Recovery
- Require daily backups >7 days
- Need priority support

### Performance Scaling

1. **Database**:
   - Enable connection pooling (Supavisor)
   - Add read replicas
   - Optimize queries with EXPLAIN ANALYZE

2. **Frontend**:
   - Implement CDN for static assets
   - Enable compression (already configured)
   - Add service worker for offline support

3. **Edge Functions**:
   - Monitor execution times
   - Optimize function code
   - Consider function composability

## Support and Resources

### Supabase Dashboard
- Project URL: https://supabase.com/dashboard/project/lzitfcigdjbpymvebipp
- Documentation: https://supabase.com/docs
- Status Page: https://status.supabase.com

### Lovable Resources
- Documentation: https://docs.lovable.dev
- Support: support@lovable.dev
- Status: https://status.lovable.dev

### Emergency Contacts
- Supabase Support: support@supabase.io
- Lovable Support: support@lovable.dev

## Maintenance Schedule

### Daily
- Check error logs
- Monitor performance metrics

### Weekly
- Review security logs
- Check backup status
- Update dependencies (if needed)

### Monthly
- Security audit
- Performance review
- Cost optimization
- Dependency updates

### Quarterly
- Comprehensive security review
- Infrastructure optimization
- Feature planning
- User feedback analysis

---

**Deployment Date**: _________________

**Deployed By**: _________________

**Production URL**: _________________

**Notes**: _________________

---

*This deployment guide is maintained by the development team. Last updated: 2025-10-10*
