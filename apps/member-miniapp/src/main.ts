import { createSSRApp } from 'vue';
import App from './App.vue';
import { restoreSession } from '@/store/session';
import { publicShareMixin } from '@/utils/public-share';

export function createApp() {
  restoreSession();
  const app = createSSRApp(App);
  app.mixin(publicShareMixin);
  return {
    app,
  };
}
