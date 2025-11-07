import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Package, CheckCircle, DollarSign, X } from "lucide-react";

interface FilterPreset {
  id: string;
  name: string;
  icon: React.ReactNode;
  filters: {
    status?: string;
    dateRange?: { from: Date; to: Date };
    minAmount?: number;
  };
}

interface FilterPresetsProps {
  activePreset: string | null;
  onPresetSelect: (preset: FilterPreset | null) => void;
}

export const FilterPresets = ({ activePreset, onPresetSelect }: FilterPresetsProps) => {
  const presets: FilterPreset[] = [
    {
      id: 'today',
      name: "Today's Orders",
      icon: <Clock className="h-4 w-4" />,
      filters: {
        dateRange: {
          from: new Date(new Date().setHours(0, 0, 0, 0)),
          to: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    },
    {
      id: 'pending-dispatch',
      name: "Pending Dispatch",
      icon: <Package className="h-4 w-4" />,
      filters: {
        status: 'pending',
      },
    },
    {
      id: 'delivered-7days',
      name: "Delivered Last 7 Days",
      icon: <CheckCircle className="h-4 w-4" />,
      filters: {
        status: 'delivered',
        dateRange: {
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          to: new Date(),
        },
      },
    },
    {
      id: 'high-value',
      name: "High-Value Orders",
      icon: <DollarSign className="h-4 w-4" />,
      filters: {
        minAmount: 5000,
      },
    },
  ];

  return (
    <div className="flex flex-wrap gap-2 items-center animate-fade-in">
      <span className="text-sm text-muted-foreground mr-2">Quick Filters:</span>
      {presets.map((preset) => (
        <Button
          key={preset.id}
          variant={activePreset === preset.id ? "default" : "outline"}
          size="sm"
          onClick={() => onPresetSelect(activePreset === preset.id ? null : preset)}
          className="gap-2"
        >
          {preset.icon}
          {preset.name}
        </Button>
      ))}
      {activePreset && (
        <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => onPresetSelect(null)}>
          Clear Filter
          <X className="h-3 w-3" />
        </Badge>
      )}
    </div>
  );
};
