export function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}
