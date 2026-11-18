"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { navLinks } from "@/lib/site";

export function NavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <ul className="hidden md:flex">
        {navLinks.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className={`block px-4 py-3.5 font-display text-[0.95rem] uppercase tracking-wide transition-colors ${
                isActive(l.href) ? "bg-gold text-gold-foreground" : "text-white hover:bg-white/10"
              }`}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="flex items-center gap-2 py-3 font-display uppercase tracking-wide text-white md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <X size={20} /> : <Menu size={20} />} Menu
      </button>
      {open && (
        <ul className="border-t border-white/10 pb-2 md:hidden">
          {navLinks.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2.5 font-display uppercase tracking-wide ${
                  isActive(l.href) ? "bg-gold text-gold-foreground" : "text-white"
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
