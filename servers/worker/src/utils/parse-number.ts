export function parseNumber(value?: string | number | undefined) {
  if (value) {
    if (typeof value === "number") return value;
    return parseFloat(value);
  }

  return 0;
}
