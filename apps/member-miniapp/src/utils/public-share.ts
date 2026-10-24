// A fixed public card prevents native screenshots or page parameters from
// exposing member information, including when sharing from a private page.
const title = '月光石屿 MOONISLE｜美甲 · 饰品 · 鲜花';
const imageUrl = '/static/brand/share-cover.png';

export function brandShare() {
  return { title, imageUrl, path: '/pages/nail/nail' };
}

export function brandTimelineShare() {
  // Timeline cannot change its page path. This public marker makes the
  // receiving page open the public catalog without carrying the sender's query.
  return { title, imageUrl: '/static/brand/share-cover-square.png', query: 'entry=share' };
}

// Sharing is available on every page, with no login requirement or prompts.
// There is deliberately no global onShow/login redirect: guests can browse.
export const publicShareMixin = {
  onShareAppMessage: brandShare,
  onShareTimeline: brandTimelineShare,
  onLoad(this: { $scope?: { route?: string } }, query: Record<string, string>) {
    if (query?.entry !== 'share') return;
    const pages = getCurrentPages();
    const route = this.$scope?.route || pages[pages.length - 1]?.route;
    if (route !== 'pages/nail/nail') uni.switchTab({ url: '/pages/nail/nail' });
  },
};
