'use client';

interface SpeedGaugeProps {
  value: number; // Mbps
  max?: number;
  label: string;
  phase?: 'idle' | 'ping' | 'download' | 'upload' | 'done';
}

export function SpeedGauge({ value, max = 100, label, phase = 'idle' }: SpeedGaugeProps) {
  const radius = 90;
  const strokeWidth = 12;
  const center = 110;
  // Arc from 135deg to 405deg (270deg sweep)
  const startAngle = 135;
  const endAngle = 405;
  const sweep = endAngle - startAngle;

  const circumference = (sweep / 360) * 2 * Math.PI * radius;
  const clamped = Math.min(value, max);
  const progress = max > 0 ? clamped / max : 0;
  const offset = circumference * (1 - progress);

  // Convert angle to SVG arc coordinates
  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const largeArc = sweep > 180 ? 1 : 0;

  const bgPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;

  // Color based on phase
  const strokeColor =
    phase === 'download'
      ? 'hsl(142, 76%, 36%)'
      : phase === 'upload'
        ? 'hsl(217, 91%, 60%)'
        : phase === 'ping'
          ? 'hsl(45, 93%, 47%)'
          : phase === 'done'
            ? 'hsl(142, 76%, 36%)'
            : 'hsl(215, 20%, 50%)';

  const isAnimating = phase === 'ping' || phase === 'download' || phase === 'upload';

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="180" viewBox="0 0 220 180">
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="hsl(215, 20%, 20%)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={bgPath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={isAnimating ? 'transition-all duration-500' : 'transition-all duration-300'}
        />
        {/* Value text */}
        <text
          x={center}
          y={center - 10}
          textAnchor="middle"
          className="fill-foreground"
          fontSize="36"
          fontWeight="bold"
        >
          {value > 0 ? value.toFixed(1) : '—'}
        </text>
        <text
          x={center}
          y={center + 15}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="14"
        >
          Mbps
        </text>
        <text
          x={center}
          y={center + 35}
          textAnchor="middle"
          fontSize="12"
          fill={strokeColor}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
