import { createSSRApp } from 'vue';
import App from './App.vue';
import { restoreSession } from '@/store/session';

export function createApp() {
  restoreSession();
  const app = createSSRApp(App);
  return {
    app,
  };
}
