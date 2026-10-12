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
  let serverProfile = initialProfile;
  let accept = true;
  const uni = {
    getStorageSync: (key) => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
    navigateTo: (options) => { navigation.push(options.url); options.complete?.(); },
    switchTab: (options) => { navigation.push(options.url); options.complete?.(); },
    showModal: (options) => { notices.push(options); options.success?.({ confirm: accept }); },
    showToast: (options) => notices.push(options),
    showLoading() {}, hideLoading() {},
    login: (options) => options.success({ code: 'test-login-code' }),
  };
  const api = {
    getMyProfile: async () => serverProfile,
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
    source = source.replaceAll('import.meta.env', '({})');
    if (exportsToExpose.length) source += `\nexport { ${exportsToExpose.join(', ')} };`;
    const code = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
    const exports = {};
    cache.set(name, exports);
    const requireModule = (dependency) => {
      if (dependency === 'vue') return vue;
      if (dependency === '@/store/session') return sessionModule;
      if (dependency === '@/utils/api') return api;
      if (dependency === '@/utils/image-cache') return { resolveImageForDisplay: async (source, fallback) => source || fallback };
      if (dependency === '@dcloudio/uni-app') return { onShow: (hook) => pageHooks.push(hook), onLoad() {} };
      if (dependency.endsWith('.vue')) return {};
      if (dependency.startsWith('@/')) return load(dependency.slice(2) + '.ts');
      throw new Error(`Unexpected dependency: ${dependency}`);
    };
    scope.run(() => vm.runInNewContext(code, { exports, require: requireModule, uni, console, Date, setTimeout }));
    hooks.set(name, pageHooks);
    return exports;
  }
  return { session, api, load, navigation, notices, payloads, hooks, cancel: () => { accept = false; } };
}

const product = { id: 'style-test', name: '月光晕染', images: [], businessType: 'NAIL' };
const linked = { id: 'member-a', phone: '13800138000', nickname: '会员', balance: 80, points: 20,
  pospal: { state: 'LINKED', customerNumber: 'VIP-008', syncedAt: '2026-10-10T08:00:00Z' } };

function authorize(ctx) {
  const member = ctx.load('utils/member.ts');
  member.setLegalConsent(true);
  return member;
}

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
