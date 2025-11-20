# Deployment Checklist

## Pre-Deployment

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] No console.log statements in production code
- [ ] All environment variables documented
- [ ] Build process completes without errors

### Testing
- [ ] All user roles tested for correct permissions
- [ ] Warehouse managers can access Dispatch and Returns pages
- [ ] Cache busting implemented and verified
- [ ] Version display showing correct version

### Security
- [ ] RLS policies reviewed and tested
- [ ] API keys securely stored in environment variables
- [ ] No sensitive data exposed in frontend code

## Deployment Process

### 1. Update Version Number
```bash
# Update VITE_APP_VERSION in .env
VITE_APP_VERSION="2.0.0"
```

### 2. Build Application
```bash
npm run build
```

### 3. Test Production Build Locally
```bash
npm run preview
```

### 4. Deploy to Production
- Click the "Publish" button in Lovable
- Click "Update" in the publish dialog to push frontend changes
- Note: Backend changes (edge functions, migrations) deploy automatically

## Post-Deployment Verification

### Immediate Checks (Within 5 minutes)
- [ ] Application loads without errors
- [ ] Authentication works correctly
- [ ] All user roles can access their designated pages
- [ ] Warehouse managers see Dispatch and Returns in navigation
- [ ] Version number displays correctly in sidebar footer

### Functional Testing (Within 15 minutes)
- [ ] Create a new dispatch - verify `dispatched_by` is set correctly
- [ ] Test Mark Orders as Dispatched dialog
- [ ] Verify cache busting - check that assets have hash in filename
- [ ] Test manual refresh button in header

### Performance Checks
- [ ] Page load times acceptable (<3 seconds)
- [ ] No memory leaks in browser console
- [ ] Database queries performing within acceptable limits

## User Communication

### Clear Cache Instructions for Users
Send this message to all active users:

```
📢 System Update Alert

We've deployed version 2.0.0 with important updates:
- Enhanced dispatch management
- Improved cache handling
- Better permission management
- New version tracking

Please refresh your browser to get the latest version:
- Windows/Linux: Ctrl + Shift + R
- Mac: Cmd + Shift + R

Or use the new refresh button in the top navigation bar.

If you experience any issues, please clear your browser cache completely.
```

## Rollback Procedure

If critical issues are discovered:

1. **Immediate Actions**
   - Notify all users to stop using the system
   - Document the issue with screenshots/logs

2. **Using Lovable History**
   - Click Project > View History
   - Select the previous stable version
   - Click "Restore"
   - Republish the application

3. **Manual Rollback**
   ```bash
   # Restore from git (if using GitHub integration)
   git revert HEAD
   git push
   ```

4. **Verify Rollback**
   - Test critical functionality
   - Confirm version number reverted
   - Notify users system is stable

## Monitoring

### First 24 Hours
Monitor these metrics closely:
- Error rates in browser console
- Failed API requests
- User login success rate
- Dispatch creation success rate
- Page load performance

### First Week
- User feedback on new features
- Cache-related issues
- Permission-related issues
- Performance degradation

### Tools
- Browser DevTools Console
- Supabase Dashboard > Logs
- User feedback channels

## Known Issues

### Current Limitations
1. Service workers not yet implemented
2. Offline functionality not available
3. Some courier integrations may need testing

### Planned Improvements
- Progressive Web App (PWA) support
- Enhanced offline capabilities
- Real-time notifications

## Support Contacts

- Technical Issues: [Your support email]
- Emergency Hotline: [Your phone number]
- Documentation: https://docs.lovable.dev/

## Version History

### Version 2.0.0 (Current)
- Added comprehensive cache busting
- Fixed warehouse manager permissions
- Implemented version tracking
- Enhanced dispatch error handling
- Added manual refresh button

### Version 1.0.0
- Initial release
- Basic order management
- Dispatch tracking
- User authentication
