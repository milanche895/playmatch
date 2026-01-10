import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initPushNotifications } from './lib/notifications';

import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true,
});

// Initialize push notifications on app startup
initPushNotifications().catch(err => {
  console.warn('Failed to initialize push notifications:', err);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);



