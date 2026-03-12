import { useNetworkTime } from "@/hooks/useNetworkTime";
import { motion } from "framer-motion";

const CITIES = [
  { name: "London", tz: "Europe/London", flag: "🇬🇧" },
  { name: "Tokyo", tz: "Asia/Tokyo", flag: "🇯🇵" },
  { name: "Dubai", tz: "Asia/Dubai", flag: "🇦🇪" },
  { name: "Sydney", tz: "Australia/Sydney", flag: "🇦🇺" },
];

function CityTime({ name, tz, flag, epoch }: { name: string; tz: string; flag: string; epoch: number }) {
  const date = new Date(epoch);
  const time = date.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  
  const offsetHours = new Date(date.toLocaleString("en-US", { timeZone: tz })).getHours() - date.getUTCHours();
  const offsetStr = offsetHours >= 0 ? `+${offsetHours}` : `${offsetHours}`;

  return (
    <div className="glass-panel p-4 flex flex-col items-center gap-2">
      <span className="text-lg">{flag}</span>
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{name}</span>
      <span className="font-mono text-xl font-semibold text-foreground">{time}</span>
      <span className="text-xs font-mono text-muted-foreground">UTC{offsetStr}</span>
    </div>
  );
}

export function RegionalClocks() {
  const { epoch } = useNetworkTime();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
    >
      {CITIES.map((city) => (
        <CityTime key={city.name} {...city} epoch={epoch} />
      ))}
    </motion.div>
  );
}
