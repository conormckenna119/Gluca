const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Short, calm relative time: "just now", "12 min ago", "3 h ago", "yesterday", "4 days ago", then "12 Nov". */
export function relativeTime(then: number, now: number): string {
  const diff = now - then;
  if (!Number.isFinite(diff) || diff < MIN) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
  const days = Math.floor(diff / DAY);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const d = new Date(then);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return `${d.getDate()} ${months[d.getMonth()]}${sameYear ? "" : ` ${d.getFullYear()}`}`;
}
