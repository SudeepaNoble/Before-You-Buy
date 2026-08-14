import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
};

const variants = {
  primary:
    "bg-[#173b57] text-white shadow-[0_12px_32px_rgba(23,59,87,.2)] hover:bg-[#24445f]",
  outline:
    "border border-[#c9d8df] bg-white/80 text-[#173b57] hover:border-[#7b9eb4] hover:bg-white",
  ghost: "text-[#294f6c] hover:bg-white/70 hover:text-[#173b57]",
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
