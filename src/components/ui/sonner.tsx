import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Dark ink toasts on cream (and cream on dark), with an outlined "Ongedaan maken".
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:min-h-[52px] group-[.toaster]:rounded-[14px] group-[.toaster]:border-0 group-[.toaster]:bg-foreground group-[.toaster]:px-3.5 group-[.toaster]:py-3 group-[.toaster]:font-body group-[.toaster]:text-sm group-[.toaster]:text-background group-[.toaster]:shadow-soft",
          description: "group-[.toast]:text-background/70",
          actionButton:
            "group-[.toast]:!min-h-9 group-[.toast]:!rounded-[10px] group-[.toast]:!border group-[.toast]:!border-background/35 group-[.toast]:!bg-transparent group-[.toast]:!px-3 group-[.toast]:!text-[0.8125rem] group-[.toast]:!font-semibold group-[.toast]:!text-background",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
