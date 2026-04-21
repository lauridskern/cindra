import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface CommitChangesDialogProps {
  commitMessage: string;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onCommitMessageChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => Promise<void>;
}

export function CommitChangesDialog({
  commitMessage,
  isOpen,
  isSubmitting,
  onClose,
  onCommitMessageChange,
  onOpenChange,
  onSubmit,
}: CommitChangesDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen || isSubmitting) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isOpen, isSubmitting]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle>Commit changes</DialogTitle>
            <DialogDescription>
              Create a git commit for the current workspace.
            </DialogDescription>
          </DialogHeader>
          <Input
            ref={inputRef}
            value={commitMessage}
            onChange={(event) => {
              onCommitMessageChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isSubmitting) {
                void onSubmit();
              }
            }}
            placeholder="Commit message"
            disabled={isSubmitting}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void onSubmit();
              }}
              disabled={isSubmitting || commitMessage.trim().length === 0}
            >
              Commit
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
