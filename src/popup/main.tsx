import React from 'react';
import ReactDOM from 'react-dom/client';
import { Popup } from './Popup';

// Global styles would go here if extracted, but we use inline for now.
import '../index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
