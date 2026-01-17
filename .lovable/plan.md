# Fix Supplier Analytics Mobile Layout - Corrected Approach

## Problem Analysis

The previous fix attempted to use `flex-wrap` on `TabsList` but this conflicts with the base component's `inline-flex`. The `whitespace-normal` override also may not reliably override the base `whitespace-nowrap` in the `cn()` merge.

## Root Cause

The Tabs component in `src/components/ui/tabs.tsx` has:
- `TabsList`: `inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground`
- `TabsTrigger`: `inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium...`

The `inline-flex` and `whitespace-nowrap` are baked into the base component, and class merging with `cn()` can sometimes fail to properly override conflicting properties.

## Solution - Use CSS Grid for Reliable Layout

Instead of fighting with flex classes, use a 2x2 or 4-column grid that is guaranteed to fit on mobile.

### File: `src/pages/Suppliers/SupplierAnalyticsDashboard.tsx`

**Changes to lines 152-168:**

```tsx
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div className="min-w-0">
    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
      <TrendingUp className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
      Supplier Performance Analytics
    </h1>
    <p className="text-muted-foreground text-sm sm:text-base">Track and analyze supplier reliability and quality</p>
  </div>
  
  {/* Mobile: Use a simple button group with grid layout */}
  <div className="flex sm:hidden">
    <div className="grid grid-cols-4 gap-1 w-full bg-muted p-1 rounded-md">
      {[
        { value: "7", label: "7D" },
        { value: "30", label: "30D" },
        { value: "90", label: "90D" },
        { value: "365", label: "1Y" }
      ].map((item) => (
        <button
          key={item.value}
          onClick={() => setTimeRange(item.value)}
          className={cn(
            "py-1.5 text-xs font-medium rounded-sm transition-all text-center",
            timeRange === item.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  </div>
  
  {/* Desktop: Keep original Tabs component */}
  <Tabs value={timeRange} onValueChange={setTimeRange} className="hidden sm:block">
    <TabsList>
      <TabsTrigger value="7">7 Days</TabsTrigger>
      <TabsTrigger value="30">30 Days</TabsTrigger>
      <TabsTrigger value="90">90 Days</TabsTrigger>
      <TabsTrigger value="365">1 Year</TabsTrigger>
    </TabsList>
  </Tabs>
</div>
```

## Key Changes Explained

| Issue | Solution |
|-------|----------|
| `inline-flex` conflicts | Use separate mobile component with CSS grid |
| `whitespace-nowrap` not overriding | Use abbreviated labels (7D, 30D, 90D, 1Y) for mobile |
| Horizontal overflow | `grid-cols-4` guarantees 4 columns fit in container |
| Desktop unchanged | Original Tabs hidden on mobile, shown on desktop |

## Why This Approach Works

1. **Separation of concerns**: Mobile and desktop layouts are completely separate, no class conflicts
2. **Grid is reliable**: `grid-cols-4` with `w-full` will always divide the container into 4 equal parts
3. **Abbreviated labels**: "7D" instead of "7 Days" uses less space
4. **Same visual style**: Matches the muted background and rounded corners of TabsList
5. **Same functionality**: Both call `setTimeRange()` with the same values

## Import Required

Add `cn` import if not already present:
```tsx
import { cn } from "@/lib/utils";
```

## Expected Result

- **Mobile**: 4 compact buttons in a row (7D | 30D | 90D | 1Y) that fit perfectly
- **Desktop**: Original "7 Days", "30 Days", "90 Days", "1 Year" tabs unchanged
- **No horizontal scrolling** on any screen size

## Files to Modify

1. `src/pages/Suppliers/SupplierAnalyticsDashboard.tsx` - Replace header section with mobile-first grid layout

## Estimated Time

5-10 minutes to implement and verify.