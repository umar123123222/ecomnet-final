import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineEditableCellProps {
  value: string | number | null | undefined;
  onSave: (newValue: string | number) => Promise<void>;
  type?: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  className?: string;
  disabled?: boolean;
  formatDisplay?: (value: string | number | null | undefined) => string;
}

export const InlineEditableCell = ({
  value,
  onSave,
  type = 'text',
  options = [],
  placeholder = '-',
  prefix = '',
  suffix = '',
  className = '',
  disabled = false,
  formatDisplay
}: InlineEditableCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>(String(value ?? ''));
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(String(value ?? ''));
  }, [value]);

  const handleSave = async () => {
    if (editValue === String(value ?? '')) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      const saveValue = type === 'number' ? parseFloat(editValue) || 0 : editValue;
      await onSave(saveValue);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
      setIsEditing(false);
    } catch (error) {
      // Error handling is done in parent
      setEditValue(String(value ?? ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue(String(value ?? ''));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const displayValue = formatDisplay 
    ? formatDisplay(value) 
    : value != null 
      ? `${prefix}${typeof value === 'number' ? value.toLocaleString() : value}${suffix}`
      : placeholder;

  if (disabled) {
    return <span className={className}>{displayValue}</span>;
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className={cn("flex items-center gap-1 text-green-600", className)}>
        <Check className="h-3 w-3" />
        <span className="text-sm">Saved</span>
      </div>
    );
  }

  if (isEditing) {
    if (type === 'select') {
      return (
        <Select
          value={editValue}
          onValueChange={(val) => {
            setEditValue(val);
            // Auto-save on select
            setIsLoading(true);
            onSave(val)
              .then(() => {
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 1500);
                setIsEditing(false);
              })
              .catch(() => setEditValue(String(value ?? '')))
              .finally(() => setIsLoading(false));
          }}
          onOpenChange={(open) => {
            if (!open) setIsEditing(false);
          }}
          open={true}
        >
          <SelectTrigger className="h-7 w-[140px] text-xs">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {options.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-7 w-24 text-xs px-2"
          step={type === 'number' ? '0.01' : undefined}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        "group flex items-center gap-1 hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors cursor-pointer text-left",
        className
      )}
    >
      <span>{displayValue}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};
