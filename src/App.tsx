import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrivyProvider } from "@privy-io/react-auth";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import NodeOperator from "./pages/NodeOperator.tsx";
import Developer from "./pages/Developer.tsx";
import Admin from "./pages/Admin.tsx";
import SuperAdmin from "./pages/SuperAdmin.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import EnterpriseTrading from "./pages/EnterpriseTrading.tsx";

const queryClient = new QueryClient();

const App = () => (
  <PrivyProvider
    appId="cmmo24bor00mx0ci8zsdmpsq8"
    config={{
      appearance: {
        theme: "dark",
        accentColor: "#00d4ff",
      },
      loginMethods: ["email", "wallet", "google"],
    }}
  >
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/nodes" element={<NodeOperator />} />
            <Route path="/developer" element={<Developer />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/enterprise/trading" element={<EnterpriseTrading />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </PrivyProvider>
);

export default App;
