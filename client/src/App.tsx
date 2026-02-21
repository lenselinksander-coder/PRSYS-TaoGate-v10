import { Routes, Route } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import OrganizationsPage from "./pages/OrganizationsPage";
import ConnectorsPage from "./pages/ConnectorsPage";
import ImportPage from "./pages/ImportPage";
import GatewayLogsPage from "./pages/GatewayLogsPage";
import TriagePage from "./TriagePage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/organizations" element={<OrganizationsPage />} />
        <Route path="/triage" element={<TriagePage />} />
        <Route path="/connectors" element={<ConnectorsPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/gateway-logs" element={<GatewayLogsPage />} />
      </Routes>
    </Layout>
  );
}
