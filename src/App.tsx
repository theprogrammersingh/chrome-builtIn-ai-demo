import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import TranslatorPage from './pages/TranslatorPage';
import SummarizerPage from './pages/SummarizerPage';
import PromptPage from './pages/PromptPage';
import WriterRewriterPage from './pages/WriterRewriterPage';
import ProofreaderPage from './pages/ProofreaderPage';
import MultimodalPromptPage from './pages/MultimodalPromptPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/translator" replace />} />
          <Route path="translator" element={<TranslatorPage />} />
          <Route path="summarizer" element={<SummarizerPage />} />
          <Route path="prompt" element={<PromptPage />} />
          <Route path="multimodal" element={<MultimodalPromptPage />} />
          <Route path="writer" element={<WriterRewriterPage />} />
          <Route path="proofreader" element={<ProofreaderPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
