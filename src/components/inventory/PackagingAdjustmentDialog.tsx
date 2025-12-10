import { useState, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";

const REASON_OPTIONS = [
  { value: "shipment_received", label: "Shipment Received" },
  { value: "damaged_items", label: "Damaged Items" },
  { value: "other", label: "Other" },
] as const;

const packagingAdjustmentSchema = z.object({
  packaging_item_id: z.string().min(1, "Packaging item is required"),
  adjustment_type: z.enum(["increase", "decrease"], {
    required_error: "Please select adjustment type",
  }),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  reason: z.enum(["shipment_received", "damaged_items", "other"], {
    required_error: "Please select a reason",
  }),
  other_reason: z.string().optional(),
}).refine((data) => {
  if (data.reason === "other") {
    return data.other_reason && data.other_reason.trim().length > 0;
  }
  return true;
}, {
  message: "Please specify the reason",
  path: ["other_reason"],
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user profile to check role
  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();
      return data;
    },
  });

  const isStoreManager = profile?.role === "store_manager";

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
      adjustment_type: isStoreManager ? "decrease" : "increase",
      quantity: 1,
      reason: undefined,
      other_reason: "",
    },
  });

  const adjustmentType = watch("adjustment_type");
  const selectedPackagingId = watch("packaging_item_id");
  const selectedReason = watch("reason");

  const selectedPackaging = packagingItems?.find(item => item.id === selectedPackagingId);
  const currentStock = selectedPackaging?.current_stock || 0;

  // Filter reason options for store managers
  const filteredReasonOptions = isStoreManager
    ? (adjustmentType === "decrease"
        ? REASON_OPTIONS.filter(r => r.value === "damaged_items")
        : REASON_OPTIONS.filter(r => r.value === "shipment_received"))
    : REASON_OPTIONS;

  // Auto-select reason for store managers when adjustment type changes
  useEffect(() => {
    if (isStoreManager && open) {
      setValue("adjustment_type", "decrease");
      setValue("reason", "damaged_items");
    }
  }, [isStoreManager, open, setValue]);

  useEffect(() => {
    if (isStoreManager) {
      if (adjustmentType === "decrease") {
        setValue("reason", "damaged_items");
      } else {
        setValue("reason", "shipment_received");
      }
    }
  }, [adjustmentType, isStoreManager, setValue]);

  const isImageRequired = selectedReason === "damaged_items";
  const showOtherReasonInput = selectedReason === "other";

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
        description: "Please upload proof image for damaged items",
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

      const reasonText = data.reason === "other" 
        ? `Other: ${data.other_reason}` 
        : REASON_OPTIONS.find(r => r.value === data.reason)?.label || data.reason;

      const { data: result, error } = await supabase.functions.invoke("manage-stock", {
        body: {
          operation: "adjustPackagingStock",
          data: {
            packagingItemId: data.packaging_item_id,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Packaging Stock Adjustment</DialogTitle>
          <DialogDescription>
            Increase or decrease packaging item stock quantity
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                    {item.name} ({item.sku}) - Current: {item.current_stock}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.packaging_item_id && (
              <p className="text-sm text-destructive">{errors.packaging_item_id.message}</p>
            )}
          </div>

          {selectedPackaging && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm">
                <span className="font-semibold">Current Stock:</span> {currentStock} units
              </p>
            </div>
          )}

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

          {showOtherReasonInput && (
            <div className="space-y-2">
              <Label htmlFor="other_reason">Specify Reason *</Label>
              <Textarea
                id="other_reason"
                {...register("other_reason")}
                placeholder="Please describe the reason for adjustment..."
                rows={2}
              />
              {errors.other_reason && (
                <p className="text-sm text-destructive">{errors.other_reason.message}</p>
              )}
            </div>
          )}

          {(selectedReason === "damaged_items" || selectedReason === "other") && (
            <div className="space-y-2">
              <Label>
                Proof Image {isImageRequired ? "*" : "(Optional)"}
              </Label>
              
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Proof"
                    className="max-h-32 rounded-md border"
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
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="proof-image"
                    className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-md cursor-pointer hover:bg-muted transition-colors"
                  >
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-sm">Upload Image</span>
                  </Label>
                  <Input
                    id="proof-image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </div>
              )}
              
              {isImageRequired && !proofImage && (
                <p className="text-sm text-muted-foreground">
                  Image proof is required for damaged items
                </p>
              )}
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
