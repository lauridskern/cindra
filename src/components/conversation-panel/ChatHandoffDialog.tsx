import { useEffect, useRef } from "react";

import type { ChatHandoffTarget } from "@/services/desktop/contracts";

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

interface ChatHandoffDialogProps {
  branchName: string;
  isOpen: boolean;
  isSubmitting: boolean;
  onBranchNameChange: (value: string) => void;
  onClose: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => Promise<void>;
  target: ChatHandoffTarget | null;
}

export function ChatHandoffDialog({
  branchName,
  isOpen,
  isSubmitting,
  onBranchNameChange,
  onClose,
  onOpenChange,
  onSubmit,
  target,
}: ChatHandoffDialogProps) {
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

  const title =
    target === "worktree" ? "Handoff chat to worktree" : "Handoff chat to local";
  const description =
    target === "worktree"
      ? "Create and check out a branch in a new worktree to continue working in parallel."
      : "Choose a branch name for the local checkout before continuing this chat there.";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Input
            ref={inputRef}
            value={branchName}
            onChange={(event) => {
              onBranchNameChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isSubmitting) {
                void onSubmit();
              }
            }}
            placeholder="feature/my-branch"
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
              disabled={isSubmitting || branchName.trim().length === 0}
            >
              Continue
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
