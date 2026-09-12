import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-xl border-[1.5px] border-input bg-card px-3.5 py-3 text-base text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-[#8A9287] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/15 aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:bg-background disabled:text-muted-foreground sm:text-[0.9375rem] dark:placeholder:text-muted-foreground",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
