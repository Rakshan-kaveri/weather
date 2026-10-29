const STYLES: Record<string, string> = {
  QUEUED: "bg-fg-faint/15 text-fg-muted",
  SENT: "bg-accent/15 text-accent",
  DELIVERED: "bg-good/15 text-good",
  OPENED: "bg-good/25 text-good",
  BOUNCED: "bg-bad/15 text-bad",
  FAILED: "bg-bad/15 text-bad",
  SKIPPED: "bg-warn/15 text-warn",
  MISSED: "bg-warn/15 text-warn",
  ACTIVE: "bg-good/15 text-good",
  PAUSED: "bg-fg-faint/15 text-fg-muted",
  BLOCKED: "bg-bad/15 text-bad",
  ADMIN: "bg-accent/15 text-accent",
};

export function StatusBadge({ status, title }: { status: string; title?: string }) {
  return (
    <span className={`chip ${STYLES[status] ?? STYLES.QUEUED}`} title={title}>
      {status.toLowerCase()}
    </span>
  );
}
