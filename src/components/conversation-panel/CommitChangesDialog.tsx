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
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Commit changes</DialogTitle>
            <DialogDescription>
              Create a git commit for the current workspace.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={commitMessage}
            onChange={(event) => {
              onCommitMessageChange(event.target.value);
            }}
            placeholder="Commit message"
            disabled={isSubmitting}
            autoFocus
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
              type="submit"
              disabled={isSubmitting || commitMessage.trim().length === 0}
            >
              Commit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
