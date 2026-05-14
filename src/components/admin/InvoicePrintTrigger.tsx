"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvoicePrintTrigger() {
  return (
    <Button onClick={() => window.print()} variant="default" size="sm">
      <Printer className="size-4" /> Print / save as PDF
    </Button>
  );
}
