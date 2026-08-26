import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ComponentTypes from "./pages/ComponentTypes";
import BackupRestore from "./pages/BackupRestore";
import Companies from "./pages/Companies";
import Execution from "./pages/Execution";
import Custody from "./pages/Custody";
import Invoices from "./pages/Invoices";
import MyRequests from "./pages/MyRequests";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Inventory from "./pages/Inventory";
import InventoryCounts from "./pages/InventoryCounts";
import InventoryCategories from "./pages/InventoryCategories";
import InvoiceDocument from "./pages/InvoiceDocument";
import Organization from "./pages/Organization";
import Operations from "./pages/Operations";
import Requests from "./pages/Requests";
import Reports from "./pages/Reports";
import PrintLab from "./pages/PrintLab";
import Transactions from "./pages/Transactions";
import Traceability from "./pages/Traceability";
import Users from "./pages/Users";

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
      <Route path={"/companies"} component={() => <WarehouseShell><Companies /></WarehouseShell>} />
      <Route path={"/inventory-categories"} component={() => <WarehouseShell><InventoryCategories /></WarehouseShell>} />
      <Route path={"/inventory-counts"} component={() => <WarehouseShell><InventoryCounts /></WarehouseShell>} />
      <Route path={"/invoice/:id"} component={() => <WarehouseShell><InvoiceDocument /></WarehouseShell>} />
      <Route path={"/invoices"} component={() => <WarehouseShell><Invoices /></WarehouseShell>} />
      <Route path={"/my-requests"} component={() => <WarehouseShell><MyRequests /></WarehouseShell>} />
      <Route path={"/custody"} component={() => <WarehouseShell><Custody /></WarehouseShell>} />
      <Route path={"/requests"} component={() => <WarehouseShell><Requests /></WarehouseShell>} />
      <Route path={"/departments"} component={() => <WarehouseShell><Organization initialTab="departments" /></WarehouseShell>} />
      <Route path={"/employees"} component={() => <WarehouseShell><Organization initialTab="employees" /></WarehouseShell>} />
      <Route path={"/users"} component={() => <WarehouseShell><Users /></WarehouseShell>} />
      <Route path={"/transactions"} component={() => <WarehouseShell><Transactions /></WarehouseShell>} />
      <Route path={"/traceability"} component={() => <WarehouseShell><Traceability /></WarehouseShell>} />
      <Route path={"/operations"} component={() => <WarehouseShell><Operations /></WarehouseShell>} />
      <Route path={"/execution"} component={() => <WarehouseShell><Execution /></WarehouseShell>} />
      <Route path={"/reports"} component={() => <WarehouseShell><Reports /></WarehouseShell>} />
      <Route path={"/print-lab"} component={() => <WarehouseShell><PrintLab /></WarehouseShell>} />
      <Route path={"/backup"} component={() => <WarehouseShell><BackupRestore /></WarehouseShell>} />
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
