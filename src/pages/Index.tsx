import { Header } from "@/components/Header";
import { GlobalClock } from "@/components/GlobalClock";
import { NetworkMap } from "@/components/NetworkMap";
import { NetworkStats } from "@/components/NetworkStats";
import { RegionalClocks } from "@/components/RegionalClocks";
import { BlockchainStatus } from "@/components/BlockchainStatus";
import { SyncIndicator } from "@/components/SyncIndicator";

const SUPPORT_EMAIL = "decentralizedtim3@gmail.com";

const Index = () => {
  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        {/* Hero Clock */}
        <GlobalClock />

        {/* Stats Row */}
        <NetworkStats />

        {/* Network Map */}
        <NetworkMap />

        {/* Regional Clocks */}
        <RegionalClocks />

        {/* Bottom Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          <BlockchainStatus />
          <SyncIndicator />
        </div>

        {/* Footer */}
        <footer className="text-center py-8 space-y-2">
          <p className="text-xs font-mono text-muted-foreground">
            DGTN Protocol v0.1.0 — Decentralized Time Infrastructure for the Internet
          </p>
          <p className="text-[10px] font-mono text-muted-foreground">
            Support:{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center py-1 text-primary hover:underline"
              aria-label="Email DGTN support"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Index;
