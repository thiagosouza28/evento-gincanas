import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast alert show group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:bg-surface group-[.toaster]:text-foreground group-[.toaster]:shadow-[var(--shadow)]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:btn group-[.toast]:btn-sm group-[.toast]:btn-primary",
          cancelButton: "group-[.toast]:btn group-[.toast]:btn-sm group-[.toast]:btn-ghost",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
