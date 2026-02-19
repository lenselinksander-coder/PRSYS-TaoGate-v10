import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import ArgosPage from "@/pages/ArgosPage";
import OlympiaPage from "@/pages/OlympiaPage";
import ManualPage from "@/pages/ManualPage";
import LexiconPage from "@/pages/LexiconPage";
import ReadmePage from "@/pages/ReadmePage";
import ScopesPage from "@/pages/ScopesPage";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={ArgosPage} />
        <Route path="/scopes" component={ScopesPage} />
        <Route path="/olympia" component={OlympiaPage} />
        <Route path="/lexicon" component={LexiconPage} />
        <Route path="/manual" component={ManualPage} />
        <Route path="/readme" component={ReadmePage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
