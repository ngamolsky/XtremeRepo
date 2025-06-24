import * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

interface FloatingActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ComponentType<{ className?: string }>;
  label?: string;
  variant?: "primary" | "secondary";
}

const FloatingActionButton = React.forwardRef<
  HTMLButtonElement,
  FloatingActionButtonProps
>(({ className, icon: Icon, label, variant = "primary", ...props }, ref) => {
  return (
    <Button
      ref={ref}
      className={cn(
        "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl",
        variant === "primary" && 
          "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "secondary" && 
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        className
      )}
      size="icon"
      {...props}
    >
      <Icon className="h-6 w-6" />
      {label && (
        <span className="sr-only">{label}</span>
      )}
    </Button>
  );
});

FloatingActionButton.displayName = "FloatingActionButton";

export { FloatingActionButton };