export function PreviewPanel({ port }: { port: number }) {
  return (
    <div className="rounded-px border border-px-border bg-px-surface p-3 text-xs font-mono text-px-fg-muted">
      Preview :{port}
    </div>
  );
}
