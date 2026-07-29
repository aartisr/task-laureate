interface StatusPillProps {
  value: string;
}

export function StatusPill({ value }: StatusPillProps) {
  return <span className="status-pill">{value}</span>;
}
