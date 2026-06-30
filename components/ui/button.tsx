import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
};

const variants = {
  primary:
    "bg-[#292334] text-white shadow-[0_12px_32px_rgba(41,35,52,.18)] hover:bg-[#3a3147]",
  outline:
    "border border-[#ded9e5] bg-white/80 text-[#292334] hover:border-[#b9afc7] hover:bg-white",
  ghost: "text-[#61586d] hover:bg-white/70 hover:text-[#292334]",
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
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a5c9e] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
