"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface DropdownSelectOption {
  value: string;
  label: string;
}

export interface DropdownSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options: DropdownSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export const DropdownSelect = React.forwardRef<HTMLDivElement, DropdownSelectProps>(
  ({ value, onChange, options, placeholder = "Select an option", className, disabled, id }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [selectedOption, setSelectedOption] = React.useState<DropdownSelectOption | null>(
      options.find((opt) => opt.value === value) || null
    );
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0, width: 0 });
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
    }, []);

    React.useEffect(() => {
      const option = options.find((opt) => opt.value === value);
      setSelectedOption(option || null);
    }, [value, options]);

    React.useEffect(() => {
      const updatePosition = () => {
        if (buttonRef.current && isOpen) {
          const rect = buttonRef.current.getBoundingClientRect();
          setDropdownPosition({
            top: rect.bottom + 8,
            left: rect.left,
            width: rect.width,
          });
        }
      };

      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current &&
          !buttonRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        // Calculate position when opening
        updatePosition();
        
        // Update on scroll/resize
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        
        // Use setTimeout to avoid immediate closure
        setTimeout(() => {
          document.addEventListener("mousedown", handleClickOutside);
        }, 0);
        
        return () => {
          window.removeEventListener("scroll", updatePosition, true);
          window.removeEventListener("resize", updatePosition);
          document.removeEventListener("mousedown", handleClickOutside);
        };
      }
    }, [isOpen]);

    const handleSelect = (option: DropdownSelectOption) => {
      setSelectedOption(option);
      onChange?.(option.value);
      setIsOpen(false);
    };

    const dropdownContent = (
      <AnimatePresence>
        {isOpen && mounted && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${Math.max(dropdownPosition.width, 200)}px`,
              zIndex: 99999,
            }}
            className="rounded-xl border border-white/20 bg-gradient-to-b from-black/98 to-black/95 backdrop-blur-xl shadow-2xl ring-1 ring-white/10"
          >
            <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
              {options.map((option, index) => {
                const isSelected = selectedOption?.value === option.value;
                return (
                  <motion.button
                    key={option.value}
                    type="button"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => handleSelect(option)}
                    className={cn(
                      "relative flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm transition-all duration-150",
                      "hover:bg-white/10 hover:text-white active:bg-white/15",
                      isSelected && "bg-gradient-to-r from-blue-500/20 to-blue-600/10 text-blue-400 font-medium shadow-sm shadow-blue-500/20"
                    )}
                  >
                    <span className="flex-1 truncate font-medium">{option.label}</span>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-2 flex-shrink-0"
                      >
                        <Check className="h-4 w-4 text-blue-400" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );

    return (
      <div className={cn("relative w-full", className)}>
        <button
          ref={buttonRef}
          id={id}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "flex h-12 w-full items-center justify-between rounded-xl border bg-white/5 px-4 py-3 text-left text-sm text-white transition-all duration-200",
            "border-white/20 hover:border-white/40 hover:bg-white/10",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/20 disabled:hover:bg-white/5",
            isOpen && "border-blue-500/50 bg-white/10 ring-2 ring-blue-500/20"
          )}
        >
          <span className={cn("truncate", !selectedOption && "text-white/50")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-white/60 transition-transform duration-200 flex-shrink-0",
              isOpen && "rotate-180 text-blue-400"
            )}
          />
        </button>

        {mounted && createPortal(dropdownContent, document.body)}
      </div>
    );
  }
);
DropdownSelect.displayName = "DropdownSelect";
