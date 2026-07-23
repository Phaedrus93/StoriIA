"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SheetContext = createContext<SheetContextType>({
  open: false,
  onOpenChange: () => {},
});

export function Sheet({
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const onOpenChange = (val: boolean) => {
    if (!isControlled) setInternalOpen(val);
    controlledOnOpenChange?.(val);
  };

  return (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

export function SheetTrigger({
  children,
  asChild,
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { onOpenChange } = useContext(SheetContext);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        children.props.onClick?.(e);
        onClick?.(e as any);
        onOpenChange(true);
      },
    });
  }
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        onClick?.(e);
        onOpenChange(true);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function SheetContent({
  children,
  side = "bottom",
  className,
}: {
  children: React.ReactNode;
  side?: "bottom" | "right" | "left" | "top";
  className?: string;
}) {
  const { open, onOpenChange } = useContext(SheetContext);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const sideClasses = {
    bottom:
      "inset-x-0 bottom-0 rounded-t-3xl max-h-[90vh] border-t border-slate-800 animate-in slide-in-from-bottom duration-300 pb-[env(safe-area-inset-bottom)]",
    right:
      "inset-y-0 right-0 h-full w-full max-w-sm border-l border-slate-800 animate-in slide-in-from-right duration-300",
    left: "inset-y-0 left-0 h-full w-full max-w-sm border-r border-slate-800 animate-in slide-in-from-left duration-300",
    top: "inset-x-0 top-0 rounded-b-3xl border-b border-slate-800 animate-in slide-in-from-top duration-300",
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={() => onOpenChange(false)}
      />

      {/* Content Panel */}
      <div
        className={cn(
          "relative z-50 bg-slate-900/95 backdrop-blur-2xl p-6 shadow-2xl overflow-y-auto",
          sideClasses[side],
          className
        )}
      >
        {/* Maniglia di trascinamento/scorrimento visiva per bottom sheet */}
        {side === "bottom" && (
          <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mb-5" />
        )}

        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 p-2 rounded-full bg-slate-800/60 text-slate-400 hover:text-white transition-colors"
          title="Chiudi pannello"
        >
          <X className="w-5 h-5" />
        </button>

        {children}
      </div>
    </div>
  );
}

export function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-2 text-left mb-4", className)}
      {...props}
    />
  );
}

export function SheetTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-bold text-white tracking-tight", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-slate-400", className)} {...props} />
  );
}

export function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:justify-end gap-2 mt-6",
        className
      )}
      {...props}
    />
  );
}

export function SheetClose({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { onOpenChange } = useContext(SheetContext);
  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        children.props.onClick?.(e);
        onOpenChange(false);
      },
    });
  }
  return (
    <button
      type="button"
      className={className}
      onClick={() => onOpenChange(false)}
    >
      {children}
    </button>
  );
}
