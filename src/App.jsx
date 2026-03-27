import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Map from './pages/Map';
import Guide from './pages/Guide';
import Profile from './pages/Profile';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import { AuthProvider } from './context/AuthContext';
import InstallPrompt from './components/InstallPrompt';
import { Toaster } from 'react-hot-toast';
import liff from '@line/liff';
import './App.css';

function App() {
  useEffect(() => {
    // LIFFの初期化
    liff.init({ liffId: '2009605819-jfnAKsu6' })
      .then(() => {
        console.log('LIFF initialized success');
      })
      .catch((err) => {
        console.warn('LIFF init error', err);
      });
  }, []);

  return (
    <AuthProvider>
      <Toaster position="top-center" />
      <BrowserRouter>
        <InstallPrompt />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Map />} />
            <Route path="report" element={<Map initialPostMode={true} />} />
            <Route path="guide" element={<Guide />} />
            <Route path="profile" element={<Profile />} />
            <Route path="mypage" element={<Profile />} />
            <Route path="terms" element={<Terms />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
