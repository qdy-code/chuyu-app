import { reactive } from 'vue';
import type { MemberProfile } from '@member-platform/shared';

interface SessionState {
  token: string;
  userId: string;
  profile: MemberProfile | null;
}

export const sessionState = reactive<SessionState>({
  token: '',
  userId: '',
  profile: null,
});
