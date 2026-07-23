"use client";

import React, { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

interface TabsContextType {
  value: string;
  onValueChange: (val: string) => void;
}

const TabsContext = createContext<TabsContextType>({
  value: "",
  onValueChange: () => {},
});

export function Tabs({
  children,
  defaultValue,
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  className,
}: {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (val: string) => void;
  className?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;
  const onValueChange = (val: string) => {
    if (!isControlled) setInternalValue(val);
    controlledOnValueChange?.(val);
  };

  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900/90 p-1.5 text-slate-400 border border-slate-800/80 shadow-inner",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  children,
  value,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const { value: activeValue, onValueChange } = useContext(TabsContext);
  const active = activeValue === value;

  return (
    <button
      type="button"
      onClick={() => onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold ring-offset-slate-950 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50",
        active
          ? "bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-md"
          : "hover:bg-slate-800/60 hover:text-slate-200",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  children,
  value,
  className,
}: {
  children: React.ReactNode;
  value: string;
  className?: string;
}) {
  const { value: activeValue } = useContext(TabsContext);
  if (activeValue !== value) return null;

  return (
    <div
      className={cn("mt-4 ring-offset-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 animate-in fade-in duration-200", className)}
    >
      {children}
    </div>
  );
}
