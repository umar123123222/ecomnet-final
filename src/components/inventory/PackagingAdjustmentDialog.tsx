import { useState, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X, ImageIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";

// Standardized reason options
const DECREASE_REASONS = [
  { value: "items_damaged", label: "Items Damaged" },
  { value: "sale", label: "Sale" },
] as const;

const INCREASE_REASONS = [
  { value: "return_received", label: "Return Received" },
] as const;

// Additional reason for super roles (both increase and decrease)
const SUPER_ROLE_REASONS = [
  { value: "stock_adjustment", label: "Stock Adjustment" },
] as const;

const ALL_REASONS = [...DECREASE_REASONS, ...INCREASE_REASONS, ...SUPER_ROLE_REASONS] as const;

const packagingAdjustmentSchema = z.object({
  packaging_item_id: z.string().min(1, "Packaging item is required"),
  outlet_id: z.string().min(1, "Outlet/Warehouse is required"),
  adjustment_type: z.enum(["increase", "decrease"], {
    required_error: "Please select adjustment type",
  }),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  reason: z.enum(["items_damaged", "sale", "return_received", "stock_adjustment"], {
    required_error: "Please select a reason",
  }),
});

type PackagingAdjustmentFormData = z.infer<typeof packagingAdjustmentSchema>;

interface PackagingAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packagingItems: any[];
}

export function PackagingAdjustmentDialog({
  open,
  onOpenChange,
  packagingItems,
}: PackagingAdjustmentDialogProps) {
  const { profile } = useAuth();
  const { primaryRole } = useUserRoles();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isStoreManager = primaryRole === "store_manager";
  const isWarehouseManager = primaryRole === "warehouse_manager";
  const isSuperRole = primaryRole === "super_admin" || primaryRole === "super_manager";
  // Only store_manager and warehouse_manager are restricted to their assigned outlet
  const isOutletRestricted = isStoreManager || isWarehouseManager;

  // Fetch outlets for selection
  const { data: outlets } = useQuery({
    queryKey: ["outlets-for-packaging-adjustment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outlets")
        .select("id, name, outlet_type")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch user's assigned outlet (for store_manager and warehouse_manager)
  const { data: userOutlet } = useQuery<{ id: string; name: string } | null>({
    queryKey: ["user-assigned-outlet-packaging", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      // First check if user is a manager of an outlet
      const { data: managedData } = await supabase
        .from("outlets")
        .select("id, name")
        .eq("manager_id", profile.id)
        .eq("is_active", true)
        .limit(1);

      if (managedData && managedData.length > 0) {
        return { id: managedData[0].id, name: managedData[0].name };
      }

      // Otherwise check outlet_staff assignment
      const { data: staffData } = await supabase
        .from("outlet_staff")
        .select("outlet_id")
        .eq("user_id", profile.id)
        .limit(1);

      if (staffData && staffData.length > 0 && staffData[0].outlet_id) {
        const { data: outletData } = await supabase
          .from("outlets")
          .select("id, name")
          .eq("id", staffData[0].outlet_id)
          .limit(1);
        if (outletData && outletData.length > 0) {
          return { id: outletData[0].id, name: outletData[0].name };
        }
      }

      return null;
    },
    enabled: !!profile?.id && isOutletRestricted,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<PackagingAdjustmentFormData>({
    resolver: zodResolver(packagingAdjustmentSchema),
    defaultValues: {
      packaging_item_id: "",
      outlet_id: "",
      adjustment_type: "decrease",
      quantity: 1,
      reason: undefined,
    },
  });

  const adjustmentType = watch("adjustment_type");
  const selectedPackagingId = watch("packaging_item_id");
  const selectedOutletId = watch("outlet_id");
  const selectedReason = watch("reason");

  const selectedPackaging = packagingItems?.find(item => item.id === selectedPackagingId);
  const currentStock = selectedPackaging?.current_stock || 0;
  const selectedOutlet = outlets?.find(o => o.id === selectedOutletId);

  // Filter reason options based on adjustment type and role
  const getReasonOptions = () => {
    const baseReasons = adjustmentType === "decrease" ? [...DECREASE_REASONS] : [...INCREASE_REASONS];
    // Super roles get additional "Stock Adjustment" option for both increase and decrease
    if (isSuperRole) {
      return [...baseReasons, ...SUPER_ROLE_REASONS];
    }
    return baseReasons;
  };
  const filteredReasonOptions = getReasonOptions();

  // Set defaults when dialog opens
  useEffect(() => {
    if (open) {
      // Set outlet for restricted roles
      if (isOutletRestricted && userOutlet?.id) {
        setValue("outlet_id", userOutlet.id);
      }
      setValue("adjustment_type", "decrease");
      setValue("reason", "items_damaged");
    }
  }, [open, isOutletRestricted, userOutlet, setValue]);

  // Auto-update reason when adjustment type changes
  useEffect(() => {
    if (adjustmentType === "decrease") {
      setValue("reason", "items_damaged");
    } else {
      setValue("reason", "return_received");
    }
  }, [adjustmentType, setValue]);

  // Image is only required when reason is NOT stock_adjustment
  const isImageRequired = selectedReason !== 'stock_adjustment';

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Image must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      setProofImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setProofImage(null);
    setImagePreview(null);
  };

  const handleClose = () => {
    reset();
    setProofImage(null);
    setImagePreview(null);
    onOpenChange(false);
  };

  const onSubmit = async (data: PackagingAdjustmentFormData) => {
    if (isImageRequired && !proofImage) {
      toast({
        title: "Image Required",
        description: "Please upload proof image",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl: string | null = null;

      if (proofImage) {
        const fileExt = proofImage.name.split('.').pop();
        const fileName = `packaging-adjustment-${Date.now()}.${fileExt}`;
        const filePath = `packaging-adjustments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, proofImage);

        if (uploadError) {
          console.error('Image upload error:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('documents')
            .getPublicUrl(filePath);
          imageUrl = urlData.publicUrl;
        }
      }

      // Get reason label from appropriate options array
      const reasonText = ALL_REASONS.find(r => r.value === data.reason)?.label || data.reason;

      const { data: result, error } = await supabase.functions.invoke("manage-stock", {
        body: {
          operation: "adjustPackagingStock",
          data: {
            packagingItemId: data.packaging_item_id,
            outletId: data.outlet_id,
            quantity: data.adjustment_type === "increase" ? data.quantity : -data.quantity,
            reason: reasonText,
            proofImageUrl: imageUrl,
          },
        },
      });

      if (error) throw error;

      const resultData = result as any;
      
      toast({
        title: "Success",
        description: `Packaging stock ${data.adjustment_type === "increase" ? "increased" : "decreased"} from ${resultData.previousQuantity || currentStock} to ${resultData.newQuantity || (currentStock + (data.adjustment_type === "increase" ? data.quantity : -data.quantity))}`,
      });

      queryClient.invalidateQueries({ queryKey: ["packaging-items"] });
      handleClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to adjust packaging stock",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Packaging Stock Adjustment</DialogTitle>
          <DialogDescription>
            Increase or decrease packaging item stock quantity
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            {/* Row 1 */}
            <div className="space-y-2">
              <Label htmlFor="packaging_item_id">Packaging Item *</Label>
              <Select
                value={watch("packaging_item_id")}
                onValueChange={(value) => setValue("packaging_item_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select packaging item" />
                </SelectTrigger>
                <SelectContent>
                  {packagingItems?.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.packaging_item_id && (
                <p className="text-sm text-destructive">{errors.packaging_item_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="outlet_id">Outlet/Warehouse *</Label>
              {isOutletRestricted ? (
                <div className="flex items-center h-10 px-3 bg-muted rounded-md border text-sm">
                  {userOutlet?.name || (isStoreManager ? 'Your Store' : 'Your Warehouse')}
                </div>
              ) : (
                <Select
                  value={watch("outlet_id")}
                  onValueChange={(value) => setValue("outlet_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select outlet/warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {outlets?.map((outlet) => (
                      <SelectItem key={outlet.id} value={outlet.id}>
                        {outlet.name} {outlet.outlet_type === 'warehouse' ? '(Warehouse)' : '(Store)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.outlet_id && (
                <p className="text-sm text-destructive">{errors.outlet_id.message}</p>
              )}
            </div>

            {/* Row 2 */}
            <div className="space-y-2">
              <Label htmlFor="adjustment_type">Adjustment Type *</Label>
              <Select
                value={adjustmentType}
                onValueChange={(value) => setValue("adjustment_type", value as "increase" | "decrease")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="increase">Increase Stock</SelectItem>
                  <SelectItem value="decrease">Decrease Stock</SelectItem>
                </SelectContent>
              </Select>
              {errors.adjustment_type && (
                <p className="text-sm text-destructive">{errors.adjustment_type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                {...register("quantity", { valueAsNumber: true })}
                placeholder="1"
              />
              {errors.quantity && (
                <p className="text-sm text-destructive">{errors.quantity.message}</p>
              )}
            </div>

            {/* Row 3 */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Select
                value={selectedReason}
                onValueChange={(value) => setValue("reason", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {filteredReasonOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.reason && (
                <p className="text-sm text-destructive">{errors.reason.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Proof Image {isImageRequired && <span className="text-destructive">*</span>}
                {!isImageRequired && <span className="text-muted-foreground text-xs ml-1">(Optional)</span>}
              </Label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Proof"
                    className="max-h-20 rounded-md border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={removeImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Label
                  htmlFor="proof-image"
                  className="flex items-center justify-center gap-2 h-10 px-4 border border-dashed rounded-md cursor-pointer hover:bg-muted transition-colors"
                >
                  <ImageIcon className="h-4 w-4" />
                  <span className="text-sm">Upload Image</span>
                </Label>
              )}
              <Input
                id="proof-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
              {!proofImage && isImageRequired && (
                <p className="text-xs text-muted-foreground">Required</p>
              )}
            </div>
          </div>

          {selectedPackaging && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm">
                <span className="font-semibold">Current Stock:</span> {currentStock} units
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adjust Stock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}