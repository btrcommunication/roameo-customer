// Run: node backend/wishlist.test.cjs (no running database required).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const routes = {}, middleware = [], saved = new Map();
  const coupons = new Map([[7, { id: 7, title: 'Offer', vendor_name: 'Vendor Seven', is_active: 1, is_approved: 1, private_note: 'hidden' }]]);
  const router = { use: fn => middleware.push(fn) };
  ['get', 'post', 'delete'].forEach(method => { router[method] = (path, fn) => { routes[method + path] = fn; }; });
  const pool = { query: async (sql, values) => {
    const [user, id] = values, key = `${user}:${id}`;
    if (sql.startsWith('INSERT')) {
      const coupon = coupons.get(id);
      if (coupon?.is_active === 1 && coupon.is_approved === 1) saved.set(key, { user, coupon_id: id });
      return [{}];
    }
    if (sql.startsWith('DELETE')) {
      if (values.length === 1) { for (const [key, row] of saved) if (row.user === user) saved.delete(key); }
      else saved.delete(key);
      return [{}];
    }
    if (sql.includes('JOIN coupons')) return [[...saved.values()].filter(row => row.user === user && coupons.has(row.coupon_id))];
    return [saved.has(key) ? [saved.get(key)] : []];
  } };
  vm.runInNewContext(fs.readFileSync('backend/routes/wishlistroutes.js', 'utf8'), {
    require: name => name === 'express' ? { Router: () => router } : name.includes('config/db') ? pool
      : name.includes('middleware/auth') ? (_req, _res, next) => next()
      : { findById: async id => coupons.get(id) }, module: {}, console,
  });
  async function call(method, user, body = {}, params = {}) {
    const req = { user: { id: user }, body, params };
    const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
    let authorized = false;
    middleware[1](req, res, () => { authorized = true; });
    if (authorized) await routes[method](req, res);
    return res;
  }
  return { call, coupons };
}

test('wishlist persists saves, deduplicates, isolates customers, and removes only owned rows', async () => {
  const { call } = setup();
  assert.equal((await call('post/', 1, { coupon_id: 7, user_id: 2 })).code, 200);
  await call('post/', 1, { coupon_id: 7 });
  let result = await call('get/', 1);
  assert.equal(result.body.data.total, 1);
  assert.equal(result.body.data.items[0].vendor_name, 'Vendor Seven');
  assert.equal(result.body.data.items[0].private_note, undefined);
  assert.equal((await call('get/', 2)).body.data.total, 0);
  await call('delete/:coupon_id', 2, {}, { coupon_id: 7 });
  assert.equal((await call('get/', 1)).body.data.total, 1);
  await call('delete/:coupon_id', 1, {}, { coupon_id: 7 });
  assert.equal((await call('get/', 1)).body.data.total, 0);
});

test('rejects missing identity, bad IDs and unavailable coupons', async () => {
  const { call, coupons } = setup();
  assert.equal((await call('get/', undefined)).code, 401);
  for (const id of [0, -1, '7 OR 1=1', {}, 1.5]) assert.equal((await call('post/', 1, { coupon_id: id })).code, 400);
  assert.equal((await call('post/', 1, { coupon_id: 99 })).code, 404);
  coupons.get(7).is_approved = 0;
  assert.equal((await call('post/', 1, { coupon_id: 7 })).code, 404);
});

test('client requires real login, sends coupon IDs and notifies only on successful saves', async () => {
  const ts = require('typescript');
  const api = {}, calls = [];
  let token = null, ok = true, notifications = 0;
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('constants/wishlist.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: false },
  }).outputText, {
    exports: api,
    require: name => name.includes('async-storage') ? { default: { getItem: async () => token } } : { couponImageUrl: value => value },
    fetch: async (url, options) => { calls.push({ url, options }); return { ok, status: ok ? 200 : 500, json: async () => ({ status: ok ? 'success' : 'error', data: { items: [{ id: '7', title: 'Offer' }] } }) }; },
  });
  await assert.rejects(api.readWishlist(), api.WishlistLoginError);
  token = 'demo-token'; await assert.rejects(api.readWishlist(), api.WishlistLoginError);
  assert.equal(calls.length, 0);
  token = 'customer-token';
  assert.equal((await api.readWishlist())[0].id, 7);
  api.subscribeWishlist(() => notifications++);
  await api.setWishlistSaved(7, true);
  assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer customer-token');
  assert.equal(calls.at(-1).options.body, '{"coupon_id":7}');
  assert.equal(notifications, 1);
  ok = false; await assert.rejects(api.setWishlistSaved(7, false));
  assert.equal(notifications, 1);
  ok = true; await api.setWishlistSaved(7, false);
  assert.equal(calls.at(-1).options.method, 'DELETE');
  assert.ok(calls.at(-1).url.endsWith('/7'));
  const beforeClear = notifications;
  ok = false; await assert.rejects(api.clearWishlist());
  assert.equal(notifications,beforeClear);
  ok = true; await api.clearWishlist();
  assert.equal(calls.at(-1).url,'https://roameomobileapp.braventra.in/api/wishlist');
  assert.equal(calls.at(-1).options.method,'DELETE');
  assert.equal(notifications,beforeClear+1);
});

test('remove all clears only the authenticated customer wishlist and is safe to repeat', async () => {
  const {call,coupons} = setup();
  coupons.set(8,{id:8,title:'Another',is_active:1,is_approved:1});
  for (const id of [7,8]) await call('post/',1,{coupon_id:id});
  await call('post/',2,{coupon_id:7});
  assert.equal((await call('delete/',undefined)).code,401);
  assert.equal((await call('delete/',1,{user_id:2})).code,200);
  assert.equal((await call('get/',1)).body.data.total,0);
  assert.equal((await call('get/',2)).body.data.total,1);
  assert.equal((await call('delete/',1)).code,200);
});
