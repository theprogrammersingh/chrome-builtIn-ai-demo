import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import TranslatorPage from './pages/TranslatorPage';
import SummarizerPage from './pages/SummarizerPage';
import PromptPage from './pages/PromptPage';
import WriterRewriterPage from './pages/WriterRewriterPage';
import ProofreaderPage from './pages/ProofreaderPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/translator" replace />} />
          <Route path="translator" element={<TranslatorPage />} />
          <Route path="summarizer" element={<SummarizerPage />} />
          <Route path="prompt" element={<PromptPage />} />
          <Route path="writer" element={<WriterRewriterPage />} />
          <Route path="proofreader" element={<ProofreaderPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
