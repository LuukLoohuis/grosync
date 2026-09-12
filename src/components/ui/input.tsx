import * as React from "react";

import { cn } from "@/lib/utils";

// 16px text on phones: iOS Safari zooms in on inputs with smaller text.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-12 w-full rounded-xl border-[1.5px] border-input bg-card px-3.5 py-2 text-base text-foreground transition-[border-color,box-shadow] duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[#8A9287] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/15 aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:bg-background disabled:text-muted-foreground sm:text-[0.9375rem] dark:placeholder:text-muted-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
