import {
  ChevronDownIcon,
  GitCommitHorizontalIcon,
  GitPullRequestCreateIcon,
  UploadIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { appTargets } from "./model";
import type { AppTarget, AppTargetId } from "./model";

interface ConversationHeaderActionsProps {
  isGitBusy: boolean;
  isOpenTargetBusy: boolean;
  onOpenCommitDialog: () => void;
  onPush: () => Promise<void>;
  onSelectOpenTarget: (appId: AppTargetId) => Promise<void>;
  openTargets: ReadonlyArray<AppTarget>;
  preferredAppId: AppTargetId;
}

export function ConversationHeaderActions({
  isGitBusy,
  isOpenTargetBusy,
  onOpenCommitDialog,
  onPush,
  onSelectOpenTarget,
  openTargets,
  preferredAppId,
}: ConversationHeaderActionsProps) {
  const preferredApp =
    openTargets.find((target) => target.id === preferredAppId) ??
    openTargets[0] ??
    appTargets[0];
  const PreferredAppIcon = preferredApp?.icon;

  return (
    <div className="relative z-20 ml-auto flex shrink-0 items-center gap-1.5">
      <ButtonGroup aria-label="Open with">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={
            preferredApp == null
              ? "Open in app"
              : `Open in ${preferredApp.label}`
          }
          disabled={openTargets.length === 0 || isOpenTargetBusy}
          onClick={() => {
            if (openTargets.length === 0 || preferredApp == null) {
              return;
            }

            void onSelectOpenTarget(preferredApp.id);
          }}
        >
          {PreferredAppIcon ? <PreferredAppIcon /> : null}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Choose app"
                disabled={openTargets.length === 0 || isOpenTargetBusy}
              />
            }
          >
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              {openTargets.length > 0 ? (
                openTargets.map(({ id, label, icon: Icon }) => (
                  <DropdownMenuItem
                    key={id}
                    disabled={isOpenTargetBusy}
                    onClick={() => {
                      void onSelectOpenTarget(id);
                    }}
                  >
                    <Icon />
                    {label}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>
                  No installed apps found
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>

      <ButtonGroup aria-label="Git actions">
        <Button
          variant="outline"
          size="sm"
          disabled={isGitBusy}
          onClick={onOpenCommitDialog}
        >
          <GitCommitHorizontalIcon data-icon="inline-start" />
          Commit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="More git actions"
                disabled={isGitBusy}
              />
            }
          >
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Git actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onOpenCommitDialog}
                disabled={isGitBusy}
              >
                <GitCommitHorizontalIcon />
                Commit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  void onPush();
                }}
                disabled={isGitBusy}
              >
                <UploadIcon />
                Push
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <GitPullRequestCreateIcon />
                Create PR
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    </div>
  );
}
