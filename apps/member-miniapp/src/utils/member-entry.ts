import { sessionState } from '@/store/session';
import { hasLegalConsent } from '@/utils/member';
import { brandShare, brandTimelineShare } from '@/utils/public-share';

const entryRoute = 'pages/index/index';
const legalRoutes = new Set(['pages/legal/privacy', 'pages/legal/terms']);
let redirecting = false;

export function isMemberEntryReady(): boolean {
  return !!(sessionState.token && sessionState.userId && sessionState.profile?.phone && hasLegalConsent());
}

function openMemberEntry() {
  if (redirecting) return;
  redirecting = true;
  uni.switchTab({ url: `/${entryRoute}`, complete: () => { redirecting = false; } });
}

function currentRoute(page: { $scope?: { route?: string } }): string {
  const pages = getCurrentPages();
  return page.$scope?.route || pages[pages.length - 1]?.route || '';
}

// Shared by every page. Sharing has no prompts and never reads member data.
export const memberPageMixin = {
  onShareAppMessage: brandShare,
  onShareTimeline: brandTimelineShare,
  onLoad(this: { $scope?: { route?: string } }, query: Record<string, string>) {
    if (query?.entry === 'share' && currentRoute(this) !== entryRoute) openMemberEntry();
  },
  onShow(this: { $scope?: { route?: string } }) {
    const route = currentRoute(this);
    // Guests must be able to read the agreements before granting consent.
    if (route && route !== entryRoute && !legalRoutes.has(route) && !isMemberEntryReady()) openMemberEntry();
  },
};
