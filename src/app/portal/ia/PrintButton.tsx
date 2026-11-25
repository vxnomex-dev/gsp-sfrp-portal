"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-outline print:hidden">
      <Printer size={16} /> Print / save as PDF
    </button>
  );
}
