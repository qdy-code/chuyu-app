// A fixed public card prevents native screenshots or page parameters from
// exposing member information, including when sharing from a private page.
const title = '月光石屿 MOONISLE｜美甲 · 饰品 · 鲜花';
const imageUrl = '/static/brand/share-cover.png';

export function brandShare() {
  return { title, imageUrl, path: '/pages/index/index' };
}

export function brandTimelineShare() {
  // Timeline cannot change its page path. This public marker makes the
  // receiving page open the member entry without carrying the sender's query.
  return { title, imageUrl: '/static/brand/share-cover-square.png', query: 'entry=share' };
}
