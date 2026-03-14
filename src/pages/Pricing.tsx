import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { BackToDashboard } from "@/components/BackToDashboard";
import { useAuth } from "@/hooks/useAuth";
import { Check, Zap, Shield, Globe, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PLANS = [
  {
    name: "Free",
    tier: "free",
    price: "$0",
    period: "/month",
    description: "For developers exploring decentralized time",
    features: [
      "100,000 API requests/month",
      "Standard time endpoint",
      "12 oracle node consensus",
      "Community support",
      "Basic network status",
      "Public blockchain proofs",
    ],
    cta: "Get Started",
    highlighted: false,
    icon: Globe,
  },
  {
    name: "Pro",
    tier: "pro",
    price: "$99",
    period: "/month",
    description: "For teams building production applications",
    features: [
      "1,000,000 API requests/month",
      "All Free endpoints + analytics",
      "Priority node routing",
      "Email support (24h SLA)",
      "Webhook integrations",
      "Usage analytics dashboard",
    ],
    cta: "Start Pro Trial",
    highlighted: false,
    icon: Zap,
  },
  {
    name: "Enterprise",
    tier: "enterprise",
    price: "$2,499",
    period: "/month",
    description: "For institutions requiring ±5ms precision",
    features: [
      "Unlimited API requests",
      "±5ms precision time",
      "Trade ordering & sequencing",
      "MEV protection (commit-reveal)",
      "Tamper-proof event ledger",
      "Dedicated support + SLA",
      "Custom blockchain anchors",
      "Settlement proof certificates",
    ],
    cta: "Contact Sales",
    highlighted: true,
    icon: Shield,
  },
];

const COMPARISON = [
  { feature: "API Requests", free: "100K/mo", pro: "1M/mo", enterprise: "Unlimited" },
  { feature: "Time Accuracy", free: "±50ms", pro: "±20ms", enterprise: "±5ms" },
  { feature: "Consensus Nodes", free: "12", pro: "12", enterprise: "12 + Priority" },
  { feature: "Blockchain Proofs", free: "✓", pro: "✓", enterprise: "✓ + Custom" },
  { feature: "Trade Ordering", free: "—", pro: "—", enterprise: "✓" },
  { feature: "MEV Protection", free: "—", pro: "—", enterprise: "✓" },
  { feature: "Event Ledger", free: "—", pro: "—", enterprise: "✓" },
  { feature: "Webhooks", free: "—", pro: "✓", enterprise: "✓" },
  { feature: "Analytics", free: "Basic", pro: "Advanced", enterprise: "Full" },
  { feature: "Support", free: "Community", pro: "Email (24h)", enterprise: "Dedicated" },
  { feature: "Request Signing", free: "—", pro: "HMAC-SHA256", enterprise: "HMAC-SHA256" },
  { feature: "Response Fields", free: "Abstracted", pro: "Expanded", enterprise: "Full" },
  { feature: "Rate Limit", free: "10/min", pro: "60/min", enterprise: "300/min" },
];

export default function Pricing() {
  const { login, user, userId } = useAuth();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const email = (user as any)?.email?.address ?? null;

  const handleCheckout = async (tier: string) => {
    if (!user) {
      login();
      return;
    }

    if (tier === "free") {
      toast.info("You're already on the Free plan!");
      return;
    }

    if (tier === "enterprise") {
      // Enterprise = contact sales
      window.open("mailto:sales@dgtn.io?subject=Enterprise%20Plan%20Inquiry", "_blank");
      return;
    }

    setLoadingTier(tier);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          tier,
          email,
          userId,
          returnUrl: window.location.origin,
        },
      });

      if (error) throw error;

      if (data?.code === "STRIPE_NOT_CONFIGURED" || data?.code === "PRICE_NOT_CONFIGURED") {
        toast.info("Billing is being configured. We'll notify you when it's ready.");
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Failed to create checkout session");
      }
    } catch (e: any) {
      // Handle 503 gracefully — Stripe not yet configured
      if (e?.message?.includes("503") || e?.context?.status === 503) {
        toast.info("Billing is being configured. We'll notify you when it's ready.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-10">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-3xl md:text-4xl font-mono font-bold text-foreground mb-3">
            Pricing & Plans
          </h1>
          <p className="text-sm font-mono text-muted-foreground max-w-xl mx-auto">
            Choose the plan that fits your decentralized time infrastructure needs.
            All plans include access to our 12-node oracle consensus network.
          </p>
        </motion.div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`glass-panel p-6 flex flex-col relative ${
                plan.highlighted ? "border-primary/60 ring-1 ring-primary/30" : ""
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-mono font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}
              <plan.icon className="w-5 h-5 text-primary mb-3" />
              <h2 className="text-lg font-mono font-bold text-foreground">{plan.name}</h2>
              <div className="flex items-baseline gap-1 mt-2 mb-1">
                <span className="text-3xl font-mono font-bold neon-text-cyan">{plan.price}</span>
                <span className="text-xs font-mono text-muted-foreground">{plan.period}</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground mb-5">{plan.description}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs font-mono text-foreground">
                    <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout(plan.tier)}
                disabled={loadingTier === plan.tier}
                className={`flex items-center justify-center gap-2 w-full rounded-lg px-4 py-2.5 text-sm font-mono font-semibold transition-all disabled:opacity-50 ${
                  plan.highlighted
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
              >
                {loadingTier === plan.tier ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {plan.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Comparison Table */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-panel p-6 overflow-x-auto">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-6">Plan Comparison</h2>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 px-2">Feature</th>
                <th className="text-center py-2 px-2">Free</th>
                <th className="text-center py-2 px-2">Pro</th>
                <th className="text-center py-2 px-2 text-primary">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature} className="border-b border-border/30">
                  <td className="py-2.5 px-2 text-foreground">{row.feature}</td>
                  <td className="py-2.5 px-2 text-center text-muted-foreground">{row.free}</td>
                  <td className="py-2.5 px-2 text-center text-muted-foreground">{row.pro}</td>
                  <td className="py-2.5 px-2 text-center neon-text-cyan">{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* FAQ */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-panel p-6">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              { q: "Can I switch plans at any time?", a: "Yes. Upgrades take effect immediately. Downgrades apply at the next billing cycle." },
              { q: "What happens if I exceed my API limit?", a: "Requests are throttled with a 429 status. No overage charges on Free/Pro plans." },
              { q: "Is there a free trial for Enterprise?", a: "Yes, we offer a 14-day Enterprise trial. Contact sales to get started." },
              { q: "Do you offer annual billing?", a: "Yes — save 20% with annual plans. Contact us for details." },
              { q: "How does request signing work?", a: "Pro and Enterprise tiers require HMAC-SHA256 signed requests for added security. Documentation is available in your developer dashboard." },
              { q: "What data do different tiers receive?", a: "Free receives abstracted bands, Pro gets expanded analytics, Enterprise gets full precision data. All protocol logic remains server-side." },
            ].map((faq) => (
              <div key={faq.q}>
                <div className="text-xs font-mono font-semibold text-foreground mb-1">{faq.q}</div>
                <div className="text-xs font-mono text-muted-foreground">{faq.a}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <footer className="text-center py-6 text-xs font-mono text-muted-foreground">
          DGTN Protocol — Decentralized Time Infrastructure
        </footer>
      </main>
    </div>
  );
}
