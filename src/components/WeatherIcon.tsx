import { describe } from "@/lib/codes";

/** Hand-drawn SVG weather glyphs (no icon fonts, no emoji). */
export function WeatherIcon({ code, isDay = true, size = 40 }: { code: number; isDay?: boolean; size?: number }) {
  const kind = describe(code).icon;
  const sun = (
    <g>
      <circle cx="24" cy="24" r="8" fill="#FFC94A" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1="24"
          y1="10"
          x2="24"
          y2="6"
          stroke="#FFC94A"
          strokeWidth="2.5"
          strokeLinecap="round"
          transform={`rotate(${a} 24 24)`}
        />
      ))}
    </g>
  );
  const moon = <path d="M30 12a11 11 0 1 0 8 17 9 9 0 0 1-8-17Z" fill="#C9D6F2" />;
  const cloud = (fill = "#DCE4F2", dx = 0, dy = 0) => (
    <path
      transform={`translate(${dx} ${dy})`}
      d="M15 36a7 7 0 0 1-.6-14 9.5 9.5 0 0 1 18.2 2.3A6 6 0 0 1 33 36H15Z"
      fill={fill}
    />
  );
  const drops = (n: number, color = "#5AB0FF") =>
    Array.from({ length: n }).map((_, i) => (
      <line key={i} x1={17 + i * 6} y1={40} x2={15 + i * 6} y2={45} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    ));

  let content: React.ReactNode;
  switch (kind) {
    case "clear":
      content = isDay ? sun : moon;
      break;
    case "partly":
      content = (
        <>
          <g transform="translate(-6 -6) scale(0.85)">{isDay ? sun : moon}</g>
          {cloud("#E6ECF6", 4, 2)}
        </>
      );
      break;
    case "cloudy":
      content = (
        <>
          {cloud("#9AA8C0", 6, -4)}
          {cloud("#DCE4F2")}
        </>
      );
      break;
    case "fog":
      content = (
        <>
          {cloud("#B9C4D8", 0, -4)}
          {[36, 41, 46].map((y) => (
            <line key={y} x1="10" y1={y} x2="38" y2={y} stroke="#9AA8C0" strokeWidth="2.5" strokeLinecap="round" />
          ))}
        </>
      );
      break;
    case "drizzle":
      content = (
        <>
          {cloud("#C9D3E4", 0, -4)}
          {drops(3, "#7FC2FF")}
        </>
      );
      break;
    case "rain":
      content = (
        <>
          {cloud("#B4C0D6", 0, -4)}
          {drops(4)}
        </>
      );
      break;
    case "heavy-rain":
      content = (
        <>
          {cloud("#8E9BB3", 0, -4)}
          {drops(4, "#3B8BFF")}
        </>
      );
      break;
    case "snow":
      content = (
        <>
          {cloud("#DCE4F2", 0, -4)}
          {[17, 24, 31].map((x) => (
            <circle key={x} cx={x} cy={42} r="2" fill="#FFFFFF" />
          ))}
        </>
      );
      break;
    case "storm":
      content = (
        <>
          {cloud("#7D8AA3", 0, -6)}
          <path d="M25 30 19 40h5l-3 8 9-11h-5l3-7h-3Z" fill="#FFD447" />
        </>
      );
      break;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={describe(code).label}>
      {content}
    </svg>
  );
}
