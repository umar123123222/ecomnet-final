import { CalendarIcon, X, Calendar } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePickerWithRange } from "@/components/DatePickerWithRange";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ReservationDateFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onClear: () => void;
  isLoading?: boolean;
}

export function ReservationDateFilter({
  dateRange,
  onDateRangeChange,
  onClear,
  isLoading,
}: ReservationDateFilterProps) {
  const isFiltered = dateRange?.from !== undefined;

  const setPresetRange = (days: number) => {
    const today = new Date();
    onDateRangeChange({
      from: subDays(today, days),
      to: today,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-2",
              isFiltered && "border-primary bg-primary/5"
            )}
          >
            <Calendar className="h-4 w-4" />
            {isFiltered ? (
              <>
                Reservations: {format(dateRange.from!, "MMM d")}
                {dateRange.to && dateRange.to !== dateRange.from && (
                  <> - {format(dateRange.to, "MMM d")}</>
                )}
              </>
            ) : (
              "Filter by Order Date"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-4 max-w-[calc(100vw-32px)]" 
          align="start"
          side="bottom"
          sideOffset={4}
          avoidCollisions={true}
          collisionPadding={16}
        >
          <div className="space-y-4">
            <div className="text-sm font-medium">
              Show reserved quantities from orders placed:
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPresetRange(0)}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPresetRange(7)}
              >
                Last 7 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPresetRange(30)}
              >
                Last 30 days
              </Button>
            </div>

            <DatePickerWithRange
              date={dateRange}
              setDate={onDateRangeChange}
              className="w-full"
            />
          </div>
        </PopoverContent>
      </Popover>

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="gap-1 text-muted-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}

      {isLoading && (
        <Badge variant="outline" className="animate-pulse">
          Loading...
        </Badge>
      )}
    </div>
  );
}
