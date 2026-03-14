import { useNetworkTime } from "@/hooks/useNetworkTime";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const ALL_CITIES = [
  { name: "London", tz: "Europe/London", flag: "🇬🇧", utcOffset: 0 },
  { name: "Tokyo", tz: "Asia/Tokyo", flag: "🇯🇵", utcOffset: 9 },
  { name: "Dubai", tz: "Asia/Dubai", flag: "🇦🇪", utcOffset: 4 },
  { name: "Sydney", tz: "Australia/Sydney", flag: "🇦🇺", utcOffset: 11 },
  { name: "New York", tz: "America/New_York", flag: "🇺🇸", utcOffset: -5 },
  { name: "Los Angeles", tz: "America/Los_Angeles", flag: "🇺🇸", utcOffset: -8 },
  { name: "Singapore", tz: "Asia/Singapore", flag: "🇸🇬", utcOffset: 8 },
  { name: "Berlin", tz: "Europe/Berlin", flag: "🇩🇪", utcOffset: 1 },
  { name: "São Paulo", tz: "America/Sao_Paulo", flag: "🇧🇷", utcOffset: -3 },
  { name: "Mumbai", tz: "Asia/Kolkata", flag: "🇮🇳", utcOffset: 5.5 },
  { name: "Hong Kong", tz: "Asia/Hong_Kong", flag: "🇭🇰", utcOffset: 8 },
  { name: "Nairobi", tz: "Africa/Nairobi", flag: "🇰🇪", utcOffset: 3 },
];

const CITIES_PER_PAGE = 4;

function formatOffset(offset: number): string {
  if (Number.isInteger(offset)) {
    return offset >= 0 ? `+${offset}` : `${offset}`;
  }
  const hours = Math.floor(Math.abs(offset));
  const mins = (Math.abs(offset) - hours) * 60;
  const sign = offset >= 0 ? "+" : "-";
  return `${sign}${hours}:${mins.toString().padStart(2, "0")}`;
}

function CityTime({ name, utcOffset, flag, epoch }: { name: string; utcOffset: number; flag: string; epoch: number }) {
  const utcMs = epoch;
  const localMs = utcMs + utcOffset * 3600000;
  const date = new Date(localMs);
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const seconds = date.getUTCSeconds().toString().padStart(2, "0");

  return (
    <div className="glass-panel p-3 flex flex-col items-center gap-1.5">
      <span className="text-base">{flag}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{name}</span>
      <span className="font-mono text-lg font-semibold text-foreground">{hours}:{minutes}:{seconds}</span>
      <span className="text-[10px] font-mono text-muted-foreground">UTC{formatOffset(utcOffset)}</span>
    </div>
  );
}

export function RegionalClocks() {
  const { epoch } = useNetworkTime();
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(ALL_CITIES.length / CITIES_PER_PAGE);

  const visibleCities = ALL_CITIES.slice(page * CITIES_PER_PAGE, (page + 1) * CITIES_PER_PAGE);

  const prev = () => setPage((p) => (p - 1 + totalPages) % totalPages);
  const next = () => setPage((p) => (p + 1) % totalPages);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="flex items-center gap-2"
    >
      <button
        onClick={prev}
        className="shrink-0 p-1.5 rounded-md glass-panel text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Previous time zones"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1 min-w-0">
        {visibleCities.map((city) => (
          <CityTime key={city.name} {...city} epoch={epoch} />
        ))}
      </div>

      <button
        onClick={next}
        className="shrink-0 p-1.5 rounded-md glass-panel text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Next time zones"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </motion.div>
  );
}
