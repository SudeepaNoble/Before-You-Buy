import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
};

const variants = {
  primary:
    "bg-[#176b72] text-white shadow-[0_12px_32px_rgba(23,107,114,.18)] hover:bg-[#125960]",
  outline:
    "border border-[#c9dedd] bg-white/80 text-[#24585b] hover:border-[#76adaf] hover:bg-white",
  ghost: "text-[#526b6c] hover:bg-white/70 hover:text-[#24585b]",
};

const sizes = {
  default: "h-11 px-5",
  sm: "h-9 px-3.5 text-sm",
  lg: "h-14 px-6 text-base",
};

export function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#277c83] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
