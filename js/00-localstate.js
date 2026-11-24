'use strict';

/* ============================================================
   LOCAL STATE — شمارنده تست و تایمر در IndexedDB، نه localStorage
   ============================================================
   فرادادهٔ سینک/احراز هویت در localStorage میماند؛ دادهٔ واقعی برنامه
   (tracker, timer) از طریق این ماژول در فروشگاه جداگانهٔ local-state
   ذخیره میشود. خواندن همزمان با cache است تا کد قدیمی بتواند همان
   توابع synchronously فراخوانی کند.
   ============================================================ */

(function(){
  const DB_NAME='konkur-student-db';
  const DB_VERSION=5;
  const STORE='local-state';
  /* کلیدهای قدیمی فقط برای مهاجرت یکباره ساخته میشوند؛ بهعنوان کلید ذخیرهٔ
     جدید استفاده نمیشوند. */
  const LEGACY_KEYS={
    tracker:'konkur-'+'trk-v1',
    timer:'konkur-'+'timer-v1'
  };

  const cache=Object.create(null);
  const dirty=new Set();
  let hydrating=null;
  let dbPromise=null;
  let writeQueue=Promise.resolve();
  let legacyMigrated=false;

  function getDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(typeof window==='undefined'||!window.indexedDB){reject(new Error('IndexedDB در دسترس نیست'));return;}
      const request=window.indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});
      };
      request.onsuccess=()=>{
        const db=request.result;
        db.onversionchange=()=>db.close();
        resolve(db);
      };
      request.onerror=()=>reject(request.error||new Error('بازکردن فروشگاه local-state ناموفق بود'));
      request.onblocked=()=>reject(new Error('بازکردن فروشگاه local-state مسدود شد'));
    });
    return dbPromise;
  }

  /* مهاجرت نسخهٔ قدیمی: مقدار localStorage خوانده، در cache گذاشته و کلید
     قدیمی بلافاصله حذف میشود تا دوباره مهاجرت نشود. */
  function migrateLegacy(){
    if(legacyMigrated)return;
    legacyMigrated=true;
    let storage=null;
    try{storage=window.localStorage;}catch(e){}
    if(!storage)return;
    Object.keys(LEGACY_KEYS).forEach(key=>{
      try{
        const raw=storage.getItem(LEGACY_KEYS[key]);
        if(raw==null)return;
        /* متن ذخیرهشدهٔ قدیمی همانگونه نگه داشته میشود؛ خوانندگان قبلاً
           JSON.parse میکنند و نباید شیٔ پارسشدهٔ دوباره پارس کنند. */
        if(!(key in cache))cache[key]=raw;
        storage.removeItem(LEGACY_KEYS[key]);
      }catch(error){
        console.warn('[localState] legacy migration failed:',error);
      }
    });
  }

  function putValue(key){
    return getDb().then(db=>new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      if(key in cache)tx.objectStore(STORE).put({id:key,value:cache[key]});
      else tx.objectStore(STORE).delete(key);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('نوشتن local-state ناموفق بود'));
      tx.onabort=()=>reject(tx.error||new Error('نوشتن local-state لغو شد'));
    }));
  }

  function flushMigrated(){
    const keys=Object.keys(cache);
    if(!keys.length)return Promise.resolve();
    return getDb().then(db=>new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      keys.forEach(key=>tx.objectStore(STORE).put({id:key,value:cache[key]}));
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('مهاجرت local-state ناموفق بود'));
      tx.onabort=()=>reject(tx.error||new Error('مهاجرت local-state لغو شد'));
    }));
  }

  function hydrate(){
    if(hydrating)return hydrating;
    migrateLegacy();
    const migrated=flushMigrated();
    hydrating=migrated.then(()=>getDb()).then(db=>new Promise((resolve,reject)=>{
      const request=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
      request.onsuccess=()=>{
        (request.result||[]).forEach(row=>{
          if(row&&row.id!=null&&!dirty.has(row.id)&&!(row.id in cache))cache[row.id]=row.value;
        });
        resolve(cache);
      };
      request.onerror=()=>reject(request.error||new Error('خواندن local-state ناموفق بود'));
    })).catch(error=>{
      console.warn('[localState] cache hydration failed:',error);
      return cache;
    });
    return hydrating;
  }

  function enqueue(task){
    writeQueue=writeQueue.then(task,task);
    return writeQueue.catch(()=>{});
  }

  function getSync(key){
    migrateLegacy();
    return key in cache?cache[key]:null;
  }
  function setSync(key,value){
    migrateLegacy();
    dirty.add(key);
    cache[key]=value;
    enqueue(()=>hydrate().then(()=>putValue(key)));
    return value;
  }
  function removeSync(key){ return setSync(key,null); }

  function get(key){ return hydrate().then(()=>key in cache?cache[key]:null); }
  function set(key,value){
    setSync(key,value);
    return writeQueue.then(()=>value);
  }

  if(typeof window!=='undefined'){
    window.localState={get,set,getSync,setSync,remove:removeSync,ready:hydrate};
  }
})();
