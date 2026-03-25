import { Routes, Route } from "react-router-dom";
import "./index.css";
import AdminLayout from "./components/Layout";
import CVIPage from "./pages/CVIPage";
import DashboardPage from "./pages/DashboardPage";
import OrganizationsPage from "./pages/OrganizationsPage";
import ConnectorsPage from "./pages/ConnectorsPage";
import ImportPage from "./pages/ImportPage";
import GatewayLogsPage from "./pages/GatewayLogsPage";
import OlympiaPage from "./pages/OlympiaPage";
import IngestPage from "./pages/IngestPage";
import ScopesPage from "./pages/ScopesPage";
import TriagePage from "./TriagePage";
import CastraPage from "./pages/CastraPage";
import VectorPage from "./pages/VectorPage";
import AlgoritmeregisterPage from "./pages/AlgoritmeregisterPage";
import GlazenBastionPage from "./pages/GlazenBastionPage";
import DeckBuilderPage from "./pages/DeckBuilderPage";
import LiveGateViewPage from "./pages/LiveGateViewPage";

function AdminRoutes() {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<DashboardPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="triage" element={<TriagePage />} />
        <Route path="castra" element={<CastraPage />} />
        <Route path="connectors" element={<ConnectorsPage />} />
        <Route path="scopes" element={<ScopesPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="gateway-logs" element={<GatewayLogsPage />} />
        <Route path="olympia" element={<OlympiaPage />} />
        <Route path="vector" element={<VectorPage />} />
        <Route path="algoritmeregister" element={<AlgoritmeregisterPage />} />
        <Route path="ingest" element={<IngestPage />} />
        <Route path="deck-builder" element={<DeckBuilderPage />} />
        <Route path="live-gate" element={<LiveGateViewPage />} />
      </Routes>
    </AdminLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CVIPage />} />
      <Route path="/glazen-bastion" element={<GlazenBastionPage />} />
      <Route path="/admin/*" element={<AdminRoutes />} />
    </Routes>
  );
}
