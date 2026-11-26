import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App.jsx';
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/hind/400.css';
import '@fontsource/hind/500.css';
import '@fontsource/hind/600.css';
import './ui/styles.css';

createRoot(document.getElementById('root')).render(<App />);
