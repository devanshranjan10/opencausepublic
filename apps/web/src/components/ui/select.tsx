"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, placeholder, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            "flex h-11 w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white",
            "transition-all duration-200",
            "hover:bg-white/10 hover:border-white/30",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white/10",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "appearance-none pr-10 cursor-pointer",
            className
          )}
          ref={ref}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none transition-transform duration-200 group-hover:translate-y-[-2px]" />
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };

