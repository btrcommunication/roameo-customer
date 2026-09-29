const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const coupon = {listing_id:7,coupon_id:7,title:'Weekend offer',quantity:2,price:12.5,final_price:12.5,subtotal:25};
const order = {id:'123',items:[coupon],total_items:2,total_amount:25,currency:'USD',status:'placed',payment_status:'pending',created_at:'2026-09-11T10:00:00Z'};
const flush = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };

function screen(file, {fail=false, history=[order], params={}} = {}) {
  const states=[], refs=[], effects=[], focus=[], calls=[], pushed=[];
  let stateIndex=0,refIndex=0,mounted=false;
  const react = {
    useState(value){const i=stateIndex++; if (!(i in states)) states[i]=value; return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];},
    useRef(value){return refs[refIndex++] ||= {current:value};},
    useCallback(fn){return fn;},
    useEffect(fn){if(!mounted)effects.push(fn);},
  };
  const jsx=(type,props)=>({type,props});
  const modules={
    react,'react/jsx-runtime':{jsx,jsxs:jsx},'@expo/vector-icons':{Ionicons:'Icon'},
    'react-native':new Proxy({StyleSheet:{create:x=>x},Alert:{alert(){}}},{get:(o,k)=>o[k]||k}),
    'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
    'expo-router':{useFocusEffect:fn=>{if(!mounted)focus.push(fn);},useLocalSearchParams:()=>params,
      useRouter:()=>({push:x=>pushed.push(x),setParams(){},canGoBack:()=>false,replace(){}})},
    '../../constants/cart':{readCart:async()=>[coupon],isDemoSession:async()=>false,subscribeCartChanges:()=>()=>{}},
    '../../constants/orders':{readOrders:async()=>{if(fail)throw Error('Orders unavailable');return history;},subscribeOrders:()=>()=>{},
      placeOrder:async key=>{calls.push(key);if(fail)throw Error('Could not place order');return order;}},
  };
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020},
  }).outputText,{exports,require:name=>modules[name]||'image',console,Error});
  function render(){stateIndex=0;refIndex=0;const tree=exports.default();mounted=true;return tree;}
  const walk=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(walk)
    :node.type==='Modal'&&!node.props.visible?[]:[node,...walk(node.props?.children)];
  const text=node=>node==null||typeof node==='boolean'?'':typeof node!=='object'?String(node)
    :Array.isArray(node)?node.map(text).join(' '):node.type==='Modal'&&!node.props.visible?'':text(node.props?.children);
  async function click(label){const button=walk(render()).find(n=>n.type==='TouchableOpacity'&&text(n).trim()===label);
    assert.ok(button,`Missing button: ${label}`); assert.ok(!button.props.disabled);await button.props.onPress();await flush();}
  return {render,text,walk,click,calls,pushed,async start(){render();focus.forEach(fn=>fn());effects.forEach(fn=>fn());await flush();}};
}

test('place order closes checkout, clears its items and keeps original totals in green confirmation',async()=>{
  const app=screen('app/(tabs)/cart.tsx');await app.start();
  await app.click('Proceed to Checkout');
  assert.match(app.text(app.render()),/Place order/);
  await app.click('Place order');
  const tree=app.render();
  assert.match(app.text(tree),/Your Cart is Empty/);
  assert.match(app.text(tree),/Order placed!/);
  assert.match(app.text(tree),/\$\s*25\.00/);
  const title=app.walk(tree).find(n=>n.type==='Text'&&app.text(n)==='Order placed!');
  assert.equal(title.props.style[1].color,'#15803D');
  assert.ok(!app.text(tree).includes('Proceed to Checkout'));
  assert.equal(app.calls.length,1);
  await app.click('View order');
  assert.equal(app.pushed[0].pathname,'/(tabs)/orders');
  assert.equal(app.pushed[0].params.orderId,'123');
});

test('failed order leaves checkout intact and retries with the same request ID',async()=>{
  const app=screen('app/(tabs)/cart.tsx',{fail:true});await app.start();
  await app.click('Proceed to Checkout');await app.click('Place order');
  assert.match(app.text(app.render()),/Could not place order/);
  assert.match(app.text(app.render()),/Weekend offer/);
  assert.ok(!app.text(app.render()).includes('Order placed!'));
  await app.click('Place order');
  assert.equal(app.calls.length,2);assert.equal(app.calls[0],app.calls[1]);
});

test('orders uses real history, filters statuses and opens the matching order details',async()=>{
  const app=screen('app/(tabs)/orders.tsx');await app.start();
  assert.match(app.text(app.render()),/Weekend offer/);
  assert.ok(!app.text(app.render()).includes('Bistro House'));
  await app.click('View Details');assert.match(app.text(app.render()),/Total:\s+\$25\.00/);
  app.walk(app.render()).find(n=>n.props?.accessibilityLabel==='Close order details').props.onPress();
  await app.click('Completed');assert.match(app.text(app.render()),/No completed orders/);
});

test('orders distinguishes empty history and API failures',async()=>{
  const empty=screen('app/(tabs)/orders.tsx',{history:[]});await empty.start();
  assert.match(empty.text(empty.render()),/No orders yet/);
  const failed=screen('app/(tabs)/orders.tsx',{fail:true});await failed.start();
  assert.match(failed.text(failed.render()),/Orders unavailable/);
  assert.ok(!failed.text(failed.render()).includes('No orders yet'));
});

test('orders opens the order selected from the checkout confirmation',async()=>{
  const app=screen('app/(tabs)/orders.tsx',{params:{orderId:'123'}});await app.start();
  assert.match(app.text(app.render()),/Order details/);
  assert.match(app.text(app.render()),/Total:\s+\$25\.00/);
});
