export interface ActivityResultFooter {
  leading: string;
  trailing: string;
}

interface ActivityResultBase {
  copyText: string;
  footer: ActivityResultFooter;
}

export type ActivityResultModel =
  | (ActivityResultBase & {
      kind: "shell";
      text: string;
      title: "Shell";
    })
  | (ActivityResultBase & {
      kind: "file_diff";
      patch: string;
      title: "Diff";
    })
  | (ActivityResultBase & {
      kind: "text";
      text: string;
      title: "Output";
    });
