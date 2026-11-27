import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App.jsx';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
// Hind covers Devanagari (Hindi/Marathi text), which Plus Jakarta Sans does not.
import '@fontsource/hind/400.css';
import '@fontsource/hind/600.css';
import './ui/styles.css';

createRoot(document.getElementById('root')).render(<App />);
