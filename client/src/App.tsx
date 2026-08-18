import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ComponentTypes from "./pages/ComponentTypes";
import Invoices from "./pages/Invoices";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Inventory from "./pages/Inventory";
import Organization from "./pages/Organization";
import Requests from "./pages/Requests";
import Transactions from "./pages/Transactions";

function WarehouseShell({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={() => <WarehouseShell><Home /></WarehouseShell>} />
      <Route path={"/inventory"} component={() => <WarehouseShell><Inventory /></WarehouseShell>} />
      <Route path={"/products"} component={() => <WarehouseShell><Inventory section="products" /></WarehouseShell>} />
      <Route path={"/component-types"} component={() => <WarehouseShell><ComponentTypes /></WarehouseShell>} />
      <Route path={"/invoices"} component={() => <WarehouseShell><Invoices /></WarehouseShell>} />
      <Route path={"/requests"} component={() => <WarehouseShell><Requests /></WarehouseShell>} />
      <Route path={"/departments"} component={() => <WarehouseShell><Organization initialTab="departments" /></WarehouseShell>} />
      <Route path={"/employees"} component={() => <WarehouseShell><Organization initialTab="employees" /></WarehouseShell>} />
      <Route path={"/transactions"} component={() => <WarehouseShell><Transactions /></WarehouseShell>} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
