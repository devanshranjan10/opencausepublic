"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CryptoIcon } from "./crypto-icon";

export interface CryptoSelectOption {
  key: string;
  symbol: string;
  name: string;
  blockchain?: string;
  decimals?: number;
  coingeckoId?: string;
}

export interface CryptoSelectProps {
  value?: string;
  onChange?: (key: string, option: CryptoSelectOption) => void;
  options: CryptoSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const CryptoSelect = React.forwardRef<HTMLDivElement, CryptoSelectProps>(
  ({ value, onChange, options, placeholder = "Select cryptocurrency...", className, disabled }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const selectedOption = React.useMemo(
      () => options.find((opt) => opt.key === value) || null,
      [value, options]
    );
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0, width: 0 });
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
    }, []);

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
          setSearchQuery("");
        }
      };

      if (isOpen) {
        updatePosition();
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        
        setTimeout(() => {
          document.addEventListener("mousedown", handleClickOutside);
          searchInputRef.current?.focus();
        }, 0);
        
        return () => {
          window.removeEventListener("scroll", updatePosition, true);
          window.removeEventListener("resize", updatePosition);
          document.removeEventListener("mousedown", handleClickOutside);
        };
      } else {
        setSearchQuery("");
      }
    }, [isOpen]);

    const filteredOptions = React.useMemo(() => {
      if (!searchQuery.trim()) return options;
      const query = searchQuery.toLowerCase();
      return options.filter(
        (opt) =>
          opt.symbol.toLowerCase().includes(query) ||
          opt.name.toLowerCase().includes(query) ||
          opt.blockchain?.toLowerCase().includes(query) ||
          opt.key.toLowerCase().includes(query)
      );
    }, [options, searchQuery]);

    const handleSelect = (option: CryptoSelectOption) => {
      onChange?.(option.key, option);
      setIsOpen(false);
      setSearchQuery("");
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
              width: `${Math.max(dropdownPosition.width, 300)}px`,
              zIndex: 99999,
            }}
            className="rounded-xl border border-white/20 bg-gradient-to-b from-black/98 to-black/95 backdrop-blur-xl shadow-2xl ring-1 ring-white/10"
          >
            {/* Search Input */}
            <div className="p-2 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cryptocurrency..."
                  className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>
            </div>

            {/* Options List */}
            <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-8 text-center text-white/50 text-sm">
                  No cryptocurrencies found
                </div>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = selectedOption?.key === option.key;
                  return (
                    <motion.button
                      key={option.key}
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => handleSelect(option)}
                      className={cn(
                        "relative flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition-all duration-150",
                        "hover:bg-white/10 hover:text-white active:bg-white/15",
                        isSelected && "bg-gradient-to-r from-blue-500/20 to-blue-600/10 text-blue-400 font-medium shadow-sm shadow-blue-500/20"
                      )}
                    >
                      <CryptoIcon symbol={option.symbol} size={24} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{option.symbol}</span>
                          {option.blockchain && (
                            <span className="text-xs text-white/50 truncate">({option.blockchain})</span>
                          )}
                        </div>
                        <div className="text-xs text-white/60 truncate mt-0.5">{option.name}</div>
                      </div>
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
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );

    return (
      <div className={cn("relative w-full", className)} ref={ref}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "flex h-12 w-full items-center justify-between gap-3 rounded-xl border bg-white/5 px-4 py-3 text-left text-sm text-white transition-all duration-200",
            "border-white/20 hover:border-white/40 hover:bg-white/10",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/20 disabled:hover:bg-white/5",
            isOpen && "border-blue-500/50 bg-white/10 ring-2 ring-blue-500/20"
          )}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {selectedOption ? (
              <>
                <CryptoIcon symbol={selectedOption.symbol} size={20} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{selectedOption.symbol}</div>
                  {selectedOption.blockchain && (
                    <div className="text-xs text-white/50 truncate">{selectedOption.blockchain}</div>
                  )}
                </div>
              </>
            ) : (
              <span className="text-white/50 truncate">{placeholder}</span>
            )}
          </div>
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
CryptoSelect.displayName = "CryptoSelect";
