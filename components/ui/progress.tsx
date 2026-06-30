import { cn } from "@/lib/utils";

export function Progress({
  indicatorColor,
  value,
  className,
}: {
  indicatorColor?: string;
  value: number;
  className?: string;
}) {
  return (
    <div
      aria-label={`${value} out of 100`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={value}
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-full bg-[#edeaf0]",
        className,
      )}
      role="progressbar"
    >
      <div
        className="h-full rounded-full bg-current transition-[width] duration-700 ease-out"
        style={{ color: indicatorColor, width: `${value}%` }}
      />
    </div>
  );
}
