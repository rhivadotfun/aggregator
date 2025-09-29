type DecimalProps = {
  value: number;
  end?: string;
  leading?: string;
  cap?: number;
  compact?: boolean;
  hideSign?: boolean;
  showPositiveSign?: boolean;
  truncateStyle?: React.CSSProperties;
};
export default function Decimal({
  value,
  end,
  cap,
  leading,
  hideSign,
  truncateStyle,
  compact,
  showPositiveSign,
  ...props
}: DecimalProps & React.ComponentProps<"span">) {
  const intl = Intl.NumberFormat(
    "en",
    compact ? { compactDisplay: "short", notation: "compact" } : undefined,
  );
  const [number, mantissa] = value.toString().split(/\./);

  const sign = (
    <span>
      {value > -1 ? showPositiveSign && "+" : "-"}
      {leading}
    </span>
  );

  if (cap && value > cap)
    return (
      <span {...props}>
        &gt;
        {!hideSign && sign}
        {Math.abs(cap)}
        {end}
      </span>
    );
  else if (mantissa && Math.abs(value) < 1) {
    const truncate = mantissa.slice(1, mantissa.length - 3);

    return (
      <span {...props}>
        {!hideSign && sign}
        {intl.format(Math.abs(Number(number)))}.{mantissa.slice(0, 1)}
        {truncate.length > 0 && (
          <sub style={truncateStyle}>{truncate.length}</sub>
        )}
        {mantissa.slice(mantissa.length - 3)}
        {end}
      </span>
    );
  } else
    return (
      <span {...props}>
        {!hideSign && sign}
        {intl.format(Math.abs(value))}
        {end}
      </span>
    );
}
