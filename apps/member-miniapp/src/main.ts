import { createSSRApp } from 'vue';
import App from './App.vue';
import { restoreSession } from '@/store/session';
import { memberPageMixin } from '@/utils/member-entry';

export function createApp() {
  restoreSession();
  const app = createSSRApp(App);
  app.mixin(memberPageMixin);
  return {
    app,
  };
}
