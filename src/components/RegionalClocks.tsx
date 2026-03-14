import { useNetworkTime } from "@/hooks/useNetworkTime";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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

function formatFullDate(epoch: number, utcOffset: number): string {
  const localMs = epoch + utcOffset * 3600000;
  const d = new Date(localMs);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${days[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

interface CityData {
  name: string;
  tz: string;
  flag: string;
  utcOffset: number;
}

function CityTime({ name, utcOffset, flag, epoch, onClick }: { name: string; utcOffset: number; flag: string; epoch: number; onClick: () => void }) {
  const localMs = epoch + utcOffset * 3600000;
  const date = new Date(localMs);
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const seconds = date.getUTCSeconds().toString().padStart(2, "0");

  return (
    <button
      onClick={onClick}
      className="glass-panel p-3 flex flex-col items-center gap-1.5 cursor-pointer hover:ring-1 hover:ring-primary/40 transition-all"
    >
      <span className="text-base">{flag}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{name}</span>
      <span className="font-mono text-lg font-semibold text-foreground">{hours}:{minutes}:{seconds}</span>
      <span className="text-[10px] font-mono text-muted-foreground">UTC{formatOffset(utcOffset)}</span>
    </button>
  );
}

function CityDetailOverlay({ city, epoch, onClose }: { city: CityData; epoch: number; onClose: () => void }) {
  const localMs = epoch + city.utcOffset * 3600000;
  const date = new Date(localMs);
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const seconds = date.getUTCSeconds().toString().padStart(2, "0");
  const ms = date.getUTCMilliseconds().toString().padStart(3, "0");
  const isPM = date.getUTCHours() >= 12;
  const h12 = date.getUTCHours() % 12 || 12;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="glass-panel p-8 max-w-md w-full relative flex flex-col items-center gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <span className="text-5xl">{city.flag}</span>
        <h2 className="text-xl font-semibold text-foreground">{city.name}</h2>
        <p className="text-sm text-muted-foreground">{city.tz}</p>

        <div className="text-center space-y-1">
          <span className="font-mono text-5xl font-bold text-foreground tracking-tight">
            {hours}:{minutes}:{seconds}
          </span>
          <p className="font-mono text-lg text-muted-foreground">.{ms}</p>
          <p className="text-sm text-muted-foreground">{h12}:{minutes} {isPM ? "PM" : "AM"}</p>
        </div>

        <p className="text-sm text-muted-foreground">{formatFullDate(epoch, city.utcOffset)}</p>

        <div className="grid grid-cols-2 gap-4 w-full text-center">
          <div className="glass-panel p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">UTC Offset</p>
            <p className="font-mono text-lg text-foreground">UTC{formatOffset(city.utcOffset)}</p>
          </div>
          <div className="glass-panel p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Epoch</p>
            <p className="font-mono text-lg text-foreground">{Math.floor(epoch / 1000)}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function RegionalClocks() {
  const { epoch } = useNetworkTime();
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);
  const totalPages = Math.ceil(ALL_CITIES.length / CITIES_PER_PAGE);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const visibleCities = ALL_CITIES.slice(page * CITIES_PER_PAGE, (page + 1) * CITIES_PER_PAGE);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDirection(1);
      setPage((p) => (p + 1) % totalPages);
    }, 3000);
  }, [totalPages]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const prev = () => {
    setDirection(-1);
    setPage((p) => (p - 1 + totalPages) % totalPages);
    resetTimer();
  };
  const next = () => {
    setDirection(1);
    setPage((p) => (p + 1) % totalPages);
    resetTimer();
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <button
          onClick={prev}
          className="shrink-0 p-1.5 rounded-md glass-panel text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Previous time zones"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0 overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={page}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="grid grid-cols-2 md:grid-cols-4 gap-2"
            >
              {visibleCities.map((city) => (
                <CityTime key={city.name} {...city} epoch={epoch} onClick={() => setSelectedCity(city)} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <button
          onClick={next}
          className="shrink-0 p-1.5 rounded-md glass-panel text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Next time zones"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => { setDirection(i > page ? 1 : -1); setPage(i); resetTimer(); }}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              i === page ? "bg-primary w-4" : "bg-muted-foreground/40 hover:bg-muted-foreground/60"
            }`}
            aria-label={`Go to page ${i + 1}`}
          />
        ))}
      </div>

      {/* City detail overlay */}
      <AnimatePresence>
        {selectedCity && (
          <CityDetailOverlay city={selectedCity} epoch={epoch} onClose={() => setSelectedCity(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
