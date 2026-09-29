const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { priceCart } = require('./coupon-pricing');

test('frontend shows missing prices explicitly and preserves zero and decimal prices', () => {
  const ts = require('typescript');
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('constants/couponPrice.ts','utf8'), {
    compilerOptions: {module:ts.ModuleKind.CommonJS},
  }).outputText;
  vm.runInNewContext(source,{exports});
  for (const value of [null,undefined,'',' ',false,-1,'abc']) assert.equal(exports.formatCouponPrice(value),'No price');
  assert.equal(exports.formatCouponPrice(0),'$0.00');
  assert.equal(exports.formatCouponPrice('12.50'),'$12.50');
});

test('decimal prices, quantity totals and explicit free coupons', () => {
  const result = priceCart([{price:'10.25',quantity:3}, {price:'0.10',quantity:3}, {price:0,quantity:2}]);
  assert.equal(result.total_amount,31.05);
  assert.equal(result.items[0].subtotal,30.75);
  assert.equal(result.items[2].pricing_configured,true);
});
test('missing or invalid prices never become free', () => {
  for (const price of [null,undefined,'',' ',false,-1,'abc',Infinity]) {
    const result = priceCart([{price,quantity:1}]);
    assert.equal(result.total_amount,null);
    assert.equal(result.items[0].pricing_configured,false);
  }
});

function setup(rows, failWrite = '') {
  const routes = {}, writes = [], events = [], middleware = [];
  let cart = rows, orders = [], stagedCart, stagedOrders;
  const router = { use(fn) { middleware.push(fn); } };
  for (const method of ['get','post','put','delete']) router[method] = (path, handler) => { routes[method+path] = handler; };
  const query = async (sql, args) => {
    if (sql.startsWith('SELECT') && sql.includes('FROM coupon_cart')) { assert.equal(args[0],42); return [stagedCart]; }
    if (sql.includes('FROM coupon_orders')) {
      const data = sql.includes('FOR UPDATE') ? stagedOrders : orders;
      return [data.filter(order => order.user_id === args[0] && (args.length === 1 || order.request_id === args[1]))];
    }
    if (sql.startsWith(failWrite || 'NEVER')) throw new Error('Database unavailable');
    writes.push(args);
    if (sql.startsWith('INSERT INTO coupon_orders')) {
      const [user_id,items,total_items,total_amount,currency,request_id] = args;
      stagedOrders.push({id:stagedOrders.length+1,user_id,items,total_items,total_amount,currency,request_id,
        status:'placed',payment_status:'pending',created_at:'2026-09-11T10:00:00.000Z'});
      return [{insertId:stagedOrders.length}];
    }
    if (sql.startsWith('DELETE FROM coupon_cart')) { assert.deepEqual([...args],[42]); stagedCart=[]; }
    return [{}];
  };
  const db = {
    beginTransaction: async () => {events.push('begin'); stagedCart=[...cart]; stagedOrders=[...orders];},
    commit: async () => {events.push('commit'); cart=stagedCart; orders=stagedOrders;},
    rollback: async () => events.push('rollback'), release: () => events.push('release'), query,
  };
  vm.runInNewContext(fs.readFileSync('backend/routes/cartroutes.js','utf8'), {
    require: name => name === 'express' ? {Router:() => router} : name.includes('config/db') ? {getConnection:async () => db,query}
      : () => {}, module:{}, console:{error(){}},
  });
  async function call(route, user, body) {
    const res = {code:200,status(code){this.code=code;return this;},json(body){this.body=body;}};
    const req = {user:{id:user},body};
    let authorized = false;
    middleware[1](req,res,() => {authorized=true;});
    if (authorized) await routes[route](req,res);
    return res;
  }
  return {writes,events,get cart(){return cart;},get orders(){return orders;},
    refill(next){cart=next;},
    checkout(request_id='checkout-test-123'){return call('post/checkout',42,{request_id,user_id:99,total_amount:0});},
    history(user){return call('get/orders',user,{});}};
}
const coupon = {coupon_id:7,title:'Offer',price:'12.50',quantity:2,max_quantity:3,is_active:1,is_approved:1,valid_now:1};
test('order persists authenticated customer and server prices, and clears cart on commit', async () => {
  const app = setup([coupon]);
  const response = await app.checkout();
  assert.equal(response.code,200);
  assert.equal(response.body.data.status,'placed');
  assert.equal(response.body.data.payment_status,'pending');
  assert.equal(response.body.data.id,'1');
  assert.equal(app.writes[0][0],42);
  assert.equal(app.writes[0][3],25);
  assert.equal(JSON.parse(app.writes[0][1])[0].subtotal,25);
  assert.equal(app.cart.length,0);
  assert.equal(app.orders.length,1);
  assert.deepEqual(app.events,['begin','commit','release']);
});
test('reject empty, unpriced, expired, inactive and over-limit carts without saving or clearing', async () => {
  for (const rows of [[],[{...coupon,price:null}],[{...coupon,valid_now:0}],[{...coupon,is_active:0}], [{...coupon,is_approved:0}],[{...coupon,quantity:4}]]) {
    const app = setup(rows);
    assert.equal((await app.checkout()).code,400);
    assert.equal(app.writes.length,0);
    assert.deepEqual(app.cart,rows);
    assert.deepEqual(app.events,['begin','rollback','release']);
  }
});
test('failed order insertion or cart deletion rolls back both changes', async () => {
  for (const failure of ['INSERT','DELETE']) {
    const app = setup([coupon],failure);
    assert.equal((await app.checkout()).code,500);
    assert.equal(app.orders.length,0);
    assert.equal(app.cart.length,1);
    assert.deepEqual(app.events,['begin','rollback','release']);
  }
});
test('retry returns the same order and separate purchases preserve previous orders', async () => {
  const app = setup([coupon]);
  const first = await app.checkout();
  const retry = await app.checkout();
  assert.equal(retry.body.data.id,first.body.data.id);
  assert.equal(app.orders.length,1);
  app.refill([{...coupon,title:'New title',price:'20.00'}]);
  await app.checkout('checkout-second-123');
  assert.equal(app.orders.length,2);
  const history = await app.history(42);
  assert.equal(history.body.data.orders[0].items[0].title,'Offer');
  assert.equal(history.body.data.orders[0].total_amount,25);
  assert.equal(history.body.data.orders[1].total_amount,40);
  assert.equal((await app.history(99)).body.data.orders.length,0);
  assert.equal((await app.history(undefined)).code,401);
});
test('invalid request IDs never begin checkout', async () => {
  const app = setup([coupon]);
  for (const id of [null,'short','contains invalid spaces',{},'x'.repeat(65)]) {
    assert.equal((await app.checkout(id)).code,400);
  }
  assert.equal(app.events.length,0);
});
