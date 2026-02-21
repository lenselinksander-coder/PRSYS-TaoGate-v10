import { Routes, Route } from "react-router-dom";
import "./index.css";
import TriagePage from "./TriagePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TriagePage />} />
    </Routes>
  );
} 