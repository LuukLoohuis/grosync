import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Dark ink toasts on cream (and cream on dark), with an outlined "Ongedaan maken".
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      // Opzij en omlaag wegvegen; standaard mag bij bottom-center alleen omlaag.
      swipeDirections={["left", "right", "bottom"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          // Met ! omdat Sonners eigen CSS buiten de Tailwind-lagen staat en anders wint (witte toast, onleesbare knop).
          toast:
            "group toast min-h-[52px]! rounded-[14px]! border-0! bg-foreground! px-3.5! py-3! font-body! text-sm! text-background! shadow-soft!",
          description: "text-background/70!",
          actionButton:
            "group-[.toast]:min-h-9! group-[.toast]:rounded-[10px]! group-[.toast]:border! group-[.toast]:border-background/35! group-[.toast]:bg-transparent! group-[.toast]:px-3! group-[.toast]:text-[0.8125rem]! group-[.toast]:font-semibold! group-[.toast]:text-background!",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
