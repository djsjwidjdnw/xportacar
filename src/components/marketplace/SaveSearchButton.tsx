"use client";

import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { BookmarkPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { saveSearchAction } from "@/app/(buyer)/marketplace/actions";

const FILTER_KEYS = ["q", "make", "year", "price", "fuel", "body", "transmission", "sort"] as const;

export function SaveSearchButton({ isAuthenticated }: { isAuthenticated: boolean }) {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  // Active filter summary defines the default name.
  const filters = Object.fromEntries(
    FILTER_KEYS
      .map((k) => [k, params.get(k)] as const)
      .filter(([_, v]) => !!v && v !== "any" && v !== "ending_soon"),
  ) as Record<string, string>;
  const hasFilters = Object.keys(filters).length > 0;
  if (!hasFilters) return null;

  const defaultName = Object.values(filters).filter(Boolean).slice(0, 3).join(" · ");

  const save = () => {
    if (!isAuthenticated) {
      toast.err("Sign in required", "Sign in to save searches.");
      return;
    }
    const finalName = (name.trim() || defaultName).trim();
    startTransition(async () => {
      const res = await saveSearchAction({ name: finalName, filters });
      if (!res.ok) {
        toast.err("Couldn't save search", res.error);
        return;
      }
      toast.ok("Search saved", `"${finalName}" added to your dashboard.`);
      setOpen(false);
      setName("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm">
          <BookmarkPlus className="size-3.5" />
          Save this search
        </Button>
      } />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save this search</DialogTitle>
          <DialogDescription>
            Quick-jump back to the same filter set from your dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="block mb-1 text-xs font-medium text-grey-700">Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder={defaultName}
              className="h-11"
            />
          </label>
          <div className="rounded-lg border border-grey-200 bg-grey-50 p-3 text-xs text-grey-700">
            <p className="mb-1 font-semibold uppercase text-[10px] tracking-wide text-grey-500">Active filters</p>
            {Object.entries(filters).map(([k, v]) => (
              <p key={k}>
                <span className="text-grey-500">{k}:</span>{" "}
                <span className="font-medium">{v}</span>
              </p>
            ))}
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={save} disabled={isPending}>
            {isPending ? "Saving…" : "Save search"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
