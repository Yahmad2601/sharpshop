import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Trader } from "@shared/schema";
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

interface ProfileEditModalProps {
  trader: Trader | undefined;
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileEditModal({ trader, isOpen, onClose }: ProfileEditModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ businessName: "", whatsappNumber: "", address: "", bio: "" });

  useEffect(() => {
    if (trader) {
      setForm({
        businessName: trader.businessName ?? "",
        whatsappNumber: trader.whatsappNumber ?? "",
        address: trader.address ?? "",
        bio: trader.bio ?? "",
      });
    }
  }, [trader]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/trader/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trader/me"] });
      if (trader?.id) queryClient.invalidateQueries({ queryKey: ["/api/traders", trader.id] });
      toast({ title: "Profile updated" });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-white/70">Business name</Label>
            <Input
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70">WhatsApp number</Label>
            <Input
              value={form.whatsappNumber}
              onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
              placeholder="+234..."
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70">Address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70">Bio</Label>
            <Input
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-white/70">Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.businessName.trim() || mutation.isPending}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
