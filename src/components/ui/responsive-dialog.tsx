import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface ResponsiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface ResponsiveDialogContentProps {
  children: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

interface ResponsiveDialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

// Context to share mobile state
const ResponsiveDialogContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
});

const useResponsiveDialogContext = () => React.useContext(ResponsiveDialogContext);

/**
 * ResponsiveDialog - Automatically switches between Dialog (desktop) and Sheet (mobile)
 * Use this for better mobile UX in modals.
 */
const ResponsiveDialog: React.FC<ResponsiveDialogProps> = ({
  open,
  onOpenChange,
  children,
}) => {
  const isMobile = useIsMobile();

  return (
    <ResponsiveDialogContext.Provider value={{ isMobile }}>
      {isMobile ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          {children}
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      )}
    </ResponsiveDialogContext.Provider>
  );
};

const ResponsiveDialogTrigger: React.FC<ResponsiveDialogTriggerProps> = ({
  children,
  asChild,
}) => {
  const { isMobile } = useResponsiveDialogContext();

  if (isMobile) {
    return <SheetTrigger asChild={asChild}>{children}</SheetTrigger>;
  }
  return <DialogTrigger asChild={asChild}>{children}</DialogTrigger>;
};

const ResponsiveDialogContent: React.FC<ResponsiveDialogContentProps> = ({
  children,
  className,
  side = "bottom",
}) => {
  const { isMobile } = useResponsiveDialogContext();

  if (isMobile) {
    return (
      <SheetContent side={side} className={className}>
        {children}
      </SheetContent>
    );
  }
  return <DialogContent className={className}>{children}</DialogContent>;
};

const ResponsiveDialogHeader: React.FC<ResponsiveDialogHeaderProps> = ({
  children,
  className,
}) => {
  const { isMobile } = useResponsiveDialogContext();

  if (isMobile) {
    return <SheetHeader className={className}>{children}</SheetHeader>;
  }
  return <DialogHeader className={className}>{children}</DialogHeader>;
};

const ResponsiveDialogTitle: React.FC<ResponsiveDialogTitleProps> = ({
  children,
  className,
}) => {
  const { isMobile } = useResponsiveDialogContext();

  if (isMobile) {
    return <SheetTitle className={className}>{children}</SheetTitle>;
  }
  return <DialogTitle className={className}>{children}</DialogTitle>;
};

const ResponsiveDialogDescription: React.FC<ResponsiveDialogDescriptionProps> = ({
  children,
  className,
}) => {
  const { isMobile } = useResponsiveDialogContext();

  if (isMobile) {
    return <SheetDescription className={className}>{children}</SheetDescription>;
  }
  return <DialogDescription className={className}>{children}</DialogDescription>;
};

const ResponsiveDialogFooter: React.FC<ResponsiveDialogFooterProps> = ({
  children,
  className,
}) => {
  const { isMobile } = useResponsiveDialogContext();

  if (isMobile) {
    return <SheetFooter className={className}>{children}</SheetFooter>;
  }
  return <DialogFooter className={className}>{children}</DialogFooter>;
};

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
};
