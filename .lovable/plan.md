# Fix Supplier Analytics Mobile Layout

## Problem
On the Supplier Performance Analytics page (`/supplier-analytics`), the date filter tabs (7 Days, 30 Days, 90 Days, 1 Year) overflow horizontally on mobile, requiring horizontal dragging to see all options.

## Root Causes
1. **Header layout**: Uses `flex items-center justify-between` forcing title and tabs on same row
2. **TabsTrigger**: Has `whitespace-nowrap` preventing text wrap
3. **TabsList**: Uses `inline-flex` which doesn't allow wrapping

## Solution

### File: `src/pages/Suppliers/SupplierAnalyticsDashboard.tsx`

**Change 1: Make header stack on mobile**
- Current (lines 152-168):
```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-3xl font-bold flex items-center gap-3">
      ...
    </h1>
    <p className="text-muted-foreground">...</p>
  </div>
  <Tabs value={timeRange} onValueChange={setTimeRange}>
    <TabsList>
      <TabsTrigger value="7">7 Days</TabsTrigger>
      <TabsTrigger value="30">30 Days</TabsTrigger>
      <TabsTrigger value="90">90 Days</TabsTrigger>
      <TabsTrigger value="365">1 Year</TabsTrigger>
    </TabsList>
  </Tabs>
</div>
```

- Updated layout:
```tsx
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div className="min-w-0">
    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
      ...
    </h1>
    <p className="text-muted-foreground text-sm sm:text-base">...</p>
  </div>
  <Tabs value={timeRange} onValueChange={setTimeRange} className="w-full sm:w-auto">
    <TabsList className="flex flex-wrap h-auto gap-1 w-full sm:w-auto">
      <TabsTrigger value="7" className="flex-1 sm:flex-none whitespace-normal text-xs sm:text-sm px-2 sm:px-3">7 Days</TabsTrigger>
      <TabsTrigger value="30" className="flex-1 sm:flex-none whitespace-normal text-xs sm:text-sm px-2 sm:px-3">30 Days</TabsTrigger>
      <TabsTrigger value="90" className="flex-1 sm:flex-none whitespace-normal text-xs sm:text-sm px-2 sm:px-3">90 Days</TabsTrigger>
      <TabsTrigger value="365" className="flex-1 sm:flex-none whitespace-normal text-xs sm:text-sm px-2 sm:px-3">1 Year</TabsTrigger>
    </TabsList>
  </Tabs>
</div>
```

### Key Changes Explained

| Issue | Fix | Tailwind Classes |
|-------|-----|------------------|
| Header forces same row | Stack vertically on mobile | `flex-col gap-4 sm:flex-row` |
| TabsList doesn't wrap | Enable flex-wrap | `flex flex-wrap h-auto gap-1` |
| TabsTrigger too wide | Make flexible width | `flex-1 sm:flex-none` |
| Text doesn't wrap | Allow normal wrapping | `whitespace-normal` |
| Buttons too big on mobile | Smaller text/padding | `text-xs sm:text-sm px-2 sm:px-3` |
| Title overflow | Add min-width constraint | `min-w-0` on parent |

### Expected Result
- **Mobile**: Title on top, date tabs below in a row that fits within screen width
- **Desktop**: Original side-by-side layout preserved
- **No horizontal scrolling** on any screen size

### Additional Safety
- Added `min-w-0` to title container to prevent flex overflow
- Used `h-auto` on TabsList to accommodate any wrapping
- Slightly smaller text on mobile (`text-xs`) ensures all 4 buttons fit

---

## Files to Modify
1. `src/pages/Suppliers/SupplierAnalyticsDashboard.tsx` - Update header layout (lines 152-168)

## Estimated Time
Less than 5 minutes to implement and verify.
