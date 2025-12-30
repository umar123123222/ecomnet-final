import { Button } from "@/components/ui/button";
import { Clock, Package, CheckCircle, DollarSign } from "lucide-react";

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
      name: "Today",
      icon: <Clock className="h-3.5 w-3.5" />,
      filters: {
        dateRange: {
          from: new Date(new Date().setHours(0, 0, 0, 0)),
          to: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    },
    {
      id: 'pending-dispatch',
      name: "Pending",
      icon: <Package className="h-3.5 w-3.5" />,
      filters: {
        status: 'pending',
      },
    },
    {
      id: 'delivered-7days',
      name: "Delivered 7d",
      icon: <CheckCircle className="h-3.5 w-3.5" />,
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
      name: "High Value",
      icon: <DollarSign className="h-3.5 w-3.5" />,
      filters: {
        minAmount: 5000,
      },
    },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg border border-border/50">
      {presets.map((preset) => (
        <Button
          key={preset.id}
          variant={activePreset === preset.id ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onPresetSelect(activePreset === preset.id ? null : preset)}
          className={`h-8 px-3 gap-1.5 text-xs font-medium transition-all ${
            activePreset === preset.id 
              ? 'bg-background shadow-sm border border-border/50' 
              : 'hover:bg-background/60'
          }`}
        >
          {preset.icon}
          {preset.name}
        </Button>
      ))}
    </div>
  );
};