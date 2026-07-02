import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Product, PRODUCT_CATEGORIES } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProductEditModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductEditModal({ product, isOpen, onClose }: ProductEditModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    price: "",
    description: "",
    category: "Electronics",
    stockQuantity: "",
  });

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        price: String(product.price),
        description: product.description,
        category: product.category,
        stockQuantity: String(product.stockQuantity),
      });
    }
  }, [product]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/products/${product!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          price: Number(form.price),
          description: form.description.trim(),
          category: form.category,
          stockQuantity: Number(form.stockQuantity),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update product");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/products") });
      toast({ title: "Product updated" });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const canSave =
    form.name.trim() !== "" &&
    Number(form.price) > 0 &&
    Number.isInteger(Number(form.stockQuantity)) &&
    Number(form.stockQuantity) >= 0;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Edit product</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-white/70">Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/70">Price (₦)</Label>
              <Input
                type="number"
                min="1"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Stock</Label>
              <Input
                type="number"
                min="0"
                value={form.stockQuantity}
                onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/70">Category</Label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full h-10 rounded-md bg-white/5 border border-white/10 text-white px-3 text-sm"
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-[#1a1a1a]">{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-white/70">Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-white/70">Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSave || mutation.isPending}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
