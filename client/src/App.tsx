import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { Landing } from './pages/Landing';
import { Inbox } from './pages/Inbox';
import { History } from './pages/History';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <div style={{ minHeight: '100vh', background: '#FAFAFB' }}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/inbox/:token" element={<Inbox />} />
            <Route path="/history" element={<History />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}
