import { motion } from "framer-motion";
import { Globe, Github } from "lucide-react";

export function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-border/50 backdrop-blur-xl sticky top-0 z-50"
      style={{ background: "hsl(var(--background) / 0.8)" }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-primary" />
          <span className="font-mono text-sm font-semibold tracking-wider text-foreground">
            DGTN
          </span>
          <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
            Decentralized Global Time Network
          </span>
        </div>
        <nav className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
          <a href="#dashboard" className="hover:text-foreground transition-colors">Dashboard</a>
          <a href="#api" className="hover:text-foreground transition-colors">API</a>
          <a href="#docs" className="hover:text-foreground transition-colors">Docs</a>
          <Github className="w-4 h-4 hover:text-foreground transition-colors cursor-pointer" />
        </nav>
      </div>
    </motion.header>
  );
}
