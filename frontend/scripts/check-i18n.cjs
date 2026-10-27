const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const cache=new Map();
let stored=null,denyWrite=false,denyRead=false;
const events=new EventTarget();
const window={localStorage:{getItem(){if(denyRead)throw Error('blocked');return stored;},setItem(key,value){if(denyWrite)throw Error('quota');stored=value;}},addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events)};
function load(name){
  if(cache.has(name))return cache.get(name);
  const filename=path.join(__dirname,'../lib',`${name}.ts`);
  const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(source,{exports:module.exports,require:ref=>load(ref.replace('./','')),Intl,Date,window,Event},{filename});
  cache.set(name,module.exports);
  return module.exports;
}
const {translateText:t,isLocale,teachingLanguages}=load('i18n');
const {monthTitle,selectedDateLabel,dateTime}=load('dates');
const {translations}=load('translations');
assert.equal(t('Kirish','uz'),'Kirish');
assert.equal(t('Kirish','en'),'Sign in');
assert.equal(t('Kirish','ru'),'Войти');
assert.equal(t('Salom, Ramazon','en'),'Hello, Ramazon');
assert.equal(t('0 ta e’lon','en'),'0 listings');
assert.equal(t('1 ta e’lon','en'),'1 listing');
assert.equal(t('12 ta e’lon · shaxsiy e’loningiz bilan','ru'),'Объявлений: 12 · включая ваше личное объявление');
assert.equal(t('Onlayn · 50 daqiqa','en'),'Online · 50 minutes');
assert.equal(t('Xitoy tili','en'),'Chinese');
assert.equal(t('International Programs','ru'),'Международные программы');
assert.equal(t('Admissions','ru'),'Поступление');
assert.equal(t('My custom biography','ru'),'My custom biography');
assert.equal(t(42,'en'),42);
assert.equal(isLocale('zh'),false);
assert.equal(isLocale('ru'),true);
assert.equal(monthTitle(new Date(2026,9,1),'en'),'October 2026');
assert.match(selectedDateLabel('2026-10-22','ru'),/октября/);
assert.match(dateTime('2026-10-22T23:30:00Z','Asia/Tashkent','en'),/23 October 2026.*04:30/);
for(const [key,values] of Object.entries(translations)){
  assert.equal(values.length,2,key);
  const placeholders=(value)=>[...value.matchAll(/\{\w+\}/g)].map(match=>match[0]).sort();
  for(const value of values){assert.ok(value.trim(),key);assert.deepEqual(placeholders(value),placeholders(key),key);}
}
console.log('Translation, interpolation, subject labels and timezone/date checks passed.');

assert.equal(teachingLanguages('O‘zbekcha, English, Ruscha','en'),'Uzbek, English, Russian');
assert.equal(teachingLanguages('O‘zbekcha, English','ru'),'Узбекский, Английский');
const store=load('locale-store');
assert.equal(store.serverLocaleSnapshot(),'uz');
stored='ru';assert.equal(store.localeSnapshot(),'ru','Reload reads saved language');
let changes=0;const stop=store.subscribeLocale(()=>changes++);
store.setLocale('en');assert.equal(store.localeSnapshot(),'en');assert.equal(changes,1);
denyWrite=true;store.setLocale('uz');assert.equal(store.localeSnapshot(),'uz','Quota failure must not restore the stale stored locale');
denyRead=true;store.setLocale('ru');assert.equal(store.localeSnapshot(),'ru','Blocked storage still allows switching');
denyRead=false;denyWrite=false;
const storageEvent=(key)=>{const event=new Event('storage');event.key=key;window.dispatchEvent(event);};
stored='en';storageEvent('eduyor.locale.v1');assert.equal(store.localeSnapshot(),'en','Other tab language changes synchronize');
stored=null;storageEvent(null);assert.equal(store.localeSnapshot(),'uz','Cleared storage resets consistently');
stored='invalid';assert.equal(store.localeSnapshot(),'uz');
const before=changes;storageEvent('unrelated');assert.equal(changes,before);stop();
store.setLocale('en');assert.equal(changes,before,'Subscription cleans up');
console.log('Locale persistence, cross-tab synchronization, invalid values and unavailable storage checks passed.');

assert.equal(t('1 ta taklif','en'),'1 offer');
assert.equal(t('12 ta taklif','ru'),'Предложений: 12');
assert.equal(t('Ochiq so‘rovlar','en'),'Open requests');
assert.equal(t('Tasdiqlash va bron qilish','ru'),'Подтвердить и забронировать');
assert.equal(t('Student-authored IELTS request','en'),'Student-authored IELTS request');
console.log('Request navigation, offer counts and booking labels translate correctly.');

assert.equal(t('3 / 5 to‘g‘ri','en'),'3 / 5 correct');
assert.equal(t('2 ta dars to‘lovni kutmoqda. To‘lov farzandingiz hisobidagi dars sahifasida tasdiqlanadi.','ru'),'Уроков ждут оплаты: 2. Оплата подтверждается на странице урока в аккаунте ребёнка.');
console.log('Parent progress counts translate correctly.');

assert.equal(t('3 ta mentor','ru'),'Менторов: 3');
assert.equal(t('Manzil: Offline markaz uchun shahar va manzilni kiriting.','en'),'Address: Enter the city and address for an offline center.');
console.log('Learning center counts and field errors translate correctly.');

assert.equal(t('12 ta dars','en'),'Lessons: 12');
assert.equal(t('1 ta dars to‘lovni kutmoqda. To‘lov farzandingiz hisobidagi dars sahifasida tasdiqlanadi.','en'),'Lessons awaiting payment: 1. Payment is confirmed on the lesson page in your child’s account.');
console.log('Leaderboard lesson counts translate without clashing with longer keys.');
