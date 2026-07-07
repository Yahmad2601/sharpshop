import { useState, useEffect } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface BuyerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Normalize a Nigerian number to international format (+234…) — mirrors AuthModal.
function normalizeNgPhone(raw: string): string {
  let n = raw.replace(/[\s-]/g, "");
  if (!n) return n;
  if (n.startsWith("0")) n = "+234" + n.slice(1);
  if (!n.startsWith("+")) n = "+" + n;
  return n;
}

export function BuyerDetailsModal({ isOpen, onClose }: BuyerDetailsModalProps) {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ fullName: "", phone: "", address: "" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName ?? "",
        phone: user.phone ?? "",
        address: user.address ?? "",
      });
    }
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        fullName: form.fullName.trim() || undefined,
        phone: form.phone.trim() ? normalizeNgPhone(form.phone) : undefined,
        address: form.address.trim() || undefined,
      });
      toast({ title: "Details saved", description: "We'll use these to speed up checkout." });
      onClose();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Delivery details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-white/70">Full name</Label>
            <Input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70">Phone number</Label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g., 08012345678"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70">Delivery address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Where should orders be delivered?"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-white/70">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
