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
        <Route path="ingest" element={<IngestPage />} />
      </Routes>
    </AdminLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CVIPage />} />
      <Route path="/admin/*" element={<AdminRoutes />} />
    </Routes>
  );
}
