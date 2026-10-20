const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const vue = require('vue');

// Run the real page handlers with a simulated WeChat runtime and API; no live writes.
function setup(t, overrides = {}, initialProfile = null) {
  const session = vue.reactive({ userId: initialProfile?.id || '', token: initialProfile ? 'token-a' : '', profile: initialProfile });
  const storage = new Map();
  const navigation = [];
  const notices = [];
  const payloads = [];
  const hooks = new Map();
  const emissions = [];
  let serverProfile = initialProfile;
  let accept = true;
  const uni = {
    getStorageSync: (key) => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
    navigateTo: (options) => { navigation.push(options.url); options.success?.(); options.complete?.(); },
    switchTab: (options) => { navigation.push(options.url); options.success?.(); options.complete?.(); },
    showModal: (options) => { notices.push(options); options.success?.({ confirm: accept }); },
    showToast: (options) => notices.push(options),
    showLoading() {}, hideLoading() {},
    login: (options) => options.success({ code: 'test-login-code' }),
    previewImage: (options) => notices.push(options),
    makePhoneCall: (options) => notices.push(options),
    openLocation: (options) => notices.push(options),
    setClipboardData: (options) => notices.push(options),
  };
  const api = {
    getMyProfile: async () => serverProfile,
    getMyCachedProfile: async () => serverProfile,
    isSessionExpiredError: (error) => error.message === 'expired',
    readableErrorMessage: (error, fallback) => error?.message || fallback,
    wechatLoginWithProfile: async () => {
      serverProfile ||= { id: 'member-a', nickname: '微信用户', avatarUrl: '', balance: 0, points: 0 };
      return { token: 'token-a', user: serverProfile };
    },
    updateMyProfile: async (data) => { serverProfile = { ...serverProfile, ...data }; return serverProfile; },
    bindWechatPhone: async () => { serverProfile = { ...serverProfile, phone: '13800138000' }; return serverProfile; },
    listCatalogProducts: async () => [product],
    listCatalogCategories: async () => [],
    listAppointmentUnavailableDates: async () => [],
    listBookedAppointmentSlots: async () => [],
    listMyAppointments: async () => [],
    toAbsoluteImageUrl: (source) => source.startsWith('http') ? source : `https://example.test${source}`,
    createAppointment: async (payload) => {
      payloads.push(payload);
      return { ...payload, id: 'appointment-test', productName: product.name, status: 'PENDING' };
    },
    ...overrides,
  };
  const sessionModule = {
    sessionState: session, restoreSession() {},
    setProfile: (profile) => { session.profile = profile; session.userId = profile.id; },
    clearSession: () => { session.userId = ''; session.token = ''; session.profile = null; },
    setLoginSession: (response) => { session.userId = response.user.id; session.token = response.token; session.profile = response.user; },
  };
  const cache = new Map();
  const scope = vue.effectScope();
  t.after(() => scope.stop());
  function load(name, exportsToExpose = []) {
    if (cache.has(name)) return cache.get(name);
    const path = resolve(__dirname, '..', name);
    let source = readFileSync(path, 'utf8');
    const pageHooks = [];
    if (name.endsWith('.vue')) source = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
    source = source.replaceAll('import.meta.env', `(${JSON.stringify(overrides.env || {})})`);
    if (exportsToExpose.length) source += `\nexport { ${exportsToExpose.join(', ')} };`;
    const code = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
    const exports = {};
    cache.set(name, exports);
    const requireModule = (dependency) => {
      if (dependency === 'vue') return vue;
      if (dependency === '@/store/session') return sessionModule;
      if (dependency === '@/utils/api') return api;
      if (dependency === '@/utils/image-cache') return { resolveImageForDisplay: async (source, fallback) => source || fallback };
      if (dependency === '@dcloudio/uni-app') return { onShow: (hook) => pageHooks.push(hook), onLoad: (hook) => hooks.set(name + ':load', hook), onUnload: (hook) => hooks.set(name + ':unload', hook) };
      if (dependency.endsWith('.vue')) return {};
      if (dependency.startsWith('@/')) return load(dependency.slice(2) + '.ts');
      throw new Error(`Unexpected dependency: ${dependency}`);
    };
    scope.run(() => vm.runInNewContext(code, { exports, require: requireModule, uni, console, Date, setTimeout, getCurrentPages: () => overrides.pageStack || [],
      defineProps: () => overrides.props || {}, defineEmits: () => (event, ...args) => emissions.push({ event, args }),
    }));
    hooks.set(name, pageHooks);
    return exports;
  }
  return { session, storage, uni, api, load, navigation, notices, payloads, hooks, emissions, runInScope: fn => scope.run(fn), cancel: () => { accept = false; } };
}

const product = { id: 'style-test', name: '月光晕染', images: [], businessType: 'NAIL' };
const linked = { id: 'member-a', phone: '13800138000', nickname: '会员', balance: 80, points: 20,
  pospal: { state: 'LINKED', customerNumber: 'VIP-008', syncedAt: '2026-10-10T08:00:00Z' } };

function authorize(ctx) {
  const member = ctx.load('utils/member.ts');
  member.setLegalConsent(true);
  return member;
}

test('favorites persist by member and business, survive a fresh module, and may be removed', (t) => {
  const ctx = setup(t, {}, linked);
  const favorites = ctx.load('utils/favorite-products.ts');
  assert.equal(favorites.toggleFavorite(product), true);
  favorites.toggleFavorite({ ...product, businessType: 'FLOWER' });
  assert.equal(favorites.favoriteProducts.value.length, 2);
  const restarted = setup(t, {}, linked);
  restarted.storage.set('member-miniapp-favorites-v1:member-a', ctx.storage.get('member-miniapp-favorites-v1:member-a'));
  const restored = restarted.load('utils/favorite-products.ts');
  assert.equal(restored.favoriteProducts.value.length, 2);
  assert.equal(restored.toggleFavorite(product), false);
  assert.equal(restored.isFavorite(product), false);
  assert.equal(restored.favoriteProducts.value[0].businessType, 'FLOWER');
});

test('favorites are hidden on logout and never carried into another member account', (t) => {
  const ctx = setup(t, {}, linked);
  const favorites = ctx.load('utils/favorite-products.ts');
  favorites.toggleFavorite(product);
  ctx.session.token = ''; ctx.session.userId = '';
  assert.equal(favorites.favoriteProducts.value.length, 0);
  assert.throws(() => favorites.toggleFavorite(product), /登录/);
  ctx.session.userId = 'member-b'; ctx.session.token = 'token-b';
  assert.equal(favorites.favoriteProducts.value.length, 0);
  ctx.session.userId = linked.id; ctx.session.token = 'token-a';
  assert.equal(favorites.isFavorite(product), true);
});

test('favorites handle malformed cache and storage failures without claiming a save or overwriting unread data', (t) => {
  const ctx = setup(t, {}, linked);
  const favorites = ctx.load('utils/favorite-products.ts');
  assert.equal(favorites.normalizeFavorites([null, { id: 'x', name: 'bad', businessType: 'WRONG' }, product, product]).length, 1);
  ctx.uni.setStorageSync = () => { throw Error('quota'); };
  assert.throws(() => favorites.toggleFavorite(product), /未保存/);
  assert.equal(favorites.favoriteProducts.value.length, 0);
  ctx.uni.getStorageSync = () => { throw Error('read failure'); };
  favorites.restoreFavorites();
  assert.ok(favorites.favoriteStorageError.value);
  assert.throws(() => favorites.toggleFavorite(product), /暂未读取/);
});

test('favorite button reflects a successful save and cancellation without creating any appointment', async (t) => {
  const ctx = setup(t, { props: { product } }, linked); authorize(ctx);
  const button = ctx.load('components/FavoriteButton.vue', ['toggle', 'saved']);
  await button.toggle(); assert.equal(button.saved.value, true);
  await button.toggle(); assert.equal(button.saved.value, false);
  assert.equal(ctx.payloads.length, 0);
});

test('personal style history uses only completed nail appointments, newest first', (t) => {
  const ctx = setup(t, {}, linked);
  const { completedNailAppointments } = ctx.load('utils/repeat-booking.ts');
  const base = { businessType: 'NAIL', startTime: '10:00' };
  const records = [{ ...base, id: 'older', status: 'COMPLETED', appointmentDate: '2026-01-01' },
    { ...base, id: 'pending', status: 'PENDING', appointmentDate: '2026-10-01' },
    { ...base, id: 'recent', status: 'COMPLETED', appointmentDate: '2026-09-01' },
    { ...base, id: 'cancelled', status: 'CANCELLED', appointmentDate: '2026-10-01' },
    { ...base, id: 'flower', businessType: 'FLOWER', status: 'COMPLETED', appointmentDate: '2026-10-01' }];
  assert.equal(completedNailAppointments(records).map(item => item.id).join(','), 'recent,older');
  assert.equal(records[0].id, 'older');
});

test('repeat booking uses the current product and prepares a fresh application without old date, notes or status', async (t) => {
  const ctx = setup(t, { listCatalogProducts: async () => [{ ...product, name: '更新后的款式' }] }, linked); authorize(ctx);
  const { repeatBooking } = ctx.runInScope(() => ctx.load('utils/repeat-booking.ts').useRepeatBooking());
  await repeatBooking({ businessType: 'NAIL', productId: product.id, appointmentDate: '2001-01-01', startTime: '10:00', remark: '旧私人备注', status: 'COMPLETED' });
  const intent = ctx.load('utils/booking-flow.ts').takePendingBooking('NAIL');
  assert.equal(intent.product.name, '更新后的款式');
  assert.equal(intent.date, undefined); assert.equal(intent.time, undefined); assert.equal(intent.remark, undefined);
  assert.equal(ctx.payloads.length, 0);
  assert.equal(ctx.navigation[0], '/pages/appointment/appointment?booking=1');
});

test('repeat booking permits nails without a style, and a deleted style requires the member choice', async (t) => {
  const ctx = setup(t, { listCatalogProducts: async () => [] }, linked); authorize(ctx);
  const { repeatBooking } = ctx.runInScope(() => ctx.load('utils/repeat-booking.ts').useRepeatBooking());
  ctx.cancel(); await repeatBooking({ businessType: 'NAIL', productId: 'deleted' });
  assert.equal(ctx.navigation.length, 0);
  await repeatBooking({ businessType: 'NAIL' });
  assert.equal(ctx.load('utils/booking-flow.ts').takePendingBooking('NAIL').product, undefined);
  const accepted = setup(t, { listCatalogProducts: async () => [] }, linked); authorize(accepted);
  const action = accepted.runInScope(() => accepted.load('utils/repeat-booking.ts').useRepeatBooking());
  await action.repeatBooking({ businessType: 'NAIL', productId: 'deleted' });
  assert.equal(accepted.load('utils/booking-flow.ts').takePendingBooking('NAIL').product, undefined);
  assert.equal(accepted.payloads.length, 0);
});

test('failed product lookup and unavailable accessory never become a silent style-free booking', async (t) => {
  const ctx = setup(t, { listCatalogProducts: async () => { throw Error('网络连接不稳定'); } }, linked); authorize(ctx);
  const action = ctx.runInScope(() => ctx.load('utils/repeat-booking.ts').useRepeatBooking());
  await action.repeatBooking({ businessType: 'NAIL', productId: product.id });
  assert.equal(ctx.navigation.length, 0); assert.match(ctx.notices.at(-1).content, /网络/);
  ctx.api.listCatalogProducts = async () => [];
  await action.repeatBooking({ businessType: 'ACCESSORY', productId: 'deleted' });
  assert.equal(ctx.navigation.length, 0);
  ctx.api.listCatalogProducts = async () => [{ ...product, businessType: 'ACCESSORY', reservedByUserId: 'someone-else' }];
  await action.repeatBooking({ businessType: 'ACCESSORY', productId: product.id });
  assert.equal(ctx.navigation.length, 0); assert.match(ctx.notices.at(-1).content, /已被预留/);
});

test('repeat booking ignores a product response after logout and suppresses repeated clicks', async (t) => {
  let finish; let count = 0;
  const ctx = setup(t, { listCatalogProducts: () => { count++; return new Promise(resolve => { finish = resolve; }); } }, linked); authorize(ctx);
  const action = ctx.runInScope(() => ctx.load('utils/repeat-booking.ts').useRepeatBooking());
  const pending = action.repeatBooking({ businessType: 'NAIL', productId: product.id });
  await new Promise(setImmediate);
  await action.repeatBooking({ businessType: 'NAIL', productId: product.id });
  assert.equal(count, 1);
  ctx.session.userId = ''; ctx.session.token = ''; ctx.session.profile = null;
  finish([product]); await pending;
  assert.equal(ctx.navigation.length, 0); assert.equal(ctx.payloads.length, 0); assert.equal(action.repeating.value, false);
});

test('favorites page keeps network failure distinct from a removed product and clears private history on member switch', async (t) => {
  const ctx = setup(t, { listCatalogProducts: async type => { if (type === 'NAIL') throw Error('network'); return []; },
    listMyAppointments: async () => [{ id: 'complete', businessType: 'NAIL', status: 'COMPLETED', appointmentDate: '2026-01-01', startTime: '10:00' }] }, linked);
  authorize(ctx); ctx.load('utils/favorite-products.ts').toggleFavorite(product);
  const page = ctx.load('pages/styles/styles.vue', ['loadCatalog', 'catalogErrors', 'currentProduct', 'selectTab', 'history', 'visibleFavorites']);
  await page.loadCatalog(); assert.equal(page.catalogErrors.value.NAIL, true); assert.equal(page.currentProduct(product), undefined);
  await page.selectTab('history'); assert.equal(page.history.value.length, 1);
  ctx.session.userId = 'member-b'; ctx.session.token = 'token-b';
  assert.equal(page.history.value.length, 0); assert.equal(page.visibleFavorites.value.length, 0);
});

test('rebooking accessories or flowers resets a stale category before loading the chosen product', async (t) => {
  for (const [type, pageName] of [['ACCESSORY', 'accessory'], ['FLOWER', 'flower']]) {
    const queries = [];
    const item = { ...product, businessType: type, isActive: true };
    const ctx = setup(t, { listCatalogProducts: async (business, category) => { queries.push(category); return category ? [] : [item]; } }, linked);
    authorize(ctx); ctx.load('utils/booking-flow.ts').rememberBooking({ businessType: type, product: item });
    const page = ctx.load(`pages/${pageName}/${pageName}.vue`, ['selectedCategoryId', 'reserveProduct']);
    page.selectedCategoryId.value = 'old-category';
    await ctx.hooks.get(`pages/${pageName}/${pageName}.vue`)[0]();
    assert.equal(queries[0], undefined); assert.equal(page.reserveProduct.value.id, product.id); assert.equal(ctx.payloads.length, 0);
  }
});

test('balance refresh failure exposes stale data, retry updates it, and parallel refreshes share one request', async (t) => {
  let fail = true;
  let count = 0;
  const ctx = setup(t, { getMyProfile: async () => { count++; if (fail) throw new Error('服务暂不可用'); return { ...linked, balance: 120 }; } }, linked);
  const member = authorize(ctx);
  await member.refreshSessionProfile();
  assert.equal(ctx.session.profile.balance, 80);
  assert.equal(member.profileRefreshState.fresh, false);
  assert.equal(member.profileRefreshState.errorMessage, '服务暂不可用');
  assert.equal(member.profileRefreshState.loading, false);
  fail = false;
  await Promise.all([member.refreshSessionProfile(), member.refreshSessionProfile()]);
  assert.equal(count, 2);
  assert.equal(ctx.session.profile.balance, 120);
  assert.equal(member.profileRefreshState.fresh, true);
  assert.equal(member.profileRefreshState.errorMessage, '');
});

test('late account response after switching users never restores the previous balance', async (t) => {
  let finish;
  const ctx = setup(t, { getMyProfile: () => new Promise((resolve) => { finish = resolve; }) }, linked);
  const member = authorize(ctx);
  const pending = member.refreshSessionProfile();
  ctx.session.userId = 'member-b';
  ctx.session.token = 'token-b';
  ctx.session.profile = { id: 'member-b', balance: 5 };
  finish(linked);
  assert.equal(await pending, false);
  assert.equal(ctx.session.profile.balance, 5);
  assert.equal(member.profileRefreshState.fresh, false);
});

test('expired session removes private account data rather than showing zero or old funds', async (t) => {
  const ctx = setup(t, { getMyProfile: async () => { throw new Error('expired'); } }, linked);
  const member = authorize(ctx);
  assert.equal(await member.refreshSessionProfile(), false);
  assert.equal(ctx.session.profile, null);
  assert.equal(ctx.session.token, '');
});

test('member numbers and recharge labels retain the POS account boundary', (t) => {
  const ctx = setup(t);
  const display = ctx.load('utils/member-display.ts');
  assert.equal(display.memberNumber(linked), 'VIP-008');
  assert.equal(display.memberNumber({ ...linked, pospal: { state: 'UNLINKED' } }), '待关联');
  assert.equal(display.memberNumber({ ...linked, pospal: { state: 'LINKED' } }), '暂不可用');
  assert.equal(display.memberNumber({ ...linked, pospal: undefined }), 'member-a');
  assert.equal(display.rechargeStatusText({ source: 'POSPAL', status: 'APPROVED' }), '已入账');
  assert.equal(display.rechargeStatusText({ status: 'PENDING' }), '审核中');
});

for (const [business, page, method] of [['NAIL', 'nail', 'openAppointment'], ['ACCESSORY', 'accessory', 'openReserve'], ['FLOWER', 'flower', 'openReserve']]) {
  test(`${business}: first login and phone setup return to the selected product without submitting or requesting an avatar`, async (t) => {
    const ctx = setup(t);
    const source = ctx.load(`pages/${page}/${page}.vue`, [method]);
    await source[method](product);
    assert.equal(ctx.navigation.at(-1), '/pages/index/index');
    const index = ctx.load('pages/index/index.vue', ['handleLegalConsentChange', 'handleEnter', 'phoneInput', 'submitPhone']);
    index.handleLegalConsentChange({ detail: { value: ['accepted'] } });
    await index.handleEnter();
    assert.equal(ctx.payloads.length, 0);
    index.phoneInput.value = '13800138000';
    await index.submitPhone();
    assert.equal(ctx.navigation.at(-1), business === 'NAIL' ? '/pages/appointment/appointment?booking=1' : `/pages/${page}/${page}`);
    assert.equal(ctx.navigation.some((url) => url.includes('account?setup')), false);
    const flow = ctx.load('utils/booking-flow.ts');
    const intent = flow.takePendingBooking(business);
    assert.equal(intent.product.id, product.id);
    assert.equal(ctx.payloads.length, 0);
  });
}

test('cancelled login does not leave an automatic booking redirect', async (t) => {
  const ctx = setup(t);
  ctx.cancel();
  const nail = ctx.load('pages/nail/nail.vue', ['openAppointment']);
  await nail.openAppointment(product);
  const flow = ctx.load('utils/booking-flow.ts');
  assert.equal(flow.takePendingBooking('NAIL'), null);
  assert.equal(ctx.navigation.length, 0);
});

test('nail reservation restores draft and submits selected product only after explicit confirmation', async (t) => {
  const ctx = setup(t, {}, linked);
  authorize(ctx);
  const flow = ctx.load('utils/booking-flow.ts');
  flow.rememberBooking({ businessType: 'NAIL', product, date: '2099-12-01', time: '14:30', remark: '需要卸甲' });
  const page = ctx.load('pages/appointment/appointment.vue', ['refreshPage', 'selectedProduct', 'form', 'confirmSubmitAppointment', 'submittedAppointment']);
  await page.refreshPage();
  assert.equal(page.selectedProduct.value.id, product.id);
  assert.equal(page.form.value.remark, '需要卸甲');
  assert.equal(ctx.payloads.length, 0);
  await page.confirmSubmitAppointment();
  await new Promise(setImmediate);
  assert.equal(ctx.payloads.length, 1);
  assert.equal(ctx.payloads[0].productId, product.id);
  assert.equal(ctx.payloads[0].startTime, '14:30');
  assert.equal(page.submittedAppointment.value.status, 'PENDING');
});

test('successful booking followed by a list error remains submitted and never reports submission failure', async (t) => {
  const ctx = setup(t, { listMyAppointments: async () => { throw new Error('list unavailable'); } }, linked);
  authorize(ctx);
  const page = ctx.load('pages/appointment/appointment.vue', ['submitAppointment', 'form', 'submittedAppointment', 'pageError']);
  page.form.value.appointmentDate = '2099-12-01';
  await page.submitAppointment();
  assert.equal(ctx.payloads.length, 1);
  assert.equal(page.submittedAppointment.value.id, 'appointment-test');
  assert.match(page.pageError.value, /已提交.*刷新失败/);
  assert.equal(ctx.notices.some((notice) => notice.title === 'list unavailable'), false);
});

for (const [business, page] of [['ACCESSORY', 'accessory'], ['FLOWER', 'flower']]) {
  test(`${business}: resumed reservation keeps date and notes and returns a pending receipt`, async (t) => {
    const ctx = setup(t, {}, linked);
    authorize(ctx);
    const flow = ctx.load('utils/booking-flow.ts');
    flow.rememberBooking({ businessType: business, product, date: '2099-12-01', time: '14:30', remark: '预留需求' });
    const name = `pages/${page}/${page}.vue`;
    const source = ctx.load(name, ['form', 'reserveProduct', 'submitReserve', 'submittedAppointment']);
    await ctx.hooks.get(name)[0]();
    assert.equal(source.reserveProduct.value.id, product.id);
    assert.equal(source.form.value.remark, '预留需求');
    assert.equal(source.form.value.time, '14:30');
    assert.equal(ctx.payloads.length, 0);
    await source.submitReserve();
    assert.equal(ctx.payloads[0].productId, product.id);
    assert.equal(source.submittedAppointment.value.status, 'PENDING');
  });
}

test('removed product cannot resume into an unrelated reservation', async (t) => {
  const ctx = setup(t, { listCatalogProducts: async () => [] }, linked);
  authorize(ctx);
  ctx.load('utils/booking-flow.ts').rememberBooking({ businessType: 'FLOWER', product });
  const page = ctx.load('pages/flower/flower.vue', ['reserveProduct']);
  await ctx.hooks.get('pages/flower/flower.vue')[0]();
  assert.equal(page.reserveProduct.value, null);
  assert.equal(ctx.notices.at(-1).title, '商品暂不可预约');
  assert.equal(ctx.payloads.length, 0);
});

for (const [page, method] of [['appointment', 'submitAppointment'], ['accessory', 'submitReserve'], ['flower', 'submitReserve']]) {
  test(`${page}: a late submission response cannot restore a receipt after logout`, async (t) => {
    let finish;
    const ctx = setup(t, { createAppointment: () => new Promise((resolve) => { finish = resolve; }) }, linked);
    authorize(ctx);
    const source = ctx.load(`pages/${page}/${page}.vue`, [method, 'form', 'submittedAppointment', ...(page === 'appointment' ? [] : ['reserveProduct'])]);
    if (page === 'appointment') source.form.value.appointmentDate = '2099-12-01';
    else {
      source.reserveProduct.value = product;
      source.form.value = { date: '2099-12-01', time: '14:30', remark: '' };
    }
    const pending = source[method]();
    await new Promise(setImmediate);
    ctx.session.userId = '';
    ctx.session.token = '';
    ctx.session.profile = null;
    finish({ id: 'old-receipt', status: 'PENDING' });
    await pending;
    assert.equal(source.submittedAppointment.value, null);
  });
}

test('nail records ignore a late response from the previous session', async (t) => {
  let finish;
  const ctx = setup(t, { listMyAppointments: () => new Promise((resolve) => { finish = resolve; }) }, linked);
  authorize(ctx);
  const source = ctx.load('pages/appointment/appointment.vue', ['loadAppointments', 'appointments']);
  const pending = source.loadAppointments();
  ctx.session.userId = 'member-b';
  ctx.session.token = 'token-b';
  finish([{ id: 'old-private-record' }]);
  await pending;
  assert.equal(source.appointments.value.length, 0);
});

test('phone authorization uses one PUT request and never retries the one-time code', async () => {
  const requests = [];
  let fail = false;
  const source = readFileSync(resolve(__dirname, 'api.ts'), 'utf8').replaceAll('import.meta.env', '({VITE_API_BASE_URL:"https://preview.invalid"})');
  const code = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: () => ({ sessionState: { token: 'test-session' }, clearSession() {} }),
    uni: { request: (options) => {
      requests.push(options);
      if (fail) options.fail({ errMsg: 'request:fail' });
      else options.success({ statusCode: 200, data: linked });
    } },
  });
  assert.equal((await exports.bindWechatPhone('one-time-code')).id, linked.id);
  assert.equal(requests[0].method, 'PUT');
  assert.equal(requests[0].data.code, 'one-time-code');
  fail = true;
  await assert.rejects(exports.bindWechatPhone('new-one-time-code'));
  assert.equal(requests.length, 2);
});

test('account status explains cached, loading, failed and successful states in the rendered component', async (t) => {
  let finish;
  const ctx = setup(t, { getMyProfile: () => new Promise((resolve) => { finish = resolve; }) }, linked);
  const member = authorize(ctx);
  const component = ctx.load('components/AccountSyncStatus.vue', ['message']);
  assert.match(component.message.value, /上次同步数据/);
  const pending = member.refreshSessionProfile();
  assert.match(component.message.value, /正在更新/);
  finish(linked);
  await pending;
  assert.match(component.message.value, /已从门店收银系统更新/);
  member.profileRefreshState.errorMessage = '网络连接不稳定';
  assert.match(component.message.value, /暂未更新，以下为上次同步数据/);
  ctx.session.profile = { ...linked, pospal: { state: 'UNLINKED' } };
  assert.match(component.message.value, /工作人员核验/);
});

test('gallery previews every unique product photo at the tapped index', async (t) => {
  const ctx = setup(t, { props: { images: ['/uploads/front.jpg', '/uploads/back.jpg', '/uploads/front.jpg', ''] } });
  const gallery = ctx.load('components/ProductGallery.vue', ['urls', 'preview']);
  assert.equal(gallery.urls.value.length, 2);
  await gallery.preview(1);
  assert.equal(ctx.notices.at(-1).current, 'https://example.test/uploads/back.jpg');
  assert.deepEqual(Array.from(ctx.notices.at(-1).urls), ['https://example.test/uploads/front.jpg', 'https://example.test/uploads/back.jpg']);
});

test('reference price preserves cents and unset price stays a confirmation message', (t) => {
  const ctx = setup(t);
  const display = ctx.load('utils/catalog-display.ts');
  assert.equal(display.referencePriceText(128.5), '参考价 ¥128.50');
  assert.equal(display.referencePriceText(), '参考价到店确认');
  assert.equal(display.productPriceText(128.5), '¥128.50');
  assert.equal(display.productPriceText(0), '¥0.00');
  assert.equal(display.productPriceText(), '到店定价');
});

test('store actions use confirmed public contact without starting a real phone call', (t) => {
  const ctx = setup(t, { env: { VITE_STORE_PHONE: '10086', VITE_STORE_ADDRESS: '测试地址', VITE_STORE_LATITUDE: '31.1', VITE_STORE_LONGITUDE: '121.1' } });
  const contact = ctx.load('utils/store-contact.ts');
  contact.callStore();
  assert.equal(ctx.notices.at(-1).phoneNumber, '10086');
  contact.navigateToStore();
  assert.equal(ctx.notices.at(-1).latitude, 31.1);
  assert.equal(ctx.notices.at(-1).longitude, 121.1);
  assert.equal(ctx.notices.at(-1).address, '测试地址');
  assert.equal(contact.normalizeStoreContact({ latitude: '', longitude: '' }).latitude, undefined);
  assert.equal(contact.normalizeStoreContact({ latitude: 91, longitude: 121 }).latitude, undefined);
});

test('address without coordinates can be copied and missing contacts never invoke device actions', (t) => {
  const ctx = setup(t, { env: { VITE_STORE_ADDRESS: '测试地址' } });
  const contact = ctx.load('utils/store-contact.ts');
  contact.navigateToStore();
  assert.equal(ctx.notices.at(-1).data, '测试地址');
  const count = ctx.notices.length;
  contact.callStore();
  assert.equal(ctx.notices.length, count);
});

test('member home shows earliest next appointment and exposes failed load/retry', async (t) => {
  let fail = true;
  const ctx = setup(t, { listMyAppointments: async () => { if (fail) throw Error('network'); return [{ id: 'next', appointmentDate: '2099-12-01', startTime: '14:30', endTime: '14:30', status: 'PENDING' }]; } }, linked);
  authorize(ctx);
  const home = ctx.load('pages/index/index.vue', ['loadNextAppointment', 'nextAppointment', 'nextAppointmentError']);
  await home.loadNextAppointment();
  assert.equal(home.nextAppointment.value, null);
  assert.equal(home.nextAppointmentError.value, 'network');
  fail = false;
  await home.loadNextAppointment();
  assert.equal(home.nextAppointment.value.id, 'next');
  assert.equal(home.nextAppointmentError.value, '');
});

test('late next-appointment result after logout cannot restore private appointment', async (t) => {
  let finish;
  const ctx = setup(t, { listMyAppointments: () => new Promise(resolve => { finish = resolve; }) }, linked);
  authorize(ctx);
  const home = ctx.load('pages/index/index.vue', ['loadNextAppointment', 'nextAppointment']);
  const pending = home.loadNextAppointment();
  ctx.session.userId = ''; ctx.session.token = '';
  finish([{ id: 'old', appointmentDate: '2099-12-01', startTime: '14:30', endTime: '14:30', status: 'CONFIRMED' }]);
  await pending;
  assert.equal(home.nextAppointment.value, null);
});

test('booked slot loading failure stays unavailable until retry and stale date results are discarded', async (t) => {
  let finish;
  let fail = true;
  let date = vue.ref('2099-12-01');
  const ctx = setup(t, { listBookedAppointmentSlots: async () => { if (fail) throw Error('network'); return new Promise(resolve => { finish = resolve; }); } }, linked);
  const module = ctx.load('utils/use-booked-slots.ts');
  const slots = ctx.runInScope(() => module.useBookedSlots('NAIL', () => date.value));
  assert.equal(await slots.refresh(), false);
  assert.equal(slots.ready.value, false);
  assert.equal(slots.errorMessage.value, 'network');
  fail = false;
  const pending = slots.refresh();
  date.value = '2099-12-02';
  finish([{ startTime: '14:00', endTime: '15:00' }]);
  assert.equal(await pending, false);
  assert.equal(slots.slots.value.length, 0);
});

for (const [page, method] of [['appointment', 'submitAppointment'], ['accessory', 'submitReserve'], ['flower', 'submitReserve']]) {
  test(`${page}: interval overlap is stopped before appointment creation`, async (t) => {
    const ctx = setup(t, { listBookedAppointmentSlots: async () => [{ startTime: '14:30', endTime: '16:00' }] }, linked);
    authorize(ctx);
    const source = ctx.load(`pages/${page}/${page}.vue`, [method, 'form', ...(page === 'appointment' ? ['selectedTime'] : ['reserveProduct'])]);
    if (page === 'appointment') { source.form.value.appointmentDate = '2099-12-01'; source.selectedTime.value = '14:15'; }
    else { source.reserveProduct.value = product; source.form.value = { date: '2099-12-01', time: '14:15', remark: '' }; }
    await source[method]();
    assert.equal(ctx.payloads.length, 0);
    assert.equal(ctx.notices.at(-1).title, '该时间已有确认预约');
  });
}

test('nail booking remains optional-style and uses the explicitly selected time', async (t) => {
  const ctx = setup(t, {}, linked); authorize(ctx);
  const page = ctx.load('pages/appointment/appointment.vue', ['submitAppointment', 'form', 'selectedTime']);
  page.form.value.appointmentDate = '2099-12-01'; page.selectedTime.value = '14:47';
  await page.submitAppointment();
  assert.equal(ctx.payloads.length, 1);
  assert.equal(ctx.payloads[0].productId, undefined);
  assert.equal(ctx.payloads[0].startTime, '14:47');
});

for (const page of ['nail', 'accessory', 'flower']) {
  test(`${page}: failed catalog is distinct from an empty catalog and can be retried`, async (t) => {
    let fail = true;
    const ctx = setup(t, { listCatalogProducts: async () => { if (fail) throw Error('network'); return []; } });
    const catalog = ctx.load(`pages/${page}/${page}.vue`, ['loadCatalog', 'catalogError', 'products']);
    await catalog.loadCatalog();
    assert.match(catalog.catalogError.value, /加载失败/);
    fail = false; await catalog.loadCatalog();
    assert.equal(catalog.catalogError.value, '');
    assert.equal(catalog.products.value.length, 0);
  });
}

for (const page of ['accessory', 'flower']) {
  test(`${page}: repeated submit during availability refresh creates at most one appointment`, async (t) => {
    let finish;
    const ctx = setup(t, { listAppointmentUnavailableDates: () => new Promise(resolve => { finish = resolve; }) }, linked);
    authorize(ctx);
    const source = ctx.load(`pages/${page}/${page}.vue`, ['submitReserve', 'form', 'reserveProduct', 'submitting']);
    source.reserveProduct.value = product; source.form.value = { date: '2099-12-01', time: '14:47', remark: '测试' };
    const pending = source.submitReserve();
    await new Promise(setImmediate);
    assert.equal(source.submitting.value, true);
    await source.submitReserve();
    finish([]);
    await pending;
    assert.equal(ctx.payloads.length, 1);
    assert.equal(source.submitting.value, false);
  });
}

test('package photos use fullscreen viewing rather than passing an unsupported package URL to native preview', async (t) => {
  const ctx = setup(t, { props: { images: ['/static/brand/member-card-bg.jpg', '/static/brand/account-header.jpg'] } });
  const gallery = ctx.load('components/ProductGallery.vue', ['preview', 'current', 'showPackagePreview']);
  await gallery.preview(1);
  assert.equal(gallery.current.value, 1);
  assert.equal(gallery.showPackagePreview.value, true);
  assert.equal(ctx.notices.length, 0);
});

for (const page of ['nail', 'accessory', 'flower']) {
  test(`${page}: native image return preserves catalog, ordinary later visits still refresh`, async (t) => {
    let reads = 0;
    const ctx = setup(t, { listCatalogProducts: async () => { reads++; return [product]; } });
    const name = `pages/${page}/${page}.vue`;
    const catalog = ctx.load(name, ['imagePreview', 'products', 'loading']);
    await ctx.hooks.get(name)[0]();
    const before = catalog.products.value;
    catalog.imagePreview.start();
    await ctx.hooks.get(name)[0]();
    assert.equal(reads, 1);
    assert.equal(catalog.products.value, before);
    assert.equal(catalog.loading.value, false);
    await ctx.hooks.get(name)[0]();
    assert.equal(reads, 2);
    catalog.imagePreview.start(); catalog.imagePreview.cancel();
    await ctx.hooks.get(name)[0]();
    assert.equal(reads, 3, 'failed preview must not suppress an ordinary page visit');
  });
}

test('gallery keeps selected photo when a refreshed record contains the same image URLs', async (t) => {
  const props = vue.reactive({ images: ['/uploads/front.jpg', '/uploads/back.jpg'] });
  const ctx = setup(t, { props });
  const gallery = ctx.load('components/ProductGallery.vue', ['current']);
  await vue.nextTick();
  gallery.current.value = 1;
  props.images = ['/uploads/front.jpg', '/uploads/back.jpg'];
  await vue.nextTick();
  assert.equal(gallery.current.value, 1);
  props.images = ['/uploads/new.jpg'];
  await vue.nextTick();
  assert.equal(gallery.current.value, 0);
});

test('native preview marks the return only after images resolve, and failure cancels the return', async (t) => {
  const ctx = setup(t, { props: { images: ['/uploads/front.jpg'] } });
  const gallery = ctx.load('components/ProductGallery.vue', ['preview']);
  await gallery.preview(0);
  assert.equal(ctx.emissions.at(-1).event, 'preview-start');
  ctx.notices.at(-1).fail({ errMsg: 'preview:fail' });
  assert.equal(ctx.emissions.at(-1).event, 'preview-failed');
});

test('page browsing and booking access use one cached profile read and no paid balance query', async (t) => {
  let cached = 0, paid = 0;
  const ctx = setup(t, {
    getMyCachedProfile: async () => { cached++; return linked; },
    getMyProfile: async () => { paid++; return linked; },
  }, linked);
  const member = authorize(ctx);
  await Promise.all([member.loadSessionProfile(), member.loadSessionProfile()]);
  for (let i = 0; i < 10; i++) {
    assert.equal(await member.ensureSession(), true);
    assert.equal(await member.ensureReadyMemberAccess(), true);
  }
  ctx.load('pages/card/card.vue');
  ctx.load('pages/index/index.vue');
  for (const page of ['pages/card/card.vue', 'pages/index/index.vue']) {
    for (const hook of ctx.hooks.get(page)) await hook();
  }
  assert.equal(cached, 1);
  assert.equal(paid, 0);
  assert.equal(ctx.session.profile.pospal.syncedAt, linked.pospal.syncedAt);
  assert.equal(member.profileRefreshState.fresh, false);
  await member.refreshSessionProfile();
  assert.equal(paid, 1);
  assert.equal(member.profileRefreshState.fresh, true);
});

test('profile cache expiry checks identity without buying another balance query', async (t) => {
  let now = 1000000, cached = 0, paid = 0;
  t.mock.method(Date, 'now', () => now);
  const ctx = setup(t, {
    getMyCachedProfile: async () => { cached++; return linked; },
    getMyProfile: async () => { paid++; return linked; },
  }, linked);
  const member = authorize(ctx);
  await member.loadSessionProfile();
  now += 5 * 60 * 1000 + 1;
  await member.loadSessionProfile();
  assert.equal(cached, 2);
  assert.equal(paid, 0);
});

test('an older cached response cannot overwrite an explicit POS refresh or block later profile loads', async (t) => {
  let finish, count = 0;
  const updated = { ...linked, balance: 120, pospal: { ...linked.pospal, syncedAt: '2026-10-12T08:00:00Z' } };
  const ctx = setup(t, {
    getMyCachedProfile: () => ++count === 1 ? new Promise(r => { finish = r; }) : Promise.resolve(updated),
    getMyProfile: async () => updated,
  }, linked);
  const member = authorize(ctx);
  const passive = member.loadSessionProfile();
  await member.refreshSessionProfile();
  finish(linked);
  await passive;
  assert.equal(ctx.session.profile.balance, 120);
  assert.equal(member.profileRefreshState.fresh, true);
  assert.equal(await member.loadSessionProfile(true), true);
  assert.equal(count, 2);
  assert.equal(ctx.session.profile.balance, 120);
  assert.equal(member.profileRefreshState.fresh, false);
});

test('cached profile checks clear an expired session and ignore a previous member response', async (t) => {
  let finish;
  const ctx = setup(t, { getMyCachedProfile: () => new Promise(r => { finish = r; }) }, linked);
  const member = authorize(ctx);
  const request = member.loadSessionProfile();
  ctx.session.userId = 'member-b'; ctx.session.token = 'token-b'; ctx.session.profile = { id: 'member-b', balance: 5 };
  finish(linked); await request;
  assert.equal(ctx.session.profile.balance, 5);
  ctx.api.getMyCachedProfile = async () => { throw new Error('expired'); };
  assert.equal(await member.loadSessionProfile(), false);
  assert.equal(ctx.session.profile, null);
});

test('an unlinked member sees a newly confirmed store binding without waiting for the profile cache window', async (t) => {
  let count = 0;
  const unlinked = { ...linked, balance: 0, points: 0, pospal: { state: 'UNLINKED' } };
  const ctx = setup(t, { getMyCachedProfile: async () => ++count === 1 ? unlinked : linked }, unlinked);
  const member = authorize(ctx);
  await member.loadSessionProfile(); await member.loadSessionProfile();
  assert.equal(count, 2);
  assert.equal(ctx.session.profile.pospal.state, 'LINKED');
  assert.equal(ctx.session.profile.pospal.syncedAt, linked.pospal.syncedAt);
  assert.equal(member.profileRefreshState.fresh, false);
});


function detailPage(ctx, id = product.id) {
  const name = 'pages/nail-detail/nail-detail.vue';
  const page = ctx.load(name, ['loadProduct', 'product', 'loading', 'error', 'openAppointment', 'booking', 'imagePreview', 'backToCatalog']);
  ctx.hooks.get(name + ':load')({ id });
  return page;
}

test('detail direct entry reads public catalog only; invalid, removed and failed requests have distinct states', async (t) => {
  let reads = 0;
  const ctx = setup(t, { listCatalogProducts: async () => { reads++; return [product]; },
    getMyCachedProfile: async () => { throw Error('detail must not read member data'); } });
  const page = detailPage(ctx, ''); await page.loadProduct();
  assert.equal(reads, 0); assert.equal(page.product.value, null); assert.equal(page.error.value, '');
  ctx.hooks.get('pages/nail-detail/nail-detail.vue:load')({ id: product.id });
  await page.loadProduct(); assert.equal(page.product.value.id, product.id);
  ctx.api.listCatalogProducts = async () => { throw Error('offline'); };
  await page.loadProduct(); assert.match(page.error.value, /网络/); assert.equal(page.product.value, null);
  await page.openAppointment(); assert.equal(ctx.navigation.length, 0);
  ctx.api.listCatalogProducts = async () => [{ ...product, isActive: false }];
  await page.loadProduct(); assert.equal(page.error.value, ''); assert.equal(page.product.value, null);
  ctx.api.listCatalogProducts = async () => [product];
  await page.loadProduct(); assert.equal(page.product.value.id, product.id); assert.equal(ctx.payloads.length, 0);
});

test('detail rejects stale responses and ignores responses after page unload', async (t) => {
  const pending = [];
  const ctx = setup(t, { listCatalogProducts: () => new Promise(resolve => pending.push(resolve)) });
  const page = detailPage(ctx);
  const first = page.loadProduct(), second = page.loadProduct();
  pending[1]([product]); await second; pending[0]([]); await first;
  assert.equal(page.product.value.id, product.id);
  const third = page.loadProduct(); ctx.hooks.get('pages/nail-detail/nail-detail.vue:unload')();
  pending[2]([product]); await third; assert.equal(page.product.value, null);
});

test('detail native preview return skips reload once; later visits revalidate availability', async (t) => {
  let reads = 0;
  const ctx = setup(t, { listCatalogProducts: async () => { reads++; return [product]; } });
  const page = detailPage(ctx); const show = ctx.hooks.get('pages/nail-detail/nail-detail.vue')[0];
  await show(); page.imagePreview.start(); await show(); assert.equal(reads, 1);
  await show(); assert.equal(reads, 2);
});

test('detail booking reuses pending intent without submitting and prevents simultaneous taps', async (t) => {
  const ctx = setup(t, {}, linked); authorize(ctx);
  const page = detailPage(ctx); await page.loadProduct();
  await Promise.all([page.openAppointment(), page.openAppointment()]);
  assert.equal(ctx.navigation.length, 1);
  assert.equal(ctx.navigation[0], '/pages/appointment/appointment?booking=1');
  assert.equal(ctx.load('utils/booking-flow.ts').takePendingBooking('NAIL').product.id, product.id);
  assert.equal(ctx.payloads.length, 0); assert.equal(page.booking.value, false);
});

test('detail cancelled login never prepares or submits a booking; setup keeps chosen product', async (t) => {
  const cancelled = setup(t); cancelled.cancel();
  const first = detailPage(cancelled); await first.loadProduct(); await first.openAppointment();
  assert.equal(cancelled.navigation.length, 0); assert.equal(cancelled.payloads.length, 0); assert.equal(first.booking.value, false);
  const ctx = setup(t); const page = detailPage(ctx); await page.loadProduct(); await page.openAppointment();
  assert.equal(ctx.navigation.at(-1), '/pages/index/index');
  assert.equal(ctx.load('utils/booking-flow.ts').takePendingBooking('NAIL').product.id, product.id);
  assert.equal(ctx.payloads.length, 0);
});

test('return from detail refreshes selected category without removing visible catalog; failure retains it', async (t) => {
  let rejectRead; let category;
  const ctx = setup(t);
  const page = ctx.load('pages/nail/nail.vue', ['loadCatalog', 'openDetail', 'selectedCategoryId', 'products', 'loading', 'catalogError']);
  await page.loadCatalog(); page.selectedCategoryId.value = 'chosen';
  ctx.api.listCatalogProducts = (_, id) => { category = id; return new Promise((_, reject) => { rejectRead = reject; }); };
  page.openDetail(product);
  assert.equal(ctx.navigation.at(-1), '/pages/nail-detail/nail-detail?id=style-test');
  const refresh = ctx.hooks.get('pages/nail/nail.vue')[0]();
  assert.equal(page.loading.value, false); assert.equal(page.products.value[0].id, product.id); assert.equal(category, 'chosen');
  rejectRead(Error('offline')); await refresh;
  assert.equal(page.catalogError.value, ''); assert.equal(page.products.value[0].id, product.id);
});

test('detail with no prior page returns to original catalog route', (t) => {
  const ctx = setup(t); detailPage(ctx).backToCatalog();
  assert.equal(ctx.navigation[0], '/pages/nail/nail');
});

test('nail list can retry a failed photo and preview the chosen original without persisting a failure on new photos', async (t) => {
  const props = vue.reactive({ images: ['/uploads/original.jpg', '/uploads/side.jpg'], appearance: 'nail-list' });
  const ctx = setup(t, { props });
  const gallery = ctx.load('components/ProductGallery.vue', ['markFailed', 'retryImage', 'failedImages', 'preview']);
  await vue.nextTick();
  gallery.markFailed(1); assert.equal(gallery.failedImages.value[1], true);
  gallery.retryImage(1); assert.equal(gallery.failedImages.value[1], false);
  await gallery.preview(1); assert.equal(ctx.notices.at(-1).current, 'https://example.test/uploads/side.jpg');
  gallery.markFailed(0); props.images = ['/uploads/another.jpg']; await vue.nextTick();
  assert.equal(gallery.failedImages.value[0], undefined);
  assert.equal(ctx.payloads.length, 0);
});
