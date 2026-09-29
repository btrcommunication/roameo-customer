// Component behavior checks with mocked React Native and API responses.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setup({ id = '7', coupon, existing = [], fail = false } = {}) {
  const states = [], refs = [], effects = [], calls = [], pushed = [], added = [];
  let stateIndex = 0, refIndex = 0, initialized = false;
  const react = {
    useState(value) { const i = stateIndex++; if (!(i in states)) states[i] = value;
      return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useRef(value) { const i = refIndex++; return refs[i] ||= {current:value}; },
    useEffect(fn) { if (!initialized) effects.push(fn); },
  };
  const jsx = (type, props) => ({type,props});
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('app/listing-details.tsx','utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},
  }).outputText;
  const modules = {
    react,
    'react/jsx-runtime': {jsx,jsxs:jsx},
    'expo-router': {useLocalSearchParams:() => ({id}),useRouter:() => ({push:value => pushed.push(value),back(){}})},
    'react-native': new Proxy({Dimensions:{get:() => ({width:400})},StyleSheet:{create:v => v}}, {get:(target,key) => target[key] || key}),
    '@expo/vector-icons': {},
    '../constants/couponMedia': {couponImageUrl:value => value || '',isApprovedCoupon:c => Number(c.is_active) === 1 && Number(c.is_approved) === 1},
    '../constants/couponPrice': {formatCouponPrice:value => value == null ? 'No price' : `$${Number(value).toFixed(2)}`},
    '../constants/cart': {readCart:async () => existing,addCartItem:async item => {added.push(item);return true;}},
    '../hooks/useWishlist': {useWishlist:() => ({isSaved:() => false,ready:true,toggle(){}})},
    '../components/WishlistNotice': {WishlistNotice:'WishlistNotice'},
  };
  vm.runInNewContext(source, {
    exports,require:name => modules[name] || 'image',console,
    fetch:async url => {
      calls.push(url);
      return {ok:!fail,json:async () => ({status:fail ? 'error' : 'success',data:url.includes('?') ? [] : coupon})};
    },
  });
  function render() { stateIndex = 0;refIndex = 0;const tree = exports.default();initialized = true;return tree; }
  const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node)
    ? node.flatMap(walk) : [node,...walk(node.props?.children)];
  const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node)
    : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children);
  return {calls,pushed,added,render,walk,text,async load() {
    render();effects.forEach(fn => fn());
    await new Promise(resolve => setImmediate(resolve));
    return render();
  }};
}
const coupon = {id:7,title:'City Spa Coupon',price:'12.50',vendor_name:'City Spa',category_name:'Wellness',description:'Massage offer',is_active:1,is_approved:1,max_quantity:2};

test('details loads the selected coupon endpoint and displays its data', async () => {
  const app = setup({coupon});const tree = await app.load();
  assert.equal(app.calls[0],'https://roameomobileapp.braventra.in/api/coupons/7');
  for (const expected of ['City Spa Coupon','City Spa','Wellness','Massage offer','$12.50']) assert.ok(app.text(tree).includes(expected));
  assert.ok(!app.calls.some(url => url.includes('/api/listings')));
});
test('get coupon adds selected coupon then opens checkout', async () => {
  const app = setup({coupon});const tree = await app.load();
  const button = app.walk(tree).find(node => node.type === 'TouchableOpacity' && app.text(node).includes('Get Coupon -'));
  await button.props.onPress();
  assert.equal(app.added[0].id,7);
  assert.equal(app.pushed[0].pathname,'/(tabs)/cart');
  assert.ok(app.pushed[0].params.checkout);
});
test('checkout does not add an already saved coupon again', async () => {
  const app = setup({coupon,existing:[{coupon_id:7}]});const tree = await app.load();
  await app.walk(tree).find(node => node.type === 'TouchableOpacity' && app.text(node).includes('Get Coupon -')).props.onPress();
  assert.equal(app.added.length,0);assert.equal(app.pushed.length,1);
});
test('failed or missing coupon IDs show an error and no purchase action', async () => {
  for (const options of [{coupon,fail:true},{coupon,id:''},{coupon,id:'invalid'}]) {
    const app = setup(options);const tree = await app.load();
    assert.ok(app.text(tree).includes('Coupon details unavailable'));
    assert.ok(!app.text(tree).includes('Get Coupon -'));
  }
});
test('inactive coupon cannot start checkout; missing price stays explicit', async () => {
  const app = setup({coupon:{...coupon,is_active:0,price:null}});const tree = await app.load();
  assert.ok(app.text(tree).includes('No price'));
  const button = app.walk(tree).find(node => node.type === 'TouchableOpacity' && app.text(node) === 'Unavailable');
  assert.equal(button.props.disabled,true);
  await button.props.onPress();assert.equal(app.added.length,0);assert.equal(app.pushed.length,0);
});
