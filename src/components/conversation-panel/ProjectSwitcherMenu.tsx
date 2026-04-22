import { ChevronDownIcon, FolderIcon, MinusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NO_PROJECT_VALUE = "__no_project__";

export interface ProjectSwitchOption {
  label: string;
  workspacePath: string;
}

interface ProjectSwitcherMenuProps {
  currentProjectLabel: string;
  isBusy: boolean;
  projects: readonly ProjectSwitchOption[];
  selectedProjectPath: string | null;
  onSelectProject: (workspacePath: string | null) => Promise<void>;
}

export function ProjectSwitcherMenu({
  currentProjectLabel,
  isBusy,
  projects,
  selectedProjectPath,
  onSelectProject,
}: ProjectSwitcherMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            aria-label="Choose project"
            disabled={isBusy}
            className="-ml-2 h-auto min-h-0 gap-1 rounded-sm px-1.5 py-0.5 text-xs leading-none font-medium text-neutral-800 hover:text-foreground dark:text-neutral-100 dark:hover:text-neutral-100"
          />
        }
      >
        <span className="truncate">{currentProjectLabel}</span>
        <ChevronDownIcon strokeWidth={2} className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Project</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={selectedProjectPath ?? NO_PROJECT_VALUE}
          onValueChange={(value) => {
            void onSelectProject(
              value === NO_PROJECT_VALUE ? null : value,
            );
          }}
        >
          <DropdownMenuRadioItem value={NO_PROJECT_VALUE} disabled={isBusy}>
            <MinusIcon />
            No project
          </DropdownMenuRadioItem>

          {projects.map((project) => (
            <DropdownMenuRadioItem
              key={project.workspacePath}
              value={project.workspacePath}
              disabled={isBusy}
            >
              <FolderIcon />
              {project.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
