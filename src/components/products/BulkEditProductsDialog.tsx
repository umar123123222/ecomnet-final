import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  bulkUpdateProductCategory,
  bulkUpdateProductSupplier,
  bulkUpdateProductReorderLevel,
  bulkToggleSmartReorder,
  bulkToggleBundle,
  bulkAssignPackaging,
  bulkUpdateProductCost,
  bulkUpdateProductPrice,
} from "@/utils/bulkOperations";

type EditField = 
  | "category" 
  | "supplier" 
  | "reorder_level" 
  | "smart_reorder" 
  | "bundle" 
  | "packaging"
  | "cost"
  | "retail_price";

interface BulkEditProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProductIds: string[];
  categories: string[];
  onComplete: () => void;
}

export function BulkEditProductsDialog({
  open,
  onOpenChange,
  selectedProductIds,
  categories,
  onComplete,
}: BulkEditProductsDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedField, setSelectedField] = useState<EditField | "">("");
  
  // Field values
  const [category, setCategory] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [reorderLevel, setReorderLevel] = useState<number>(10);
  const [smartReorderEnabled, setSmartReorderEnabled] = useState(true);
  const [isBundle, setIsBundle] = useState(false);
  const [packagingItemId, setPackagingItemId] = useState("");
  const [packagingQuantity, setPackagingQuantity] = useState(1);
  const [costValue, setCostValue] = useState<number>(0);
  const [retailPriceValue, setRetailPriceValue] = useState<number>(0);

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-for-bulk-edit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch packaging items
  const { data: packagingItems = [] } = useQuery({
    queryKey: ["packaging-items-for-bulk-edit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packaging_items")
        .select("id, name, sku")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const resetForm = () => {
    setSelectedField("");
    setCategory("");
    setSupplierId("");
    setReorderLevel(10);
    setSmartReorderEnabled(true);
    setIsBundle(false);
    setPackagingItemId("");
    setPackagingQuantity(1);
    setCostValue(0);
    setRetailPriceValue(0);
  };

  const handleSubmit = async () => {
    if (!selectedField) {
      toast({
        title: "Select a field",
        description: "Please select a field to update.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      let result;

      switch (selectedField) {
        case "category":
          if (!category.trim()) {
            toast({ title: "Enter a category", variant: "destructive" });
            return;
          }
          result = await bulkUpdateProductCategory(selectedProductIds, category.trim());
          break;
        case "supplier":
          result = await bulkUpdateProductSupplier(
            selectedProductIds, 
            supplierId === "none" ? null : supplierId
          );
          break;
        case "reorder_level":
          if (reorderLevel < 0) {
            toast({ title: "Reorder level must be positive", variant: "destructive" });
            return;
          }
          result = await bulkUpdateProductReorderLevel(selectedProductIds, reorderLevel);
          break;
        case "smart_reorder":
          result = await bulkToggleSmartReorder(selectedProductIds, smartReorderEnabled);
          break;
        case "bundle":
          result = await bulkToggleBundle(selectedProductIds, isBundle);
          break;
        case "packaging":
          if (!packagingItemId) {
            toast({ title: "Select a packaging item", variant: "destructive" });
            return;
          }
          result = await bulkAssignPackaging(
            selectedProductIds, 
            packagingItemId, 
            packagingQuantity
          );
          break;
        case "cost":
          if (costValue < 0) {
            toast({ title: "Cost must be positive", variant: "destructive" });
            return;
          }
          result = await bulkUpdateProductCost(selectedProductIds, costValue);
          break;
        case "retail_price":
          if (retailPriceValue < 0) {
            toast({ title: "Retail price must be positive", variant: "destructive" });
            return;
          }
          result = await bulkUpdateProductPrice(selectedProductIds, retailPriceValue);
          break;
      }

      if (result) {
        toast({
          title: "Bulk update complete",
          description: `Successfully updated ${result.success} product(s). ${result.failed > 0 ? `Failed: ${result.failed}` : ""}`,
        });
        onComplete();
        onOpenChange(false);
        resetForm();
      }
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderFieldInput = () => {
    switch (selectedField) {
      case "category":
        return (
          <div className="space-y-2">
            <Label>Category</Label>
            <Input
              placeholder="Enter category name"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="category-suggestions"
            />
            <datalist id="category-suggestions">
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>
        );
      case "supplier":
        return (
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Supplier</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case "reorder_level":
        return (
          <div className="space-y-2">
            <Label>Reorder Level</Label>
            <Input
              type="number"
              min={0}
              value={reorderLevel}
              onChange={(e) => setReorderLevel(parseInt(e.target.value) || 0)}
            />
          </div>
        );
      case "smart_reorder":
        return (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Smart Reordering</Label>
              <p className="text-sm text-muted-foreground">
                Enable automatic purchase order creation when stock is low
              </p>
            </div>
            <Switch
              checked={smartReorderEnabled}
              onCheckedChange={setSmartReorderEnabled}
            />
          </div>
        );
      case "bundle":
        return (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Bundle / Deal Product</Label>
              <p className="text-sm text-muted-foreground">
                Mark products as bundles (turning off clears bundle items)
              </p>
            </div>
            <Switch checked={isBundle} onCheckedChange={setIsBundle} />
          </div>
        );
      case "packaging":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Packaging Item</Label>
              <Select value={packagingItemId} onValueChange={setPackagingItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select packaging" />
                </SelectTrigger>
                <SelectContent>
                  {packagingItems.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity Required (per product)</Label>
              <Input
                type="number"
                min={1}
                value={packagingQuantity}
                onChange={(e) => setPackagingQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
        );
      case "cost":
        return (
          <div className="space-y-2">
            <Label>Cost (Rs.)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={costValue}
              onChange={(e) => setCostValue(parseFloat(e.target.value) || 0)}
              placeholder="Enter cost price"
            />
          </div>
        );
      case "retail_price":
        return (
          <div className="space-y-2">
            <Label>Retail Price (Rs.)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={retailPriceValue}
              onChange={(e) => setRetailPriceValue(parseFloat(e.target.value) || 0)}
              placeholder="Enter retail price"
            />
          </div>
        );
      default:
        return (
          <p className="text-sm text-muted-foreground text-center py-4">
            Select a field above to edit
          </p>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Edit Products</DialogTitle>
          <DialogDescription>
            Update {selectedProductIds.length} selected product(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Field to Update</Label>
            <Select
              value={selectedField}
              onValueChange={(v) => setSelectedField(v as EditField)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select field to edit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="cost">Cost Price</SelectItem>
                <SelectItem value="retail_price">Retail Price</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="reorder_level">Reorder Level</SelectItem>
                <SelectItem value="smart_reorder">Smart Reorder On/Off</SelectItem>
                <SelectItem value="bundle">Bundle / Deal On/Off</SelectItem>
                <SelectItem value="packaging">Assign Packaging</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {renderFieldInput()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !selectedField}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply to {selectedProductIds.length} Products
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}