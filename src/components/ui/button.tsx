import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[0.9375rem] font-semibold ring-offset-background transition-[background-color,border-color,color,transform] duration-150 ease-smooth active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-deep disabled:bg-[#C7CDC4] disabled:text-[#6E756C] dark:hover:bg-primary/90 dark:disabled:bg-muted dark:disabled:text-muted-foreground",
        accent: "bg-accent text-accent-foreground hover:bg-[#D9661C] disabled:opacity-50 dark:hover:bg-accent/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50",
        outline: "border-[1.5px] border-border-strong bg-card text-foreground hover:bg-background disabled:opacity-50",
        secondary: "bg-accent text-accent-foreground hover:bg-[#D9661C] disabled:opacity-50 dark:hover:bg-accent/90",
        ghost: "text-primary hover:bg-primary-soft disabled:opacity-50",
        link: "text-primary underline-offset-4 hover:underline",
        ah: "bg-ah-basket text-white hover:bg-ah-basket/90 disabled:opacity-50",
      },
      size: {
        default: "min-h-11 px-[18px] py-2",
        sm: "min-h-11 px-3.5 text-[0.8125rem]",
        lg: "min-h-12 px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
