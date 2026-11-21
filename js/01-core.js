'use strict';

/* ============================================================
   CORE — تقویم، state، helperها، زمان، modal، profile
   نسخه ۰.۹.۴ — state.sessions جایگزین plan/reserved
   ============================================================ */

const APP_VERSION = '0.9.4';
if (typeof window !== 'undefined') window.APP_VERSION = APP_VERSION;

/* ============ JALALI ============ */
const div=(a,b)=>Math.trunc(a/b);const mod=(a,b)=>a-Math.trunc(a/b)*b;
function jalCal(jy,withoutLeap){const breaks=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];const bl=breaks.length;let gy=jy+621,leapJ=-14,jp=breaks[0],jm,jump=0,leap=0,leapG,march,n,i;for(i=1;i<bl;i++){jm=breaks[i];jump=jm-jp;if(jy<jm)break;leapJ=leapJ+div(jump,33)*8+div(mod(jump,33),4);jp=jm;}n=jy-jp;leapJ=leapJ+div(n,33)*8+div(mod(n,33)+3,4);if(mod(jump,33)===4&&jump-n===4)leapJ+=1;leapG=div(gy,4)-div((div(gy,100)+1)*3,4)-150;march=20+leapJ-leapG;if(!withoutLeap){if(jump-n<6)n=n-jump+div(jump+4,33)*33;leap=mod(mod(n+1,33)-1,4);if(leap===-1)leap=4;}return{leap,gy,march};}
function g2d(gy,gm,gd){let d=div((gy+div(gm-8,6)+100100)*1461,4)+div(153*mod(gm+9,12)+2,5)+gd-34840408;d=d-div(div(gy+100100+div(gm-8,6),100)*3,4)+752;return d;}
function d2g(jdn){let j=4*jdn+139361631;j=j+div(div(4*jdn+183187720,146097)*3,4)*4-3908;const i=div(mod(j,1461),4)*5+308;const gd=div(mod(i,153),5)+1;const gm=mod(div(i,153),12)+1;const gy=div(j,1461)-100100+div(8-gm,6);return{gy,gm,gd};}
function j2d(jy,jm,jd){const r=jalCal(jy,true);return g2d(r.gy,3,r.march)+(jm-1)*31-div(jm,7)*(jm-7)+jd-1;}
function d2j(jdn){const gy=d2g(jdn).gy;let jy=gy-621;const r=jalCal(jy,false);const jdn1f=g2d(gy,3,r.march);let k=jdn-jdn1f,jm,jd;if(k>=0){if(k<=185){jm=1+div(k,31);jd=mod(k,31)+1;return{jy,jm,jd};}else k-=186;}else{jy-=1;k+=179;if(r.leap===1)k+=1;}jm=7+div(k,30);jd=mod(k,30)+1;return{jy,jm,jd};}
const MONTHS=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const DOW=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
const DOW_SHORT=['ش','ی','د','س','چ','پ','ج'];
const jdnToDate=(jdn)=>{const g=d2g(jdn);return new Date(g.gy,g.gm-1,g.gd);};
const dowIndex=(jdn)=>(jdnToDate(jdn).getDay()+1)%7;
const isLeapJ=(jy)=>jalCal(jy,false).leap===0;
function jMonthLength(jy,jm){if(jm<=6)return 31;if(jm<=11)return 30;return isLeapJ(jy)?30:29;}
const pad2=(n)=>String(n).padStart(2,'0');
const keyOf=(jy,jm,jd)=>`${jy}/${pad2(jm)}/${pad2(jd)}`;
const jKey=(j)=>keyOf(j.jy,j.jm,j.jd);
const parseKey=(k)=>{const p=String(k).split('/').map(Number);return{jy:p[0],jm:p[1],jd:p[2]};};
const NOW=new Date();
const TODAY_JDN=g2d(NOW.getFullYear(),NOW.getMonth()+1,NOW.getDate());
const TODAY_J=d2j(TODAY_JDN);
const TODAY_KEY=jKey(TODAY_J);
const KONKUR_JDN=j2d(1406,4,11);
const FA_DIGITS='۰۱۲۳۴۵۶۷۸۹';
const fa=(n)=>String(n).replace(/\d/g,(d)=>FA_DIGITS[+d]);
const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const weekStartJdn=(jdn)=>jdn-((jdnToDate(jdn).getDay()+1)%7);
function weekKeysOf(jdn){const s=weekStartJdn(jdn);return Array.from({length:7},(_,i)=>jKey(d2j(s+i)));}
function dayLabel(jdn){const j=d2j(jdn);return`${DOW[dowIndex(jdn)]} ${fa(j.jd)} ${MONTHS[j.jm-1]} ${fa(j.jy)}`;}
function weekLabel(jdn){const s=weekStartJdn(jdn);const a=d2j(s),b=d2j(s+6);return`${fa(a.jd)} ${MONTHS[a.jm-1]} تا ${fa(b.jd)} ${MONTHS[b.jm-1]} ${fa(b.jy)}`;}
function jdnFromKey(k){const j=parseKey(k);return j2d(j.jy,j.jm,j.jd);}
function keyLabel(k){const j=parseKey(k);if(isNaN(j.jd)||isNaN(j.jm)||j.jm<1||j.jm>12)return String(k);return`${fa(j.jd)} ${MONTHS[j.jm-1]} ${fa(j.jy)}`;}
function gDateInputToKey(val){if(!val)return TODAY_KEY;const[gy,gm,gd]=val.split('-').map(Number);if(!gy||!gm||!gd)return TODAY_KEY;return jKey(d2j(g2d(gy,gm,gd)));}
function dateStrToKey(v){if(!v)return TODAY_KEY;const[a,b,c]=v.split('-').map(Number);if(!a||!b||!c)return TODAY_KEY;const j=d2j(g2d(a,b,c));return`${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`;}

function safeReviewDateLabel(dateStr){
  if(dateStr==null) return '';
  const str=String(dateStr).trim();
  if(!str) return '';
  if(/^\d+\/\d+\/\d+$/.test(str)){
    try{
      const j=parseKey(str);
      if(!isNaN(j.jy)&&!isNaN(j.jm)&&!isNaN(j.jd)&&j.jm>=1&&j.jm<=12&&j.jd>=1&&j.jd<=31){
        return `${fa(j.jd)} ${MONTHS[j.jm-1].slice(0,4)}`;
      }
    }catch(e){
      console.warn('[core] parse date failed:', e);
    }
  }
  return str;
}

/* ============ PROFILE / FIELDS ============ */
const FIELDS = ['تجربی', 'ریاضی', 'انسانی'];
const PROFILE_GRADES = ['دهم', 'یازدهم', 'دوازدهم'];

function defaultProfile() {
  return { id: '', email: '', role: 'student', firstName: '', lastName: '', field: 'تجربی', grade: 'دوازدهم' };
}

function normalizeProfile(p) {
  if (!p || typeof p !== 'object') return defaultProfile();
  return {
    id: String(p.id || ''),
    email: String(p.email || '').trim().toLowerCase().slice(0, 100),
    role: 'student',
    firstName: String(p.firstName || '').trim().slice(0, 40),
    lastName: String(p.lastName || '').trim().slice(0, 40),
    field: FIELDS.includes(p.field) ? p.field : 'تجربی',
    grade: PROFILE_GRADES.includes(p.grade) ? p.grade : 'دوازدهم'
  };
}

function profileLabel() {
  const p = state.profile || {};
  const parts = [];
  if (p.firstName) parts.push(p.firstName);
  if (p.grade) parts.push(p.grade);
  if (p.field) parts.push(p.field);
  return parts.join(' • ') || 'مسیر کنکور';
}

const FIELD_SPECIALIZED_SUBJECTS_BY_GRADE = {
  'تجربی': {
    'دهم': ['زیست', 'فیزیک', 'شیمی', 'ریاضی'],
    'یازدهم': ['زیست', 'فیزیک', 'شیمی', 'ریاضی', 'زمین‌شناسی'],
    'دوازدهم': ['زیست', 'فیزیک', 'شیمی', 'ریاضی']
  },
  'ریاضی': {
    'دهم': ['ریاضی', 'هندسه', 'فیزیک', 'شیمی'],
    'یازدهم': ['ریاضی', 'هندسه', 'فیزیک', 'شیمی', 'آمار و احتمال'],
    'دوازدهم': ['ریاضی', 'هندسه', 'فیزیک', 'شیمی', 'ریاضیات گسسته']
  },
  'انسانی': {
    'دهم': ['تاریخ', 'امرارات اجتماعی', 'جغرافیا', 'مصارف'],
    'یازدهم': ['تاریخ', 'امرافت همگی', 'زمین‌شناسی', 'مصارف', 'حقوق انسانی'],
    'دوازدهم': ['تاریخ', 'امرافت همگی', 'ادبیات', 'مصارف', 'حقوق']
  }
};

const FIELD_SPECIALIZED_SUBJECTS = Object.fromEntries(
  FIELDS.map(field=>[
    field,
    [...new Set(PROFILE_GRADES.flatMap(grade=>FIELD_SPECIALIZED_SUBJECTS_BY_GRADE[field][grade]))]
  ])
);

function fieldSpecializedSubjects(field,grade){
  const maxGradeIndex=PROFILE_GRADES.indexOf(grade);
  if(maxGradeIndex<0)return FIELD_SPECIALIZED_SUBJECTS[field]||[];
  return [...new Set(PROFILE_GRADES.slice(0,maxGradeIndex+1).flatMap(
    currentGrade=>FIELD_SPECIALIZED_SUBJECTS_BY_GRADE[field][currentGrade]
  ))];
}

function isFieldManagedSubject(subject){
  return !!subject&&subject.type==='specialized'&&
    Object.values(FIELD_SPECIALIZED_SUBJECTS).some(subjects=>subjects.includes(subject.name));
}

function isSelectedFieldSubject(subject,field){
  return isFieldManagedSubject(subject)&&(FIELD_SPECIALIZED_SUBJECTS[field]||[]).includes(subject.name);
}

function cloneStorageValue(value){
  return value==null?value:JSON.parse(JSON.stringify(value));
}

function withoutStaticSubjectCurriculum(subject,field){
  if(isFieldManagedGeneralSubject(subject&&subject.name,field)&&subject.type==='general'){
    const result={...subject};
    ['grades','lessonsByGrade','freeLessons','topics'].forEach(key=>delete result[key]);
    if(subject.name!=='زبان')delete result.lessonSections;
    return result;
  }
  if(!isFieldManagedSubject(subject))return subject;
  const result={...subject};
  ['grades','topics','topicsByField','topicsByFieldVersion','chapterSections','lessonSections'].forEach(key=>delete result[key]);
  return result;
}

function restoreFieldManagedGeneralCurriculum(subjects,field){
  const names=FIELD_MANAGED_GENERAL_SUBJECTS_BY_FIELD[field]||[];
  names.forEach(name=>{
    const template=DEFAULT_SUBJECTS.find(item=>item.name===name&&item.type==='general');
    if(!template)return;
    let subject=subjects.find(item=>item.name===name);
    if(!subject){
      subject=normalizeSubject(template);
      subjects.push(subject);
    }
    subject.type='general';
    subject.grades=[...GENERAL_SUBJECT_GRADES[name]];
    subject.lessonsByGrade={'دهم':0,'یازدهم':0,'دوازدهم':0,...GENERAL_SUBJECT_LESSONS[name]};
    subject.lessons=Object.values(GENERAL_SUBJECT_LESSONS[name]).reduce((sum,count)=>sum+count,0);
    subject.freeLessons={
      'دهم':[],
      'یازدهم':[...(GENERAL_SUBJECT_FREE_LESSONS[name]?.['یازدهم']||[])],
      'دوازدهم':[...(GENERAL_SUBJECT_FREE_LESSONS[name]?.['دوازدهم']||[])]
    };
    subject.topics={'دهم':[],'یازدهم':[],'دوازدهم':[]};
    if(name!=='زبان')subject.lessonSections={'دهم':{},'یازدهم':{},'دوازدهم':{}};
    else if(!subject.lessonSections)subject.lessonSections={'دهم':{},'یازدهم':{},'دوازدهم':{}};
  });
  return subjects;
}

function needsFieldManagedGeneralMigration(source,field){
  const names=FIELD_MANAGED_GENERAL_SUBJECTS_BY_FIELD[field]||[];
  return names.some(name=>{
    const subject=(source.subjects||[]).find(item=>item&&item.name===name);
    if(!subject||subject.type!=='general')return true;
    const lessons={'دهم':0,'یازدهم':0,'دوازدهم':0,...GENERAL_SUBJECT_LESSONS[name]};
    const freeLessons={
      'دهم':[],
      'یازدهم':[...(GENERAL_SUBJECT_FREE_LESSONS[name]?.['یازدهم']||[])],
      'دوازدهم':[...(GENERAL_SUBJECT_FREE_LESSONS[name]?.['دوازدهم']||[])]
    };
    if(JSON.stringify(subject.grades)!==JSON.stringify(GENERAL_SUBJECT_GRADES[name])||
       JSON.stringify(subject.lessonsByGrade)!==JSON.stringify(lessons)||
       JSON.stringify(subject.freeLessons)!==JSON.stringify(freeLessons)||
       JSON.stringify(subject.topics)!==JSON.stringify({'دهم':[],'یازدهم':[],'دوازدهم':[]}))return true;
    return name!=='زبان'&&Object.values(subject.lessonSections||{}).some(gradeSections=>
      gradeSections&&Object.keys(gradeSections).length>0
    );
  });
}

function restoreFieldManagedCurriculum(subjects,field,grade){
  restoreFieldManagedGeneralCurriculum(subjects,field);
  subjects.forEach(subject=>{
    if(!isSelectedFieldSubject(subject,field))return;
    const template=DEFAULT_SUBJECTS.find(item=>item.name===subject.name&&item.type==='specialized');
    if(template){
      subject.topics=cloneStorageValue(template.topics)||{};
      subject.chapterSections=cloneStorageValue(template.chapterSections)||{'دهم':{},'یازدهم':{},'دوازدهم':{}};
      subject.lessonSections=cloneStorageValue(template.lessonSections)||{'دهم':{},'یازدهم':{},'دوازدهم':{}};
    }
    subject.grades=fieldSubjectGrades(field,subject.name,grade);
  });
  return subjects;
}

function keepSpecializedSubjectsFirst(subjects){
  return subjects.filter(subject=>subject.type==='specialized')
    .concat(subjects.filter(subject=>subject.type!=='specialized'));
}

function orderSubjectsByField(subjects,field,grade){
  const preferredRank=new Map(fieldSpecializedSubjects(field,grade).map((name,index)=>[name,index]));
  const specialized=subjects.filter(subject=>subject.type==='specialized')
    .map((subject,index)=>({subject,index}))
    .sort((a,b)=>(preferredRank.get(a.subject.name)??Number.MAX_SAFE_INTEGER)-
      (preferredRank.get(b.subject.name)??Number.MAX_SAFE_INTEGER)||a.index-b.index)
    .map(item=>item.subject);
  return specialized.concat(subjects.filter(subject=>subject.type!=='specialized'));
}

const FIELD_MANAGED_GENERAL_SUBJECTS_BY_FIELD = {
  'تجربی':['فارسی','عربی','دینی','زبان','سلامت و بهداشت','هویت اجتماعی'],
  'ریاضی':['فارسی','عربی','دینی','زبان','سلامت و بهداشت','هویت اجتماعی']
};
const GENERAL_SUBJECT_GRADES = {
  'فارسی':['یازدهم','دوازدهم'],
  'عربی':['یازدهم','دوازدهم'],
  'دینی':['یازدهم','دوازدهم'],
  'زبان':['یازدهم','دوازدهم'],
  'سلامت و بهداشت':['دوازدهم'],
  'هویت اجتماعی':['دوازدهم']
};
const GENERAL_SUBJECT_LESSONS = {
  'فارسی':{'یازدهم':18,'دوازدهم':18},
  'عربی':{'یازدهم':7,'دوازدهم':4},
  'دینی':{'یازدهم':12,'دوازدهم':10},
  'زبان':{'یازدهم':3,'دوازدهم':3},
  'سلامت و بهداشت':{'دوازدهم':14},
  'هویت اجتماعی':{'دوازدهم':10}
};
const GENERAL_SUBJECT_FREE_LESSONS = {
  'فارسی':{'یازدهم':[4,13],'دوازدهم':[4,15]}
};
function isFieldManagedGeneralSubject(name,field){
  return (FIELD_MANAGED_GENERAL_SUBJECTS_BY_FIELD[field]||[]).includes(name);
}
function isGeneralSubjectAvailableInField(subject,field){
  const isManagedSomewhere=Object.values(FIELD_MANAGED_GENERAL_SUBJECTS_BY_FIELD)
    .some(names=>names.includes(subject&&subject.name));
  return !isManagedSomewhere||isFieldManagedGeneralSubject(subject.name,field);
}
function generalSubjectDisplayName(name){
  const eleventhSubjects=['فارسی','عربی','دینی','زبان'];
  return state.profile.grade==='دوازدهم'&&state.settings.includeEleventhFinal&&eleventhSubjects.includes(name)
    ?`${name} (یازدهم و دوازدهم)`:name;
}

const EXPERIMENTAL_MATH_TOPICS = {
  'دهم':['فصل ۱: مجموعه، الگو و دنباله','فصل ۲: مثلثات','فصل ۳: توان‌های گویا و عبارت‌های جبری','فصل ۴: معادله‌ها و نامعادله‌ها','فصل ۵: تابع','فصل ۶: شمارش، بدون شمردن','فصل ۷: آمار و احتمال'],
  'یازدهم':['فصل ۱: هندسه تحلیلی و جبر','فصل ۲: هندسه','فصل ۳: تابع','فصل ۴: مثلثات','فصل ۵: توابع نمایی و لگاریتمی','فصل ۶: حد و پیوستگی','فصل ۷: آمار و احتمال'],
  'دوازدهم':['فصل ۱: تابع','فصل ۲: مثلثات','فصل ۳: حد بینهایت و حد در بینهایت','فصل ۴: کاربرد مشتق','فصل ۵: مشتق']
};
const EXPERIMENTAL_MATH_TOPIC_CATEGORIES = [
  'مجموعه، الگو و دنباله','توان‌های گویا و عبارت‌های جبری','معادله و نامعادله','تابع',
  'توابع نمایی و لگاریتمی','مثلثات','هندسه','حد و پیوستگی','مشتق و کاربرد آن',
  'شمارش بدون شمردن','آمار و احتمال'
];
const LEGACY_EXPERIMENTAL_MATH_TOPICS = {
  'دهم':EXPERIMENTAL_MATH_TOPICS['دهم'],
  'یازدهم':['فصل ۱: هندسه تحلیلی و جبر','فصل ۲: تابع','فصل ۳: مثلثات','فصل ۴: حد و پیوستگی','فصل ۵: ترکیبیات','فصل ۶: ماتریس'],
  'دوازدهم':['فصل ۱: تابع','فصل ۲: مثلثات','فصل ۳: حد بی‌نهایت','فصل ۴: مشتق','فصل ۵: کاربرد مشتق','فصل ۶: هندسه','فصل ۷: احتمال']
};
const MATH_FIELD_SPECIALIZED_TOPICS = {
  'ریاضی': {
    'دهم':['فصل ۱: مجموعه، الگو و دنباله','فصل ۲: مثلثات','فصل ۳: توان‌های گویا و عبارت‌های جبری','فصل ۴: معادله‌ها و نامعادله‌ها','فصل ۵: تابع','فصل ۶: شمارش بدون شمردن','فصل ۷: آمار و احتمال'],
    'یازدهم':['فصل ۱: جبر و معادله','فصل ۲: تابع','فصل ۳: توابع نمایی و لگاریتمی','فصل ۴: مثلثات','فصل ۵: حد و پیوستگی'],
    'دوازدهم':['فصل ۱: تابع','فصل ۲: مثلثات','فصل ۳: حدهای نامتناهی ـ حد در بی‌نهایت','فصل ۴: مشتق','فصل ۵: کاربردهای مشتق']
  },
  'هندسه': {
    'دهم':['فصل ۱: ترسیم‌های هندسی و استدلال','فصل ۲: قضیه تالس، تشابه و کاربردهای آن','فصل ۳: چندضلعی‌ها','فصل ۴: تجسم فضایی'],
    'یازدهم':['فصل ۱: دایره','فصل ۲: تبدیل‌های هندسی و کاربردها','فصل ۳: روابط طولی در مثلث','فصل ۴: تجسم فضایی'],
    'دوازدهم':['فصل ۱: ماتریس و کاربردها','فصل ۲: آشنایی با مقاطع مخروطی','فصل ۳: بردارها']
  },
  'آمار و احتمال': {
    'یازدهم':['فصل ۱: آشنایی با مبانی ریاضیات','فصل ۲: احتمال','فصل ۳: آمار توصیفی','فصل ۴: آمار استنباطی']
  },
  'ریاضیات گسسته': {
    'دوازدهم':['فصل ۱: آشنایی با نظریه اعداد','فصل ۲: گراف و مدل‌سازی','فصل ۳: ترکیبیات (شمارش)']
  },
  'فیزیک': {
    'دهم':['فصل ۱: فیزیک و اندازه‌گیری','فصل ۲: ویژگی‌های فیزیکی مواد','فصل ۳: کار، انرژی و توان','فصل ۴: دما و گرما'],
    'یازدهم':['فصل ۱: الکتریسیته ساکن','فصل ۲: جریان الکتریکی و مدارهای جریان مستقیم','فصل ۳: مغناطیس','فصل ۴: القای الکترومغناطیسی و جریان متناوب'],
    'دوازدهم':['فصل ۱: حرکت بر خط راست','فصل ۲: دینامیک و حرکت دایره‌ای','فصل ۳: نوسان و موج','فصل ۴: برهم‌کنش‌های موج','فصل ۵: آشنایی با فیزیک اتمی','فصل ۶: آشنایی با فیزیک هسته‌ای']
  },
  'شیمی': {
    'دهم':['فصل ۱: کیهان، زادگاه الفبای هستی','فصل ۲: ردپای گازها در زندگی','فصل ۳: آب، آهنگ زندگی'],
    'یازدهم':['فصل ۱: قدر هدایای زمینی را بدانیم','فصل ۲: در پی غذای سالم','فصل ۳: پوشاک، نیازی پایان‌ناپذیر'],
    'دوازدهم':['فصل ۱: مولکول‌ها در خدمت تندرستی','فصل ۲: آسایش و رفاه در سایه شیمی','فصل ۳: شیمی، جلوه‌ای از هنر، زیبایی و ماندگاری','فصل ۴: شیمی، راهی به سوی آینده‌ای روشن‌تر']
  }
};

const EMPTY_SPECIALIZED_TEMPLATES = {
  'ریاضی': [
    { name: 'ریاضی', color: '#6d5efc', defaultQ: 30, sessions: 30 },
    { name: 'هندسه', color: '#8b5cf6', defaultQ: 20, sessions: 15 },
    { name: 'فیزیک', color: '#22d3ee', defaultQ: 30, sessions: 25 },
    { name: 'شیمی', color: '#f59e0b', defaultQ: 35, sessions: 30 },
    { name: 'آمار و احتمال', color: '#d8b4fe', defaultQ: 15, sessions: 10 },
    { name: 'ریاضیات گسسته', color: '#c084fc', defaultQ: 15, sessions: 10 }
  ]
};

function makeEmptySubjectTemplate(t) {
  const grades=t.grades||[];
  return {
    name: t.name, color: t.color, defaultQ: t.defaultQ, sessions: t.sessions,
    type: 'specialized',
    grades,
    topics: { 'دهم': [], 'یازدهم': [], 'دوازدهم': [] },
    chapterSections: { 'دهم': {}, 'یازدهم': {}, 'دوازدهم': {} },
    lessonSections: { 'دهم': {}, 'یازدهم': {}, 'دوازدهم': {} },
    errors: [], specialTags: [], lessonRecords: {}, topicRecords: {}
  };
}

function fieldSubjectGrades(field,name,throughGrade){
  const grades=PROFILE_GRADES.filter(grade=>FIELD_SPECIALIZED_SUBJECTS_BY_GRADE[field][grade].includes(name));
  const maxGradeIndex=PROFILE_GRADES.indexOf(throughGrade);
  return maxGradeIndex<0?grades:grades.filter(grade=>PROFILE_GRADES.indexOf(grade)<=maxGradeIndex);
}

/* ============ CONSTANTS ============ */
const GRADES=['دهم','یازدهم','دوازدهم'];
const GENERAL_GRADES=['یازدهم','دوازدهم'];

const ERROR_PALETTE=['#f59e0b','#f97316','#ef4444','#8b5cf6','#22d3ee','#10b981','#14b8a6','#6366f1','#ec4899','#0ea5e9','#a78bfa','#fcd34d','#fb923c','#94a3b8','#facc15','#a3e635'];
function errColor(id){let h=0;for(let i=0;i<id.length;i++)h=(h*37+id.charCodeAt(i)+i*13)|0;return ERROR_PALETTE[Math.abs(h)%ERROR_PALETTE.length];}
const EXAM_COLOR='#eab308';const EXAM_SUBJECT='آزمون';const OTHER_SUBJECT='سایر';const OTHER_COLOR='#94a3b8';

function displaySubjectName(subject, topic){
  if(subject === OTHER_SUBJECT){
    const t = topic != null ? String(topic).trim() : '';
    if(t) return t;
  }
  return subject;
}

const DEFAULT_COMMON_ERRORS = [
  {id:'forget', label:'فراموشی', hasSub:false, subOptions:[]},
  {id:'misread', label:'درست نخوندن سوال', hasSub:true, subOptions:[{id:'question', label:'صورت سوال'},{id:'options', label:'گزینه‌ها'}]},
  {id:'concept', label:'عدم تسلط مفهومی', hasSub:true, subOptions:[{id:'doubt', label:'شک بین ۲ گزینه'},{id:'forget_sub', label:'فراموشی'}]},
  {id:'calc', label:'اشتباه محاسباتی', hasSub:false, subOptions:[]}
];

const DEFAULT_SPECIALIZED_TAGS = {
  'زیست': [{id:'bio_figure', label:'شکل'},{id:'bio_combined', label:'ترکیبی'},{id:'bio_multi', label:'چند موردی'}],
  'شیمی': [{id:'chem_calc_tag', label:'محاسباتی'},{id:'chem_memo_tag', label:'حفظیات'}],
  'فیزیک': [],
  'ریاضی': [],
  'زمین‌شناسی': []
};

const DEFAULT_SUBJECTS=[
  {name:'زیست',color:'#10b981',defaultQ:50,sessions:40,type:'specialized',grades:['دهم','یازدهم','دوازدهم'],
    topics:{'دهم':['فصل ۱: دنیای زنده','فصل ۲: گوارش و جذب مواد','فصل ۳: تبادلات گازی','فصل ۴: گردش مواد در بدن','فصل ۵: تنظیم اسمزی و دفع مواد زائد','فصل ۶: از یاخته تا گیاه','فصل ۷: جذب و انتقال مواد در گیاهان'],'یازدهم':['فصل ۱: تنظیم عصبی','فصل ۲: حواس','فصل ۳: دستگاه حرکتی','فصل ۴: تنظیم شیمیایی','فصل ۵: ایمنی','فصل ۶: تقسیم یاخته','فصل ۷: تولید مثل','فصل ۸: تولید مثل نهاندانگان','فصل ۹: پاسخ گیاهان به محرک‌ها'],'دوازدهم':['فصل ۱: مولکول‌های اطلاعاتی','فصل ۲: جریان اطلاعات','فصل ۳: انتقال اطلاعات','فصل ۴: تغییر در اطلاعات','فصل ۵: از ماده به انرژی','فصل ۶: از انرژی به ماده','فصل ۷: فناوری‌های نوین','فصل ۸: رفتارهای جانوران']},
    chapterSections:{
      'دهم':{
        'فصل ۱: دنیای زنده':['گفتار ۱: زیست‌شناسی چیست؟','گفتار ۲: گستره حیات','گفتار ۳: یاخته و بافت در بدن انسان'],
        'فصل ۲: گوارش و جذب مواد':['گفتار ۱: ساختار و عملکرد لوله گوارش','گفتار ۲: گوارش و جذب مواد','گفتار ۳: تنوع گوارش در جانداران'],
        'فصل ۳: تبادلات گازی':['گفتار ۱: سازوکار دستگاه تنفس در انسان','گفتار ۲: تهویه ششی','گفتار ۳: تنوع تبادلات گازی'],
        'فصل ۴: گردش مواد در بدن':['گفتار ۱: قلب','گفتار ۲: رگ‌ها','گفتار ۳: خون','گفتار ۴: تنوع گردش مواد در جانداران'],
        'فصل ۵: تنظیم اسمزی و دفع مواد زائد':['گفتار ۱: هم‌ایستایی و کلیه‌ها','گفتار ۲: تشکیل ادرار و تخلیه آن','گفتار ۳: تنوع دفع و تنظیم اسمزی در جانداران'],
        'فصل ۶: از یاخته تا گیاه':['گفتار ۱: ویژگی‌های یاخته گیاهی','گفتار ۲: سامانه بافتی','گفتار ۳: ساختار گیاهان'],
        'فصل ۷: جذب و انتقال مواد در گیاهان':['گفتار ۱: تغذیه گیاهی','گفتار ۲: جانداران مؤثر در تغذیه گیاهی','گفتار ۳: انتقال مواد در گیاهان']
      },
      'یازدهم':{
        'فصل ۱: تنظیم عصبی':['گفتار ۱: یاخته‌های بافت عصبی','گفتار ۲: ساختار دستگاه عصبی'],
        'فصل ۲: حواس':['گفتار ۱: گیرنده‌های حسی','گفتار ۲: حواس ویژه','گفتار ۳: گیرنده‌های حسی جانوران'],
        'فصل ۳: دستگاه حرکتی':['گفتار ۱: استخوان‌ها و اسکلت','گفتار ۲: ماهیچه‌ها و حرکت'],
        'فصل ۴: تنظیم شیمیایی':['گفتار ۱: ارتباط شیمیایی','گفتار ۲: غده‌های درون‌ریز'],
        'فصل ۵: ایمنی':['گفتار ۱: نخستین خط دفاعی','گفتار ۲: دومین خط دفاعی','گفتار ۳: سومین خط دفاعی'],
        'فصل ۶: تقسیم یاخته':['گفتار ۱: کروموزوم','گفتار ۲: میتوز','گفتار ۳: میوز و تولید مثل جنسی'],
        'فصل ۷: تولید مثل':['گفتار ۱: دستگاه تولید مثل در مرد','گفتار ۲: دستگاه تولید مثل در زن','گفتار ۳: رشد و نمو جنین','گفتار ۴: تولید مثل در جانوران'],
        'فصل ۸: تولید مثل نهاندانگان':['گفتار ۱: تولید مثل غیرجنسی','گفتار ۲: تولید مثل جنسی','گفتار ۳: از یاخته تخم تا گیاه'],
        'فصل ۹: پاسخ گیاهان به محرک‌ها':['گفتار ۱: پاسخ به محرک‌های محیطی','گفتار ۲: تنظیم‌کننده‌های رشد در گیاهان']
      },
      'دوازدهم':{
        'فصل ۱: مولکول‌های اطلاعاتی':['گفتار ۱: نوکلئیک اسیدها','گفتار ۲: همانندسازی دنا','گفتار ۳: پروتئین‌ها'],
        'فصل ۲: جریان اطلاعات':['گفتار ۱: رونویسی','گفتار ۲: به سوی پروتئین','گفتار ۳: تنظیم بیان ژن'],
        'فصل ۳: انتقال اطلاعات':['گفتار ۱: مفاهیم پایه','گفتار ۲: انواع صفات'],
        'فصل ۴: تغییر در اطلاعات':['گفتار ۱: تغییر در ماده وراثتی','گفتار ۲: تغییر در جمعیت‌ها','گفتار ۳: تغییر در گونه‌ها'],
        'فصل ۵: از ماده به انرژی':['گفتار ۱: تأمین انرژی','گفتار ۲: اکسایش بیشتر','گفتار ۳: زیست مستقل از اکسیژن'],
        'فصل ۶: از انرژی به ماده':['گفتار ۱: فتوسنتز','گفتار ۲: واکنش‌های فتوسنتزی','گفتار ۳: فتوسنتز در شرایط دشوار'],
        'فصل ۷: فناوری‌های نوین':['گفتار ۱: زیست‌فناوری و مهندسی ژنتیک','گفتار ۲: فناوری مهندسی پروتئین و بافت','گفتار ۳: کاربردهای زیست‌فناوری'],
        'فصل ۸: رفتارهای جانوران':['گفتار ۱: رفتارهای غریزی و یادگیری','گفتار ۲: ارتباط و رفتارهای اجتماعی']
      }
    },
    specialTags: DEFAULT_SPECIALIZED_TAGS['زیست'],
    errors:[]},
  {name:'شیمی',color:'#f59e0b',defaultQ:35,sessions:30,type:'specialized',grades:['دهم','یازدهم','دوازدهم'],
    topics:{'دهم':['فصل ۱: کیهان، زادگاه الفبای هستی','فصل ۲: ردپای گازها در زندگی','فصل ۳: آب، آهنگ زندگی'],'یازدهم':['فصل ۱: قدر هدایای زمینی را بدانیم','فصل ۲: در پی غذای سالم','فصل ۳: پوشاک، نیازی پایان‌ناپذیر'],'دوازدهم':['فصل ۱: مولکول‌ها در خدمت تندرستی','فصل ۲: آسایش و رفاه در سایه شیمی','فصل ۳: شیمی، جلوه‌ای از هنر، زیبایی و ماندگاری','فصل ۴: شیمی، راهی به سوی آینده روشن‌تر']},
    chapterSections:{'دهم':{},'یازدهم':{},'دوازدهم':{}},
    specialTags: DEFAULT_SPECIALIZED_TAGS['شیمی'],
    errors:[]},
  {name:'فیزیک',color:'#22d3ee',defaultQ:30,sessions:25,type:'specialized',grades:['دهم','یازدهم','دوازدهم'],
    topics:{'دهم':['فصل ۱: فیزیک و اندازه‌گیری','فصل ۲: ویژگی‌های فیزیکی مواد','فصل ۳: کار، انرژی و توان','فصل ۴: دما و گرما'],'یازدهم':['فصل ۱: الکتریسیته ساکن','فصل ۲: جریان الکتریکی و مدارهای جریان مستقیم','فصل ۳: مغناطیس و القای الکترومغناطیسی'],'دوازدهم':['فصل ۱: حرکت بر خط راست','فصل ۲: دینامیک','فصل ۳: نوسان و امواج','فصل ۴: فیزیک اتمی و هسته‌ای']},
    chapterSections:{'دهم':{},'یازدهم':{},'دوازدهم':{}},
    specialTags: [],
    errors:[]},
  {name:'ریاضی',color:'#6d5efc',defaultQ:30,sessions:30,type:'specialized',grades:['دهم','یازدهم','دوازدهم'],
    topics:EXPERIMENTAL_MATH_TOPICS,
    chapterSections:{'دهم':{},'یازدهم':{},'دوازدهم':{}},
    specialTags: [],
    errors:[]},
  {name:'زمین‌شناسی',color:'#a78bfa',defaultQ:8,sessions:10,type:'specialized',grades:['یازدهم'],
    topics:{'یازدهم':['فصل ۱: آفرینش کیهان و زمین','فصل ۲: منابع معدنی و ذخایر انرژی','فصل ۳: منابع آب و خاک','فصل ۴: زمین‌شناسی و سازه‌های مهندسی','فصل ۵: زمین‌شناسی و سلامت','فصل ۶: پویایی زمین','فصل ۷: زمین‌شناسی ایران']},
    chapterSections:{'یازدهم':{}},
    specialTags: [],
    errors:[]},

  {name:'فارسی',color:'#ec4899',defaultQ:0,sessions:20,type:'general',grades:['یازدهم','دوازدهم'],
    lessonsByGrade:{'دهم':0,'یازدهم':18,'دوازدهم':18},
    freeLessons:{'دهم':[],'یازدهم':[4,13],'دوازدهم':[4,15]},
    lessonSections:{'دهم':{},'یازدهم':{},'دوازدهم':{}},
    topics:{'دهم':[],'یازدهم':[],'دوازدهم':[]},errors:[]},
  {name:'عربی',color:'#a78bfa',defaultQ:0,sessions:15,type:'general',grades:['یازدهم','دوازدهم'],
    lessonsByGrade:{'دهم':0,'یازدهم':7,'دوازدهم':4},
    freeLessons:{'دهم':[],'یازدهم':[],'دوازدهم':[]},
    lessonSections:{'دهم':{},'یازدهم':{},'دوازدهم':{}},
    topics:{'دهم':[],'یازدهم':[],'دوازدهم':[]},errors:[]},
  {name:'دینی',color:'#14b8a6',defaultQ:0,sessions:15,type:'general',grades:['یازدهم','دوازدهم'],
    lessonsByGrade:{'دهم':0,'یازدهم':12,'دوازدهم':10},
    freeLessons:{'دهم':[],'یازدهم':[],'دوازدهم':[]},
    lessonSections:{'دهم':{},'یازدهم':{},'دوازدهم':{}},
    topics:{'دهم':[],'یازدهم':[],'دوازدهم':[]},errors:[]},
  {name:'زبان',color:'#f43f5e',defaultQ:0,sessions:15,type:'general',grades:['یازدهم','دوازدهم'],
    lessonsByGrade:{'دهم':0,'یازدهم':3,'دوازدهم':3},
    freeLessons:{'دهم':[],'یازدهم':[],'دوازدهم':[]},
    lessonSections:{'دهم':{},'یازدهم':{},'دوازدهم':{}},
    topics:{'دهم':[],'یازدهم':[],'دوازدهم':[]},errors:[]},
  {name:'سلامت و بهداشت',color:'#22c55e',defaultQ:0,sessions:12,type:'general',grades:['دوازدهم'],
    lessonsByGrade:{'دهم':0,'یازدهم':0,'دوازدهم':14},
    freeLessons:{'دهم':[],'یازدهم':[],'دوازدهم':[]},
    lessonSections:{'دهم':{},'یازدهم':{},'دوازدهم':{}},
    topics:{'دهم':[],'یازدهم':[],'دوازدهم':[]},errors:[]},
  {name:'هویت اجتماعی',color:'#06b6d4',defaultQ:0,sessions:10,type:'general',grades:['دوازدهم'],
    lessonsByGrade:{'دهم':0,'یازدهم':0,'دوازدهم':10},
    freeLessons:{'دهم':[],'یازدهم':[],'دوازدهم':[]},
    lessonSections:{'دهم':{},'یازدهم':{},'دوازدهم':{}},
    topics:{'دهم':[],'یازدهم':[],'دوازدهم':[]},errors:[]}
];

const LS_KEY='konkur-unified-v1';
const DB_NAME='konkur-student-db';
const DB_STORE='app-state';
const DB_STATE_ID='main';
const LOCAL_RECORD_PREFIX=`${LS_KEY}:record:`;
const LOCAL_PENDING_PREFIX=`${LS_KEY}:pending:`;
const NORMALIZED_STORES=['app-meta','subjects','activities','classes','sessions','sleeps','phones','exams','questions'];
const LEGACY_STORES=['plan','reserved'];
const SYNC_CHANGES_STORE='sync-changes';
const SYNC_PENDING_STORE='sync-pending';
const SYNC_DEVICE_KEY='konkur-sync-device-v1';
const SESSIONS_DEFAULT_DUR=120;

/* ============ SESSION NORMALIZATION ============ */
function normalizeSession(s){
  if(!s||typeof s!=='object')return null;
  return {
    id: String(s.id||uid()),
    subject: String(s.subject||''),
    topic: String(s.topic||''),
    durMin: Math.max(15, Math.min(720, +s.durMin||SESSIONS_DEFAULT_DUR)),
    date: s.date ? String(s.date) : null,
    startMin: (s.startMin!=null && !isNaN(+s.startMin)) ? +s.startMin : null,
    done: !!s.done,
    doneAt: s.doneAt ? +s.doneAt : null,
    activityId: s.activityId ? String(s.activityId) : null,
    examId: s.examId ? String(s.examId) : null,
    ts: +s.ts||Date.now()
  };
}

function normalizeSessions(list){
  if(!Array.isArray(list))return [];
  return list.map(normalizeSession).filter(Boolean);
}

/* مایگریشن از state قدیمی (plan + reserved) به sessions */
function migrateLegacyStateToSessions(plan, reserved){
  const sessions=[];
  Object.entries(plan||{}).forEach(([dayKey,blocks])=>{
    if(!Array.isArray(blocks))return;
    blocks.forEach(b=>{
      if(!b||typeof b!=='object')return;
      const s=normalizeSession({
        id: b.id||uid(),
        subject: b.subject||'',
        topic: b.topic||'',
        durMin: b.durMin||SESSIONS_DEFAULT_DUR,
        date: dayKey,
        startMin: b.startMin!=null?+b.startMin:null,
        done: false,
        examId: null,
        ts: b.ts||Date.now()
      });
      if(s)sessions.push(s);
    });
  });
  (reserved||[]).forEach(r=>{
    if(!r||typeof r!=='object')return;
    const s=normalizeSession({
      id: r.id||uid(),
      subject: r.subject||'',
      topic: r.topic||'',
      durMin: r.durMin||SESSIONS_DEFAULT_DUR,
      date: r.date||null,
      startMin: null,
      done: false,
      examId: null,
      ts: r.ts||Date.now()
    });
    if(s)sessions.push(s);
  });
  return sessions;
}

/* مایگریشن از IndexedDB records قدیمی (plan + reserved) به sessions */
function migrateLegacyRecordsToSessions(planRecords, reservedRecords){
  const sessions=[];
  (planRecords||[]).forEach(r=>{
    const b=r.value;
    if(!b)return;
    const s=normalizeSession({
      id: b.id||uid(),
      subject: b.subject||'',
      topic: b.topic||'',
      durMin: b.durMin||SESSIONS_DEFAULT_DUR,
      date: r.date||null,
      startMin: b.startMin!=null?+b.startMin:null,
      done: false,
      examId: null,
      ts: b.ts||Date.now()
    });
    if(s)sessions.push(s);
  });
  (reservedRecords||[]).forEach(r=>{
    const res=r.value;
    if(!res)return;
    const s=normalizeSession({
      id: res.id||uid(),
      subject: res.subject||'',
      topic: res.topic||'',
      durMin: res.durMin||SESSIONS_DEFAULT_DUR,
      date: res.date||null,
      startMin: null,
      done: false,
      examId: null,
      ts: res.ts||Date.now()
    });
    if(s)sessions.push(s);
  });
  return sessions;
}

/* ============ SUBJECT NORMALIZATION ============ */
function normalizeSubject(s){
  const topics=(s.topics&&typeof s.topics==='object')?s.topics:{};
  let topicsByField;
  const fieldSpecificMathTopics=MATH_FIELD_SPECIALIZED_TOPICS[s.name];
  if(fieldSpecificMathTopics){
    topicsByField={'تجربی':{},'ریاضی':{},'انسانی':{}};
    FIELDS.forEach(field=>{
      const fieldTopics=s.topicsByField&&s.topicsByField[field];
      GRADES.forEach(grade=>{
        let list;
        if(field==='ریاضی'&&s.topicsByFieldVersion!==3){
          list=fieldSpecificMathTopics[grade]||[];
        }else if(fieldTopics&&Array.isArray(fieldTopics[grade])){
          list=fieldTopics[grade];
        }else{
          list=Array.isArray(topics[grade])?topics[grade]:[];
        }
        topicsByField[field][grade]=list.filter(topic=>typeof topic==='string');
      });
    });
    if(s.name==='ریاضی')topicsByField['تجربی']['دوازدهم']=[...EXPERIMENTAL_MATH_TOPIC_CATEGORIES];
  }
  let grades=Array.isArray(s.grades)?s.grades.filter(g=>GRADES.includes(g)):null;
  if(!grades||!grades.length){grades=Object.keys(topics).filter(g=>GRADES.includes(g));if(!grades.length)grades=['دهم','یازدهم','دوازدهم'];}
  const type=(s.type==='specialized'||s.type==='general')?s.type:(+s.defaultQ>0?'specialized':'general');

  let errors=Array.isArray(s.errors)?s.errors.map(e=>({
    id:String(e.id||uid()),
    label:String(e.label||''),
    hasSub:!!e.hasSub,
    subOptions:Array.isArray(e.subOptions)?e.subOptions.map(o=>({id:String(o.id||uid()),label:String(o.label||'')})):[]
  })):[];

  let specialTags = Array.isArray(s.specialTags)
    ? s.specialTags.map(e=>({id:String(e.id||uid()), label:String(e.label||'')}))
    : (DEFAULT_SPECIALIZED_TAGS[s.name]||[]).map(e=>({...e}));

  /* TASK SPEC v1.2.0 — FEAT-7: question types, note emphasis and subject group. */
  /* FEAT-7: user-created question types. A type may be tied to one or more
     topics of this subject; an empty list means it applies to every topic. */
  let questionTypes = Array.isArray(s.questionTypes)
    ? s.questionTypes.map(e=>({
        id:String(e.id||uid()),
        label:String(e.label||'').slice(0,60),
        topics:Array.isArray(e.topics)?e.topics.filter(t=>typeof t==='string'):[]
      })).filter(e=>e.label)
    : [];
  const emphasis=['note','question-type','both'].includes(s.emphasis)?s.emphasis:'note';
  const group=String(s.group||'').slice(0,40);

  let lessonsByGrade=null;
  let freeLessons={'دهم':[],'یازدهم':[],'دوازدهم':[]};
  if(type==='general'){
    if(s.lessonsByGrade && typeof s.lessonsByGrade==='object'){
      lessonsByGrade={};
      GRADES.forEach(g=>{lessonsByGrade[g]=Math.max(0,Math.min(200,+(s.lessonsByGrade[g]||0)));});
      lessonsByGrade['دهم']=0;
    } else if(s.lessons!=null && +s.lessons>0){
      lessonsByGrade={'دهم':0,'یازدهم':Math.max(0,Math.min(400,+s.lessons||0)),'دوازدهم':0};
    } else {
      lessonsByGrade={'دهم':0,'یازدهم':0,'دوازدهم':0};
    }
    if(s.freeLessons && typeof s.freeLessons==='object'){
      GRADES.forEach(g=>{
        if(Array.isArray(s.freeLessons[g])){
          freeLessons[g]=s.freeLessons[g].map(n=>Math.max(1,+n||0)).filter(n=>n>0 && n<=200);
        }
      });
    }
  }

  let chapterSections={'دهم':{},'یازدهم':{},'دوازدهم':{}};
  if(type==='specialized' && s.chapterSections && typeof s.chapterSections==='object'){
    grades.forEach(g=>{
      if(s.chapterSections[g] && typeof s.chapterSections[g]==='object'){
        chapterSections[g]={};
        Object.keys(s.chapterSections[g]).forEach(chName=>{
          if(Array.isArray(s.chapterSections[g][chName])){
            chapterSections[g][chName]=s.chapterSections[g][chName].filter(x=>typeof x==='string');
          }
        });
      }
    });
  }

  let lessonSections={'دهم':{},'یازدهم':{},'دوازدهم':{}};
  if(type==='general' && s.lessonSections && typeof s.lessonSections==='object'){
    GRADES.forEach(g=>{
      if(s.lessonSections[g] && typeof s.lessonSections[g]==='object'){
        lessonSections[g]={};
        Object.keys(s.lessonSections[g]).forEach(lIdx=>{
          if(Array.isArray(s.lessonSections[g][lIdx])){
            lessonSections[g][lIdx]=s.lessonSections[g][lIdx].filter(x=>typeof x==='string');
          }
        });
      }
    });
  }

  let lessonRecords={};
  if(type==='general' && s.lessonRecords && typeof s.lessonRecords==='object'){
    const keys=Object.keys(s.lessonRecords);
    const isFlatNumeric=keys.length>0 && keys.every(k=>/^\d+$/.test(k));
    if(isFlatNumeric){
      lessonRecords={'یازدهم':{...s.lessonRecords}};
    } else {
      GRADES.forEach(g=>{
        if(s.lessonRecords[g] && typeof s.lessonRecords[g]==='object'){
          lessonRecords[g]={...s.lessonRecords[g]};
        }
      });
    }
  }

  const lessonsSum = lessonsByGrade ? GRADES.reduce((sum,g)=>sum+(lessonsByGrade[g]||0),0) : 0;
  const topicRecords=(s.topicRecords&&typeof s.topicRecords==='object')?s.topicRecords:{};

  return{
    name:String(s.name||'درس'),
    color:s.color||'#7c5cff',
    defaultQ:Math.max(0,Math.min(200,+s.defaultQ||0)),
    sessions:Math.max(0,Math.min(200,+s.sessions||0)),
    lessons:lessonsSum,
    lessonsByGrade,
    freeLessons,
    type,grades,topics,
    ...(topicsByField?{topicsByField,topicsByFieldVersion:3}:{}),
    errors,
    specialTags,
    questionTypes,
    emphasis,
    ...(group?{group}:{}),
    lessonRecords,
    topicRecords,
    chapterSections,
    lessonSections
  };
}

function normalizeQuestion(q){
  const options=Array.isArray(q.options)
    ? q.options.map(o => String(o && o.text != null ? o.text : o)).filter(t => t !== '').slice(0, 10)
    : [];
  const correctOptions=Array.isArray(q.correctOptions)
    ? q.correctOptions.map(i => Math.max(0, Math.min(options.length - 1, +i || 0)))
        .filter((i, idx, arr) => i < options.length && arr.indexOf(i) === idx)
    : [];
  return {
    id: q.id || uid(),
    subject: String(q.subject || ''),
    number: +q.number || 0,
    grade: GRADES.includes(q.grade) ? q.grade : '',
    topics: Array.isArray(q.topics) ? q.topics.filter(t => typeof t === 'string') : [],
    status: ['correct','wrong','blank','pending'].includes(q.status) ? q.status : 'pending',
    errorTypes: Array.isArray(q.errorTypes) ? q.errorTypes.filter(t => typeof t === 'string') : [],
    errorDetails: (q.errorDetails && typeof q.errorDetails === 'object') ? JSON.parse(JSON.stringify(q.errorDetails)) : {},
    specialTags: Array.isArray(q.specialTags) ? q.specialTags.filter(t => typeof t === 'string') : [],
    questionTypes: Array.isArray(q.questionTypes) ? q.questionTypes.filter(t => typeof t === 'string') : [],
    options,
    correctOptions,
    starred: !!q.starred,
    questionText: String(q.questionText || ''),
    answerText: String(q.answerText || ''),
    reviewSolvable: (q.reviewSolvable === true) ? true : (q.reviewSolvable === false) ? false : null,
    figureRef: String(q.figureRef || ''),
    note: String(q.note || ''),
    noteHidden: !!q.noteHidden,
    ts: +q.ts || Date.now()
  };
}

function normalizeExam(e){
  if(!e || typeof e!=='object') return null;
  return {
    id:e.id||uid(),
    name:String(e.name||'آزمون'),
    date:e.date||TODAY_KEY,
    startMin:+e.startMin||480,
    endMin:+e.endMin||720,
    hasResults:!!e.hasResults,
    resultsSource:e.resultsSource==='answers'||e.resultsSource==='manual'?e.resultsSource:null,
    subjects:(e.subjects && typeof e.subjects==='object')?e.subjects:null,
    includedSubjects:Array.isArray(e.includedSubjects)?e.includedSubjects.slice():null,
    totalTaraz:e.totalTaraz!=null?+e.totalTaraz:null,
    participants:e.participants!=null?+e.participants:null,
    rankCountry:e.rankCountry!=null?+e.rankCountry:(e.rank!=null?+e.rank:null),
    rankRegion:e.rankRegion!=null?+e.rankRegion:null,
    rank:e.rank!=null?+e.rank:null,
    topics:(e.topics && typeof e.topics==='object')?e.topics:{},
    questions:Array.isArray(e.questions)?e.questions.map(normalizeQuestion):[],
    ts:+e.ts||Date.now()
  };
}

function defaultState(){
  const classes={};
  DEFAULT_SUBJECTS.forEach((s)=>{classes[s.name]={total:s.sessions||20,sessions:{}};});
  const profile=defaultProfile();
  const subjects = orderSubjectsByField(DEFAULT_SUBJECTS.map(s=>normalizeSubject({
    ...s,
    topics: JSON.parse(JSON.stringify(s.topics||{})),
    chapterSections: s.chapterSections ? JSON.parse(JSON.stringify(s.chapterSections)) : undefined,
    lessonSections: s.lessonSections ? JSON.parse(JSON.stringify(s.lessonSections)) : undefined,
    errors: (s.errors||[]).map(e=>({...e})),
    specialTags: (s.specialTags||[]).map(e=>({...e}))
  })),profile.field,profile.grade);
  return{
    profile,
    subjects,
    commonErrors:DEFAULT_COMMON_ERRORS.map(e=>({
      ...e,
      subOptions: e.subOptions ? e.subOptions.map(o=>({...o})) : []
    })),
    activities:[],sessions:[],classes,sleeps:[],phones:[],exams:[],
    settings:{goalHours:40,tbStartHour:6,tbEndHour:24,examsEnabled:true,examDuration:3,examName:'آزمایشی',otherColor:OTHER_COLOR,classViewMode:'compact',hideClasses:false,includeEleventhFinal:false,subjectOrderVersion:1}
  };
}

function dateKeyOffset(key,offset){
  return jKey(d2j(jdnFromKey(key)+offset));
}

function normalizeStateData(d){
  const def=defaultState();
  const source=d&&typeof d==='object'?d:{};
  const profile=normalizeProfile(source.profile);
  const rawSubjects=(Array.isArray(source.subjects)&&source.subjects.length)?source.subjects:def.subjects;
  const normalizedSubjects=restoreFieldManagedCurriculum(
    rawSubjects.map(normalizeSubject),profile.field,profile.grade
  );
  const subjectOrderVersion=source.settings&&source.settings.subjectOrderVersion;
  const subjects=subjectOrderVersion===1
    ? keepSpecializedSubjectsFirst(normalizedSubjects)
    : orderSubjectsByField(normalizedSubjects,profile.field,profile.grade);
  const rawMathSubject=rawSubjects.find(subject=>subject&&subject.name==='ریاضی');
  const mathSubject=subjects.find(subject=>subject.name==='ریاضی');
  if(rawMathSubject&&mathSubject){
    const rawTopics=rawMathSubject.topics&&typeof rawMathSubject.topics==='object'?rawMathSubject.topics:{};
    const rawExperimentalTopics=rawMathSubject.topicsByField&&rawMathSubject.topicsByField['تجربی']||rawTopics;
    const isLegacyDefault=GRADES.every(grade=>
      JSON.stringify(Array.isArray(rawExperimentalTopics[grade])?rawExperimentalTopics[grade]:[])===
      JSON.stringify(LEGACY_EXPERIMENTAL_MATH_TOPICS[grade])
    );
    if(isLegacyDefault)mathSubject.topicsByField['تجربی']=JSON.parse(JSON.stringify(EXPERIMENTAL_MATH_TOPICS));
  }
  
  /* Sessions: either from source.sessions, or migrated from legacy plan/reserved */
  let sessions;
  if(Array.isArray(source.sessions)){
    sessions=normalizeSessions(source.sessions);
  }else{
    sessions=migrateLegacyStateToSessions(source.plan,source.reserved);
  }
  
  const result={
    profile,
    subjects,
    commonErrors:(Array.isArray(source.commonErrors)&&source.commonErrors.length)
      ? source.commonErrors.map(e=>({
          ...e,
          hasSub:!!e.hasSub,
          subOptions:Array.isArray(e.subOptions)?e.subOptions.map(o=>({id:String(o.id||uid()),label:String(o.label||'')})):[]
        }))
      : def.commonErrors,
    activities:Array.isArray(source.activities)?source.activities:[],
    sessions,
    classes:(source.classes&&typeof source.classes==='object')?source.classes:{},
    sleeps:Array.isArray(source.sleeps)?source.sleeps.map(s=>({...s,endDate:s.endDate||s.date||TODAY_KEY})):[],
    phones:Array.isArray(source.phones)?source.phones:[],
    exams:Array.isArray(source.exams)?source.exams.map(normalizeExam).filter(Boolean):[],
    settings:Object.assign({},def.settings,source.settings||{},{subjectOrderVersion:1})
  };
  result.subjects.forEach(s=>{if(!result.classes[s.name])result.classes[s.name]={total:s.sessions,sessions:{}};});
  return result;
}

function compactStateForStorage(source){
  return{
    ...source,
    exams:source.exams.map(exam=>({
      ...exam,
      questions:exam.questions.map(q=>qStatus(q)==='correct'&&!qHasUsefulInfo(q)
        ?{id:q.id,subject:q.subject,number:q.number,status:'correct',ts:q.ts}
        :q)
    }))
  };
}

function normalizedStorageSnapshot(source){
  const snapshot=new Map(NORMALIZED_STORES.map(store=>[store,new Map()]));
  const add=(store,id,record)=>snapshot.get(store).set(String(id),JSON.stringify(record));
  add('app-meta',DB_STATE_ID,{id:DB_STATE_ID,value:{
    profile:source.profile,
    commonErrors:source.commonErrors,
    settings:source.settings
  }});
  source.subjects.forEach((value,index)=>add('subjects',value.name||`legacy-${index}`,{id:String(value.name||`legacy-${index}`),value,order:index}));
  const addCollection=(store,items)=>{
    items.forEach((value,index)=>{
      const id=value&&value.id!=null?String(value.id):`legacy-${index}`;
      add(store,id,{id,value,order:index});
    });
  };
  addCollection('activities',source.activities);
  Object.entries(source.classes).forEach(([name,value],index)=>add('classes',name,{id:name,value,order:index}));
  addCollection('sessions',source.sessions||[]);
  addCollection('sleeps',source.sleeps);
  addCollection('phones',source.phones);
  source.exams.forEach((exam,examIndex)=>{
    const {questions=[],...examData}=exam;
    add('exams',exam.id,{id:String(exam.id),value:examData,order:examIndex});
    questions.forEach((question,questionIndex)=>{
      const id=`${exam.id}::${question.id||`legacy-${questionIndex}`}`;
      const compactQuestion=qStatus(question)==='correct'&&!qHasUsefulInfo(question)
        ?{id:question.id,subject:question.subject,number:question.number,status:'correct',ts:question.ts}
        :question;
      add('questions',id,{id,examId:String(exam.id),value:compactQuestion,order:questionIndex});
    });
  });
  return snapshot;
}

function stateFromNormalizedRecords(records){
  const meta=records['app-meta'].find(record=>record.id===DB_STATE_ID);
  if(!meta)return null;
  const ordered=store=>(records[store]||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  
  /* Sessions: either from db or migrated from legacy stores */
  const dbSessions=ordered('sessions').map(record=>record.value);
  let sessions=dbSessions;
  let sessionsMigrated=false;
  if(!sessions.length){
    const legacyPlan=ordered('plan');
    const legacyReserved=ordered('reserved');
    if(legacyPlan.length||legacyReserved.length){
      sessions=migrateLegacyRecordsToSessions(legacyPlan,legacyReserved);
      sessionsMigrated=true;
    }
  }
  
  const stateData=Object.assign({},meta.value,{
    subjects:ordered('subjects').map(record=>record.value),
    activities:ordered('activities').map(record=>record.value),
    classes:Object.fromEntries(ordered('classes').map(record=>[record.id,record.value])),
    sessions,
    sleeps:ordered('sleeps').map(record=>record.value),
    phones:ordered('phones').map(record=>record.value),
    exams:ordered('exams').map(record=>({...record.value,questions:[]}))
  });
  const examsById=new Map(stateData.exams.map(exam=>[String(exam.id),exam]));
  ordered('questions').forEach(record=>{
    const exam=examsById.get(String(record.examId));
    if(exam)exam.questions.push(record.value);
  });
  if(sessionsMigrated)stateData._sessionsMigrated=true;
  return stateData;
}

function sanitizeSyncChanges(changes){
  return changes.map(change=>{
    if(change.store!=='subjects'||!change.payload||!change.payload.value)return change;
    const value=withoutStaticSubjectCurriculum(change.payload.value,state.profile.field);
    if(value===change.payload.value)return change;
    return{...change,payload:{...change.payload,value}};
  });
}

function localStorageRecordKey(store,id){
  return`${LOCAL_RECORD_PREFIX}${store}:${encodeURIComponent(id)}`;
}
function localStoragePendingKey(store,id){
  return`${LOCAL_PENDING_PREFIX}${store}:${encodeURIComponent(id)}`;
}
function readLocalNormalizedRecords(){
  const records=Object.fromEntries([...NORMALIZED_STORES,...LEGACY_STORES].map(store=>[store,[]]));
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(!key||!key.startsWith(LOCAL_RECORD_PREFIX))continue;
    const remainder=key.slice(LOCAL_RECORD_PREFIX.length);
    const separator=remainder.indexOf(':');
    if(separator<0)continue;
    const store=remainder.slice(0,separator);
    if(!records[store])continue;
    const value=localStorage.getItem(key);
    if(value)records[store].push(JSON.parse(value));
  }
  const hasData=[...NORMALIZED_STORES,...LEGACY_STORES].some(store=>records[store].length);
  if(!hasData)return null;
  const restored=stateFromNormalizedRecords(records);
  if(!restored)throw new Error('ذخیره‌های محلی ناقص‌اند؛ برای جلوگیری از بازنویسی، بارگذاری متوقف شد.');
  return restored;
}
function writeLocalPendingChange(change){
  localStorage.setItem(localStoragePendingKey(change.store,change.recordId),JSON.stringify(change));
}
function applyLocalStorageMutations(mutations){
  mutations.forEach(mutation=>{
    const key=localStorageRecordKey(mutation.store,mutation.id);
    const change={
      id:`${mutation.store}::${mutation.id}`,store:mutation.store,recordId:mutation.id,
      operation:mutation.operation,changedAt:Date.now(),deviceId:syncDeviceId,revision:newSyncRevision()
    };
    if(Array.isArray(mutation.fields))change.fields=mutation.fields;
    if(mutation.operation==='delete'){
      const oldValue=localStorage.getItem(key);
      localStorage.removeItem(key);
      if(oldValue)change.payload=JSON.parse(oldValue);
      else if(mutation.value!=null)change.payload=mutation.record();
    }else{
      change.payload=mutation.record();
      localStorage.setItem(key,JSON.stringify(change.payload));
    }
    writeLocalPendingChange(change);
  });
}
function getLocalPendingChanges(limit=500){
  const changes=[];
  for(let i=0;i<localStorage.length&&changes.length<Math.max(1,limit);i++){
    const key=localStorage.key(i);
    if(key&&key.startsWith(LOCAL_PENDING_PREFIX)){
      const value=localStorage.getItem(key);
      if(value)changes.push(JSON.parse(value));
    }
  }
  return changes;
}
function acknowledgeLocalChanges(acknowledgements){
  acknowledgements.forEach(({id,revision})=>{
    const separator=id.indexOf('::');
    const store=id.slice(0,separator),recordId=id.slice(separator+2);
    const key=localStoragePendingKey(store,recordId);
    const value=localStorage.getItem(key);
    if(!value)return;
    const current=JSON.parse(value);
    if(current.revision===revision)localStorage.removeItem(key);
  });
}

const appStateRepository={
  database:null,
  open(){
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB){reject(new Error('مرورگر از IndexedDB پشتیبانی نمی‌کند'));return;}
      const request=window.indexedDB.open(DB_NAME,4);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE,{keyPath:'id'});
        NORMALIZED_STORES.forEach(name=>{if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});});
        if(!db.objectStoreNames.contains(SYNC_CHANGES_STORE))db.createObjectStore(SYNC_CHANGES_STORE,{keyPath:'id',autoIncrement:true});
        if(!db.objectStoreNames.contains(SYNC_PENDING_STORE)){
          const pending=db.createObjectStore(SYNC_PENDING_STORE,{keyPath:'id'});
          if(db.objectStoreNames.contains(SYNC_CHANGES_STORE)){
            const cursor=request.transaction.objectStore(SYNC_CHANGES_STORE).openCursor();
            cursor.onsuccess=()=>{
              const entry=cursor.result;
              if(!entry)return;
              const change=entry.value;
              if(change.store&&change.recordId!=null){
                pending.put({...change,id:`${change.store}::${change.recordId}`,deviceId:change.deviceId||'legacy',revision:change.revision||`legacy-${change.id}`});
              }
              entry.continue();
            };
          }
        }
      };
      request.onsuccess=()=>{this.database=request.result;this.database.onversionchange=()=>this.database.close();resolve(this.database);};
      request.onerror=()=>reject(request.error||new Error('بازکردن پایگاه داده ناموفق بود'));
      request.onblocked=()=>reject(new Error('بازکردن پایگاه داده مسدود شده است'));
    });
  },
  getLegacy(){
    return new Promise((resolve,reject)=>{
      const request=this.database.transaction(DB_STORE,'readonly').objectStore(DB_STORE).get(DB_STATE_ID);
      request.onsuccess=()=>resolve(request.result?request.result.payload:null);
      request.onerror=()=>reject(request.error||new Error('خواندن داده‌های قدیمی ناموفق بود'));
    });
  },
  deleteLegacy(){
    return new Promise((resolve,reject)=>{
      const tx=this.database.transaction(DB_STORE,'readwrite');
      tx.objectStore(DB_STORE).delete(DB_STATE_ID);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('حذف داده‌های قدیمی ناموفق بود'));
      tx.onabort=()=>reject(tx.error||new Error('حذف داده‌های قدیمی لغو شد'));
    });
  },
  clearLegacyStores(){
    const stores=LEGACY_STORES.filter(s=>this.database.objectStoreNames.contains(s));
    if(!stores.length)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const tx=this.database.transaction(stores,'readwrite');
      stores.forEach(s=>tx.objectStore(s).clear());
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('پاک‌سازی داده‌های legacy ناموفق بود'));
    });
  },
  getNormalized(){
    return new Promise((resolve,reject)=>{
      const stores=[...NORMALIZED_STORES];
      LEGACY_STORES.forEach(s=>{
        if(this.database.objectStoreNames.contains(s))stores.push(s);
      });
      
      const tx=this.database.transaction(stores,'readonly');
      const records={};
      let remaining=stores.length;
      stores.forEach(store=>{
        const request=tx.objectStore(store).getAll();
        request.onsuccess=()=>{
          records[store]=request.result||[];
          remaining--;
          if(!remaining){
            const restored=stateFromNormalizedRecords(records);
            if(!restored&&NORMALIZED_STORES.some(name=>records[name]&&records[name].length)){
              reject(new Error('داده‌های IndexedDB ناقص‌اند؛ برای جلوگیری از بازنویسی، بارگذاری متوقف شد.'));
              return;
            }
            resolve(restored);
          }
        };
        request.onerror=()=>reject(request.error||new Error(`خواندن داده‌های ${store} ناموفق بود`));
      });
      tx.onerror=()=>reject(tx.error||new Error('خواندن داده‌های ذخیره‌شده ناموفق بود'));
      tx.onabort=()=>reject(tx.error||new Error('خواندن داده‌های ذخیره‌شده لغو شد'));
    });
  },
  applySnapshot(snapshot,previousSnapshot){
    return new Promise((resolve,reject)=>{
      const stores=[...NORMALIZED_STORES,SYNC_PENDING_STORE];
      const tx=this.database.transaction(stores,'readwrite');
      const pending=tx.objectStore(SYNC_PENDING_STORE);
      NORMALIZED_STORES.forEach(store=>{
        const objectStore=tx.objectStore(store);
        const next=snapshot.get(store);
        const previous=previousSnapshot&&previousSnapshot.get(store)||new Map();
        previous.forEach((_,id)=>{
          if(!next.has(id)){
            objectStore.delete(id);
            pending.put({id:`${store}::${id}`,store,recordId:id,operation:'delete',changedAt:Date.now(),deviceId:syncDeviceId,revision:newSyncRevision()});
          }
        });
        next.forEach((serialized,id)=>{
          if(previous.get(id)===serialized)return;
          const record=JSON.parse(serialized);
          objectStore.put(record);
          pending.put({id:`${store}::${id}`,store,recordId:id,operation:'put',payload:record,changedAt:Date.now(),deviceId:syncDeviceId,revision:newSyncRevision()});
        });
      });
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('ذخیره‌سازی در IndexedDB ناموفق بود'));
      tx.onabort=()=>reject(tx.error||new Error('ذخیره‌سازی در IndexedDB لغو شد'));
    });
  },
  applyMutations(mutations){
    if(!mutations.length)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const tx=this.database.transaction([...new Set(mutations.map(item=>item.store)),SYNC_PENDING_STORE],'readwrite');
      const pending=tx.objectStore(SYNC_PENDING_STORE);
      mutations.forEach(mutation=>{
        const objectStore=tx.objectStore(mutation.store);
        const change={
          id:`${mutation.store}::${mutation.id}`,
          store:mutation.store,
          recordId:mutation.id,
          operation:mutation.operation,
          changedAt:Date.now(),
          deviceId:syncDeviceId,
          revision:newSyncRevision()
        };
        if(Array.isArray(mutation.fields))change.fields=mutation.fields;
        if(mutation.operation==='delete'){
          objectStore.delete(mutation.id);
          if(mutation.value!=null)change.payload=mutation.record();
        }else{
          const record=mutation.record();
          objectStore.put(record);
          change.payload=record;
        }
        pending.put(change);
      });
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('ذخیره‌سازی تغییرات در IndexedDB ناموفق بود'));
      tx.onabort=()=>reject(tx.error||new Error('ذخیره‌سازی تغییرات در IndexedDB لغو شد'));
    });
  },
  getPendingChanges(limit=500){
    return new Promise((resolve,reject)=>{
      const tx=this.database.transaction(SYNC_PENDING_STORE,'readonly');
      const request=tx.objectStore(SYNC_PENDING_STORE).openCursor();
      const result=[];
      request.onsuccess=()=>{
        const cursor=request.result;
        if(!cursor||result.length>=Math.max(1,limit)){resolve(sanitizeSyncChanges(result));return;}
        result.push(cursor.value);
        cursor.continue();
      };
      request.onerror=()=>reject(request.error||new Error('خواندن تغییرات همگام‌سازی ناموفق بود'));
    });
  },
  acknowledgeChanges(acknowledgements){
    return new Promise((resolve,reject)=>{
      const tx=this.database.transaction(SYNC_PENDING_STORE,'readwrite');
      const store=tx.objectStore(SYNC_PENDING_STORE);
      acknowledgements.forEach(({id,revision})=>{
        const request=store.get(id);
        request.onsuccess=()=>{
          if(request.result&&request.result.revision===revision)store.delete(id);
        };
      });
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('تأیید تغییرات همگام‌سازی ناموفق بود'));
      tx.onabort=()=>reject(tx.error||new Error('تأیید تغییرات همگام‌سازی لغو شد'));
    });
  }
};

let state;
const pendingStorageMutations=new Map();
const storageProxyTargets=new WeakMap();
const STORAGE_COLLECTIONS={
  subjects:'subjects',
  activities:'activities',
  classes:'classes',
  sessions:'sessions',
  sleeps:'sleeps',
  phones:'phones',
  exams:'exams'
};
function rawStorageValue(value){
  return value&&typeof value==='object'?(storageProxyTargets.get(value)||value):value;
}
function unwrapStorageValue(value){
  if(Array.isArray(value))return value.map(rawStorageValue);
  return rawStorageValue(value);
}
/* برای مقایسهٔ فیلدها؛ فقط برای تشخیص این‌که کدام فیلدها واقعاً عوض شده‌اند */
function storageFieldSignature(value){
  try{return JSON.stringify(value===undefined?null:value);}catch(error){return undefined;}
}
/* فهرست فیلدهایی که بین دو نسخه از یک رکورد تغییر کرده‌اند.
   خروجی undefined یعنی «نامشخص» (رکورد تازه) و باید کل مقدار ارسال شود. */
function changedFieldNames(oldValue,nextValue){
  const oldRaw=rawStorageValue(oldValue);
  const nextRaw=rawStorageValue(nextValue);
  if(!nextRaw||typeof nextRaw!=='object'||Array.isArray(nextRaw))return undefined;
  if(!oldRaw||typeof oldRaw!=='object'||Array.isArray(oldRaw))return undefined;
  const changed=[];
  const keys=new Set([...Object.keys(oldRaw),...Object.keys(nextRaw)]);
  keys.forEach(key=>{
    const before=storageFieldSignature(oldRaw[key]);
    const after=storageFieldSignature(nextRaw[key]);
    if(before!==after)changed.push(key);
  });
  return changed;
}
function mergeMutationFields(existing,metadata){
  if(!Array.isArray(metadata.fields))return metadata;
  const current=existing&&existing.operation==='put'&&Array.isArray(existing.fields)?existing.fields:[];
  return {...metadata,fields:[...new Set([...current,...metadata.fields])]};
}
function markStorageMutation(store,id,operation,value,metadata={}){
  if(id==null)return;
  const key=`${store}::${id}`;
  if(operation==='delete'){
    pendingStorageMutations.set(key,{store,id:String(id),operation,value:rawStorageValue(value),...metadata});
    return;
  }
  const existing=pendingStorageMutations.get(key);
  const merged=mergeMutationFields(existing,metadata);
  pendingStorageMutations.set(key,{store,id:String(id),operation:'put',value:rawStorageValue(value),...merged});
}
function markStorageDeletion(store,id,value,metadata={}){
  markStorageMutation(store,id,'delete',value,metadata);
  if(store==='exams'&&value){
    (rawStorageValue(value).questions||[]).forEach((question,order)=>
      markStorageMutation('questions',`${id}::${question.id}`,'delete',question,{examId:String(id),order})
    );
  }
}
function entityIdFor(store,value,key,metadata={}){
  if(store==='subjects')return value&&value.name;
  if(store==='classes')return key;
  if(store==='questions')return value&&`${metadata.examId}::${value.id}`;
  return value&&value.id;
}
function markArrayReplacement(store,oldValue,newValue,metadata={}){
  const oldItems=Array.isArray(oldValue)?oldValue.map(rawStorageValue):[];
  const newItems=Array.isArray(newValue)?newValue.map(rawStorageValue):[];
  const oldById=new Map(oldItems.map((item,index)=>[String(entityIdFor(store,item,metadata.date,metadata)),{item,index}]).filter(([id])=>id!=='undefined'));
  const newById=new Map(newItems.map((item,index)=>[String(entityIdFor(store,item,metadata.date,metadata)),{item,index}]).filter(([id])=>id!=='undefined'));
  oldById.forEach(({item},id)=>{if(!newById.has(id))markStorageDeletion(store,id,item,{...metadata});});
  newById.forEach(({item,index},id)=>{
    const old=oldById.get(id);
    if(!old){
      markStorageMutation(store,id,'put',item,{...metadata,order:index});
      return;
    }
    /* فقط جابه‌جایی (بدون تغییر مقدار) هم ثبت می‌شود، ولی با فهرست فیلدهای
       خالی؛ هنگام ارسال فقط «order» می‌رود و مقدار قدیمی رکورد را بازنویسی
       نمی‌کند. این کار جلوی پاک‌شدن ویرایش تازهٔ دستگاه دیگر را می‌گیرد. */
    const fields=changedFieldNames(old.item,item);
    if(old.index===index&&fields&&!fields.length)return;
    markStorageMutation(store,id,'put',item,{...metadata,order:index,fields});
  });
}
function markStorageCollection(store,oldValue,newValue){
  if(store==='exams'){
    const oldExams=Array.isArray(oldValue)?oldValue:[];
    const newExams=Array.isArray(newValue)?newValue:[];
    markArrayReplacement('exams',oldExams,newExams);
    const nextById=new Map(newExams.map(exam=>[String(exam.id),exam]));
    oldExams.forEach(exam=>{
      const current=nextById.get(String(exam.id));
      if(!current){
        markStorageDeletion('exams',exam.id,exam);
      }else if(current!==exam){
        markArrayReplacement('questions',exam.questions||[],current.questions||[],{examId:exam.id});
      }
    });
    newExams.forEach(exam=>{
      if(!oldExams.some(previous=>String(previous.id)===String(exam.id))){
        markArrayReplacement('questions',[],exam.questions||[],{examId:exam.id});
      }
    });
    return;
  }
  if(store==='classes'){
    const oldMap=oldValue&&typeof oldValue==='object'?oldValue:{};
    const newMap=newValue&&typeof newValue==='object'?newValue:{};
    Object.keys(oldMap).forEach(id=>{if(!Object.prototype.hasOwnProperty.call(newMap,id))markStorageDeletion('classes',id,oldMap[id]);});
    Object.entries(newMap).forEach(([id,value],order)=>{
      if(oldMap[id]!==value)markStorageMutation('classes',id,'put',value,{order});
    });
    return;
  }
  markArrayReplacement(store,oldValue,newValue);
}
function storageContextForChild(context,target,key){
  if(!context){
    if(key==='profile'||key==='settings'||key==='commonErrors')return{kind:'entity',store:'app-meta',id:DB_STATE_ID};
    if(STORAGE_COLLECTIONS[key])return{kind:'collection',store:STORAGE_COLLECTIONS[key]};
    return null;
  }
  if(context.kind==='collection'&&/^(0|[1-9]\d*)$/.test(String(key))){
    const value=rawStorageValue(target[key]);
    if(context.store==='questions'){
      return value?{kind:'entity',store:'questions',id:`${context.examId}::${value.id}`,examId:context.examId,value}:null;
    }
    const id=entityIdFor(context.store,value,undefined,context);
    return id==null?null:{kind:'entity',store:context.store,id:String(id),value,order:+key,examId:context.examId};
  }
  if(context.kind==='classes-map'){
    const value=rawStorageValue(target[key]);
    return value?{kind:'entity',store:'classes',id:String(key),value}:null;
  }
  if(context.kind==='entity'&&context.store==='exams'&&key==='questions'){
    return{kind:'collection',store:'questions',examId:context.id};
  }
  if(context.kind==='entity'&&context.store==='app-meta'&&(key==='profile'||key==='settings'||key==='commonErrors')){
    return context;
  }
  return context;
}
function storageMutationRecord(mutation){
  if(mutation.store==='app-meta'){
    return{id:DB_STATE_ID,value:{
      profile:rawStorageValue(state.profile),
      commonErrors:rawStorageValue(state.commonErrors),
      settings:rawStorageValue(state.settings)
    }};
  }
  const value=mutation.value;
  if(mutation.store==='exams'){
    const exam={...value};
    delete exam.questions;
    return{id:mutation.id,value:exam,order:mutation.order||0};
  }
  if(mutation.store==='questions'){
    return{id:mutation.id,examId:mutation.examId,value,order:mutation.order||0};
  }
  return{id:mutation.id,value,order:mutation.order||0};
}
function trackStorageState(value){
  const cache=new WeakMap();
  function wrap(target,context){
    target=rawStorageValue(target);
    if(!target||typeof target!=='object')return target;
    let contexts=cache.get(target);
    if(!contexts){contexts=new Map();cache.set(target,contexts);}
    const cacheKey=context?`${context.kind}:${context.store||''}:${context.id||''}:${context.examId||''}`:'root';
    if(contexts.has(cacheKey))return contexts.get(cacheKey);
    const proxy=new Proxy(target,{
      get(object,key){
        if(typeof key==='symbol')return Reflect.get(object,key);
        const child=Reflect.get(object,key);
        let next=storageContextForChild(context,object,key);
        if(context&&context.kind==='entity'&&context.store==='exams'&&key==='questions')next={kind:'collection',store:'questions',examId:context.id};
        if(context&&context.kind==='entity'&&context.store==='app-meta')next=context;
        if(!context&&key==='classes')next={kind:'classes-map',store:'classes'};
        return wrap(child,next);
      },
      set(object,key,nextValue){
        const oldValue=object[key];
        const oldRaw=rawStorageValue(oldValue);
        const nextRaw=unwrapStorageValue(nextValue);
        if(context&&context.kind==='collection'&&key==='length'&&+nextRaw<oldValue){
          for(let index=+nextRaw;index<oldValue;index++){
            const removed=object[index];
            const id=entityIdFor(context.store,removed,undefined,context);
            if(id!=null)markStorageDeletion(context.store,id,removed,context);
          }
        }
        if(!Reflect.set(object,key,nextRaw))return false;
        if(!context){
          if(key==='profile'||key==='settings'||key==='commonErrors')markStorageMutation('app-meta',DB_STATE_ID,'put',null);
          else if(STORAGE_COLLECTIONS[key])markStorageCollection(STORAGE_COLLECTIONS[key],oldRaw,nextRaw);
          else if(key==='classes')markStorageCollection('classes',oldRaw,nextRaw);
          return true;
        }
        if(context.kind==='entity'){
          if((context.store==='subjects'&&key==='name')||key==='id'){
            if(String(oldValue)!==String(nextRaw))markStorageDeletion(context.store,context.id,object,{...context});
            const updatedId=entityIdFor(context.store,object,context.date);
            markStorageMutation(context.store,updatedId,'put',object,{...context,order:context.order});
          }else markStorageMutation(context.store,context.id,'put',object,{...context,order:context.order,fields:[String(key)]});
          return true;
        }
        if(context.kind==='entity'&&context.store==='app-meta'){
          markStorageMutation('app-meta',DB_STATE_ID,'put',null);
          return true;
        }
        if(context.kind==='collection'&&/^(0|[1-9]\d*)$/.test(String(key))){
          const index=+key;
          const oldId=entityIdFor(context.store,oldRaw,undefined,context);
          const nextId=entityIdFor(context.store,nextRaw,undefined,context);
          if(oldId!=null&&String(oldId)!==String(nextId))markStorageDeletion(context.store,oldId,oldRaw,{...context});
          if(nextId!=null){
            const metadata=context.store==='questions'
              ?{examId:context.examId,order:index}
              :{order:index};
            metadata.fields=changedFieldNames(oldRaw,nextRaw);
            markStorageMutation(context.store,nextId,'put',nextRaw,metadata);
          }
          return true;
        }
        if(context.kind==='classes-map'){
          markStorageMutation('classes',key,'put',nextRaw);
          return true;
        }
        return true;
      },
      deleteProperty(object,key){
        const oldValue=rawStorageValue(object[key]);
        if(!Reflect.deleteProperty(object,key))return false;
        if(!context){
          if(key==='profile'||key==='settings'||key==='commonErrors')markStorageMutation('app-meta',DB_STATE_ID,'put',null);
          else if(STORAGE_COLLECTIONS[key])markStorageCollection(STORAGE_COLLECTIONS[key],oldValue,[]);
          return true;
        }
        if(context.kind==='entity')markStorageMutation(context.store,context.id,'put',object,{...context});
        else if(context.kind==='collection'&&/^(0|[1-9]\d*)$/.test(String(key))){
          const id=entityIdFor(context.store,oldValue,undefined,context);
          if(id!=null)markStorageDeletion(context.store,id,oldValue,context);
        }else if(context.kind==='classes-map')markStorageDeletion('classes',key,oldValue);
        return true;
      }
    });
    storageProxyTargets.set(proxy,target);
    contexts.set(cacheKey,proxy);
    return proxy;
  }
  return wrap(value,null);
}
function replaceTrackedState(value,markAll=false){
  const previousState=state;
  state=trackStorageState(value);
  if(markAll){
    markStorageMutation('app-meta',DB_STATE_ID,'put',null);
    ['subjects','activities','sleeps','phones','sessions','exams'].forEach(store=>
      markStorageCollection(store,previousState&&previousState[store]||[],state[store])
    );
    markStorageCollection('classes',previousState&&previousState.classes||{},state.classes);
  }
}
state=trackStorageState(defaultState());
let storageMode='indexeddb';
let storageWriteQueue=Promise.resolve();
let storageWarningShown=false;
let storageWriteError=null;

let syncRevision=0;

function getSyncDeviceId(){
  try{
    let id=localStorage.getItem(SYNC_DEVICE_KEY);
    if(!id){id=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():uid();localStorage.setItem(SYNC_DEVICE_KEY,id);}
    return id;
  }catch(error){
    console.warn('[sync] persistent device identity unavailable:',error);
    return`session-${uid()}`;
  }
}
const syncDeviceId=getSyncDeviceId();
function newSyncRevision(){
  syncRevision=Math.max(Date.now(),syncRevision+1);
  return`${syncRevision}-${syncDeviceId}-${uid()}`;
}

async function initializeStorage(){
  let recoveryData=null;
  let indexedDbOpened=false;
  try{
    await appStateRepository.open();
    indexedDbOpened=true;
    const stored=await appStateRepository.getNormalized();
    if(stored){
      recoveryData=stored;
      const needsMathTopicMigration=Array.isArray(stored.subjects)&&stored.subjects.some(subject=>
        subject&&MATH_FIELD_SPECIALIZED_TOPICS[subject.name]&&
        (subject.topicsByFieldVersion!==3||Object.prototype.hasOwnProperty.call(subject,'mathTopicMode'))
      );
      const needsGeneralCurriculumMigration=needsFieldManagedGeneralMigration(stored,stored.profile&&stored.profile.field||'تجربی');
      const needsSessionsMigration=!!stored._sessionsMigrated;
      const needsMigration=needsMathTopicMigration||needsGeneralCurriculumMigration||needsSessionsMigration;
      replaceTrackedState(normalizeStateData(stored),needsMigration);
      if(needsMigration){save();await flushStorage();}
      try{await appStateRepository.clearLegacyStores();}
      catch(cleanupError){console.warn('[storage] legacy cleanup failed:',cleanupError);}
      return;
    }
    let legacy=await appStateRepository.getLegacy();
    const raw=localStorage.getItem(LS_KEY);
    if(!legacy&&raw)legacy=JSON.parse(raw);
    recoveryData=legacy;
    if(legacy)replaceTrackedState(normalizeStateData(legacy));
    const snapshot=normalizedStorageSnapshot(compactStateForStorage(state));
    await appStateRepository.applySnapshot(snapshot,new Map(NORMALIZED_STORES.map(store=>[store,new Map()])));
    pendingStorageMutations.clear();
    try{await appStateRepository.deleteLegacy();}
    catch(error){console.warn('[storage] normalized data migrated but legacy data could not be removed:',error);}
    try{await appStateRepository.clearLegacyStores();}
    catch(error){console.warn('[storage] legacy stores cleanup failed:',error);}
    if(legacy)localStorage.removeItem(LS_KEY);
  }catch(error){
    storageMode='localStorage';
    try{
      const raw=localStorage.getItem(LS_KEY);
      const localNormalized=!recoveryData?readLocalNormalizedRecords():null;
      const legacy=recoveryData||localNormalized||(raw?JSON.parse(raw):null);
      if(indexedDbOpened&&!legacy)throw new Error('خواندن داده‌های IndexedDB انجام نشد و نسخه پشتیبان دیگری وجود ندارد.');
      const needsNormalization=legacy&&Array.isArray(legacy.subjects)&&legacy.subjects.some(subject=>
        subject&&MATH_FIELD_SPECIALIZED_TOPICS[subject.name]&&
        (subject.topicsByFieldVersion!==3||Object.prototype.hasOwnProperty.call(subject,'mathTopicMode'))
      );
      const needsGeneralCurriculumMigration=!!legacy&&needsFieldManagedGeneralMigration(legacy,legacy.profile&&legacy.profile.field||'تجربی');
      const needsSessionsMigration=!!legacy&&!Array.isArray(legacy.sessions)&&((legacy.plan&&Object.keys(legacy.plan).length)||(legacy.reserved&&legacy.reserved.length));
      const useExistingLocalRows=!!localNormalized&&!needsNormalization&&!needsGeneralCurriculumMigration&&!needsSessionsMigration;
      replaceTrackedState(legacy?normalizeStateData(legacy):defaultState(),!useExistingLocalRows);
      if(!useExistingLocalRows){
        save();
        await flushStorage();
      }
      if(raw)try{localStorage.removeItem(LS_KEY);}
      catch(removeError){console.warn('[storage] normalized local data is available but the legacy copy could not be removed:',removeError);}
    }catch(legacyError){
      console.error('[storage] IndexedDB and legacy storage initialization failed:',error,legacyError);
      throw new Error('خواندن اطلاعات برنامه از IndexedDB و حافظه قدیمی ممکن نشد.');
    }
    console.error('[storage] IndexedDB unavailable; using legacy localStorage:',error);
    setTimeout(()=>toast('IndexedDB در دسترس نیست؛ ذخیره‌سازی موقت فعال شد.'),0);
  }
}

function takeStorageMutations(){
  const mutations=[...pendingStorageMutations.values()].map(mutation=>({
    ...mutation,
    record:()=>storageMutationRecord(mutation)
  }));
  pendingStorageMutations.clear();
  return mutations;
}
function restoreStorageMutations(mutations){
  mutations.forEach(mutation=>{
    const key=`${mutation.store}::${mutation.id}`;
    if(!pendingStorageMutations.has(key))pendingStorageMutations.set(key,mutation);
  });
}
function save(){
  const mutations=takeStorageMutations();
  if(!mutations.length)return true;
  storageWriteQueue=storageWriteQueue.then(()=>{
    if(storageMode==='indexeddb')return appStateRepository.applyMutations(mutations);
    applyLocalStorageMutations(mutations);
  }).then(()=>{
    storageWriteError=null;
    if(typeof window._postSaveHook === 'function'){
      try { window._postSaveHook(); } catch(e) { console.warn('[save] post-save hook failed:', e); }
    }
  },error=>{
    restoreStorageMutations(mutations);
    storageWriteError=error;
    console.error('[storage] save failed:',error);
    if(!storageWarningShown){storageWarningShown=true;try{toast('ذخیره‌سازی انجام نشد. فضای ذخیره‌سازی را بررسی کن.');}catch(e){console.warn('[storage] toast failed:', e);}}
  });
  return true;
}
function flushStorage(){
  return storageWriteQueue.then(()=>{
    if(storageWriteError)throw storageWriteError;
  });
}

/* نوشتن تغییرات سرور؛ فقط پس از آن‌که مطمئن شدیم تغییر محلی‌ای
   برای همان رکورد در انتظار ارسال نیست فراخوانی می‌شود. */
function applyRemoteChangesNow(puts, deletes, acknowledge){
  if (storageMode === 'indexeddb') {
    if (!appStateRepository.database) return Promise.reject(new Error('ذخیره‌سازی همگام‌سازی در دسترس نیست'));
    return new Promise((resolve, reject) => {
      const stores = [...new Set([
        ...puts.map(item => item.store),
        ...deletes.map(item => item.store),
        SYNC_PENDING_STORE
      ])];
      const tx = appStateRepository.database.transaction(stores, 'readwrite');
      puts.forEach(({store, record}) => tx.objectStore(store).put(record));
      deletes.forEach(({store, id}) => tx.objectStore(store).delete(String(id)));
      const pending = tx.objectStore(SYNC_PENDING_STORE);
      acknowledge.forEach(({store, id}) => pending.delete(`${store}::${id}`));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('اعمال تغییرات سرور ناموفق بود'));
      tx.onabort = () => reject(tx.error || new Error('اعمال تغییرات سرور لغو شد'));
    });
  }
  puts.forEach(({store, record}) => {
    try { localStorage.setItem(localStorageRecordKey(store, record.id), JSON.stringify(record)); }
    catch (error) { console.warn('[storage] writing remote record failed:', error); }
  });
  deletes.forEach(({store, id}) => {
    try { localStorage.removeItem(localStorageRecordKey(store, id)); }
    catch (error) { console.warn('[storage] deleting remote record failed:', error); }
  });
  acknowledge.forEach(({store, id}) => {
    try { localStorage.removeItem(localStoragePendingKey(store, id)); }
    catch (error) { console.warn('[storage] clearing remote change failed:', error); }
  });
  return Promise.resolve();
}

window.storageSync = {
  pendingChangesProvider: (limit) => {
    if(storageMode==='indexeddb' && !appStateRepository.database){
      return Promise.reject(new Error('ذخیره‌سازی همگام‌سازی در دسترس نیست'));
    }
    return flushStorage().then(() => storageMode==='indexeddb'
      ? appStateRepository.getPendingChanges(limit)
      : getLocalPendingChanges(limit)
    ).then(sanitizeSyncChanges);
  },
  acknowledger: (acknowledgements) => {
    if(!Array.isArray(acknowledgements) || acknowledgements.some(change => {
      if(!change || typeof change.id !== 'string' || typeof change.revision !== 'string') return true;
      const sep = change.id.indexOf('::');
      const storeName = change.id.slice(0, sep);
      return sep < 1 || (!NORMALIZED_STORES.includes(storeName) && !LEGACY_STORES.includes(storeName));
    })){
      return Promise.reject(new TypeError('تغییرات تأییدشده باید شناسه و نسخه داشته باشند'));
    }
    if(storageMode === 'indexeddb') return appStateRepository.acknowledgeChanges(acknowledgements);
    acknowledgeLocalChanges(acknowledgements);
    return Promise.resolve();
  },
  /* اعمال تغییرات دریافتی از سرور بدون ثبت آن‌ها به‌عنوان تغییر محلی.
     اگر برای همان رکورد تغییری در انتظار ارسال باشد، نسخهٔ سرور کنار گذاشته
     می‌شود؛ وگرنه ویرایشی که کاربر همین حالا انجام داده از بین می‌رفت. */
  applyRemoteChanges: (changes) => {
    const puts = (changes && Array.isArray(changes.puts) ? changes.puts : []).filter(item =>
      item && NORMALIZED_STORES.includes(item.store) && item.record && item.record.id != null
    );
    const deletes = (changes && Array.isArray(changes.deletes) ? changes.deletes : []).filter(item =>
      item && NORMALIZED_STORES.includes(item.store) && item.id != null
    );
    const acknowledge = (changes && Array.isArray(changes.acknowledge) ? changes.acknowledge : []).filter(item =>
      item && NORMALIZED_STORES.includes(item.store) && item.id != null
    );
    if (!puts.length && !deletes.length && !acknowledge.length) return Promise.resolve();
    const pendingRead = storageMode === 'indexeddb'
      ? (appStateRepository.database ? appStateRepository.getPendingChanges(100000) : Promise.resolve([]))
      : Promise.resolve(getLocalPendingChanges(100000));
    return pendingRead.catch(() => []).then(pendingList => {
      const guarded = new Set((pendingList || [])
        .filter(change => change && change.store && change.recordId != null)
        .map(change => `${change.store}::${change.recordId}`));
      if (!guarded.size) return applyRemoteChangesNow(puts, deletes, acknowledge);
      const keyOf = item => `${item.store}::${item.record && item.record.id != null ? item.record.id : item.id}`;
      return applyRemoteChangesNow(
        puts.filter(item => !guarded.has(keyOf(item))),
        deletes.filter(item => !guarded.has(keyOf(item))),
        acknowledge.filter(item => !guarded.has(keyOf(item)))
      );
    });
  },
  /* خواندن دوبارهٔ state از حافظه پس از اعمال تغییرات سرور، بدون بارگذاری صفحه */
  reloadState: async () => {
    await flushStorage();
    let stored = null;
    if (storageMode === 'indexeddb') {
      if (!appStateRepository.database) throw new Error('ذخیره‌سازی همگام‌سازی در دسترس نیست');
      stored = await appStateRepository.getNormalized();
    } else {
      stored = readLocalNormalizedRecords();
    }
    if (!stored) throw new Error('خواندن داده‌های ذخیره‌شده ممکن نشد');
    replaceTrackedState(normalizeStateData(stored), false);
    return true;
  }
};

function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1800);}

/* ============ HELPERS ============ */
function subjColor(n){if(n===EXAM_SUBJECT)return EXAM_COLOR;if(n===OTHER_SUBJECT)return state.settings.otherColor||OTHER_COLOR;const s=state.subjects.find(x=>x.name===n);return s?s.color:'#7c5cff';}
function subjGrades(name){
  const s=state.subjects.find(x=>x.name===name);
  const availableGrades=s&&s.grades&&s.grades.length?s.grades:GRADES;
  const profileGrade=state.profile&&state.profile.grade;
  if(name==='ریاضی'&&state.profile.field==='تجربی'&&PROFILE_GRADES.includes(profileGrade))return [profileGrade];
  if(profileGrade==='دوازدهم')return availableGrades;
  return availableGrades.includes(profileGrade)?[profileGrade]:[];
}
function getTopics(subj,grade){
  const s=state.subjects.find(x=>x.name===subj);if(!s)return[];
  if(!subjGrades(subj).includes(grade))return[];
  if(s.topicsByField&&s.topicsByField[state.profile.field]&&Array.isArray(s.topicsByField[state.profile.field][grade]))return s.topicsByField[state.profile.field][grade];
  return s.topics&&Array.isArray(s.topics[grade])?s.topics[grade]:[];
}
function topicGrade(subj,topic){const s=state.subjects.find(x=>x.name===subj);if(!s)return'';for(const g of(s.grades||[])){if(getTopics(subj,g).includes(topic))return g;}return'';}

function getErr(id){
  for(const e of state.commonErrors) if(e.id===id) return e;
  for(const s of state.subjects){
    if(Array.isArray(s.errors)) for(const e of s.errors) if(e.id===id) return e;
    if(Array.isArray(s.specialTags)) for(const e of s.specialTags) if(e.id===id) return e;
  }
  return null;
}
function errLabel(id){const e=getErr(id);return e?e.label:id;}
function qStatus(q){return['correct','wrong','blank','pending'].includes(q.status)?q.status:'pending';}
const STATUS_LABEL={correct:'درست',wrong:'غلط',blank:'نزده',pending:'ثبت نشده'};

function allSubjectsForSelect(){return[...state.subjects.filter(subject=>subject.type==='specialized'||isGeneralSubjectAvailableInField(subject,state.profile.field)),{name:OTHER_SUBJECT,color:subjColor(OTHER_SUBJECT),sessions:0,type:'other'}];}
function subjectCanHaveTests(name){if(name===OTHER_SUBJECT)return false;const s=state.subjects.find(x=>x.name===name);return s?s.type==='specialized':false;}
function subjectSelectOptions(list,selected='',includeOther=true){
  const specialized=list.filter(s=>s.name!==OTHER_SUBJECT&&s.type==='specialized');
  const general=list.filter(s=>s.name!==OTHER_SUBJECT&&s.type!=='specialized');
  const other=includeOther?list.filter(s=>s.name===OTHER_SUBJECT):[];
  const opts=(items)=>items.map(s=>`<option value="${esc(s.name)}" ${s.name===selected?'selected':''}>${esc(s.name)}</option>`).join('');
  return`${specialized.length?`<optgroup label="تخصصی">${opts(specialized)}</optgroup>`:''}${general.length?`<optgroup label="عمومی">${opts(general)}</optgroup>`:''}${other.length?`<optgroup label="سایر">${opts(other)}</optgroup>`:''}`;
}
function planningSubjects(){return allSubjectsForSelect();}
function specializedSubjectNames(){return state.subjects.filter(s=>s.type==='specialized').map(s=>s.name);}

/* ============ OVERVIEW HELPERS ============ */
function getSubjectLessons(subjectName, grade){
  const s=state.subjects.find(x=>x.name===subjectName);
  if(!s||s.type!=='general') return 0;
  if(s.lessonsByGrade && s.lessonsByGrade[grade]!=null) return Math.max(0,+s.lessonsByGrade[grade]||0);
  return 0;
}
function isFreeLesson(subjectName, grade, lessonIdx){
  const s=state.subjects.find(x=>x.name===subjectName);
  if(!s || !s.freeLessons) return false;
  const arr=s.freeLessons[grade]||[];
  return arr.includes(lessonIdx+1);
}
function getTopicRecord(subjectName, grade, topic){
  const s=state.subjects.find(x=>x.name===subjectName);
  if(!s||!s.topicRecords)return null;
  const g=s.topicRecords[grade];
  return g?g[topic]||null:null;
}
function setTopicRecord(subjectName, grade, topic, record){
  const s=state.subjects.find(x=>x.name===subjectName);
  if(!s)return;
  if(!s.topicRecords)s.topicRecords={};
  if(!s.topicRecords[grade])s.topicRecords[grade]={};
  if(record)s.topicRecords[grade][topic]=record;
  else delete s.topicRecords[grade][topic];
  save();
}
function getLessonRecord(subjectName, grade, lessonIdx){
  const s=state.subjects.find(x=>x.name===subjectName);
  if(!s||!s.lessonRecords)return null;
  const g=s.lessonRecords[grade];
  return g?(g[lessonIdx]||null):null;
}
function setLessonRecord(subjectName, grade, lessonIdx, record){
  const s=state.subjects.find(x=>x.name===subjectName);
  if(!s)return;
  if(!s.lessonRecords)s.lessonRecords={};
  if(!s.lessonRecords[grade])s.lessonRecords[grade]={};
  if(record)s.lessonRecords[grade][lessonIdx]=record;
  else delete s.lessonRecords[grade][lessonIdx];
  save();
}

/* ============ CHAPTER SECTIONS ============ */
function getChapterSections(subjectName, grade, chapterName){
  const s=state.subjects.find(x=>x.name===subjectName);
  if(!s || !s.chapterSections) return [];
  const g=s.chapterSections[grade];
  if(!g) return [];
  return g[chapterName]||[];
}
function getSectionRecord(subjectName, grade, chapterName, sectionName){
  const chapterRec=getTopicRecord(subjectName, grade, chapterName);
  if(!chapterRec || !chapterRec.sections) return null;
  return chapterRec.sections[sectionName]||null;
}
function setSectionRecord(subjectName, grade, chapterName, sectionName, record){
  const chapterRec=getTopicRecord(subjectName, grade, chapterName)||{studied:false,reviews:[],sections:{}};
  if(!chapterRec.sections) chapterRec.sections={};
  if(record) chapterRec.sections[sectionName]=record;
  else delete chapterRec.sections[sectionName];
  setTopicRecord(subjectName, grade, chapterName, chapterRec);
}
function isChapterStudied(subjectName, grade, chapterName){
  const sections=getChapterSections(subjectName, grade, chapterName);
  if(sections.length>0){return sections.every(sec=>{const rec=getSectionRecord(subjectName, grade, chapterName, sec);return rec && rec.studied;});}
  const rec=getTopicRecord(subjectName, grade, chapterName);
  return rec && rec.studied;
}
function getChapterLastReview(subjectName, grade, chapterName){
  const sections=getChapterSections(subjectName, grade, chapterName);
  if(sections.length>0){
    let lastDate=null, lastTs=0;
    sections.forEach(sec=>{
      const rec=getSectionRecord(subjectName, grade, chapterName, sec);
      if(rec && rec.reviews && rec.reviews.length){
        const lastRev=rec.reviews[rec.reviews.length-1];
        if((lastRev.ts||0)>lastTs){lastTs=lastRev.ts||0;lastDate=lastRev.date;}
      }
    });
    return lastDate;
  }
  const rec=getTopicRecord(subjectName, grade, chapterName);
  if(rec && rec.reviews && rec.reviews.length){return rec.reviews[rec.reviews.length-1].date;}
  return null;
}

/* ============ LESSON SECTIONS ============ */
function getLessonSections(subjectName, grade, lessonIdx){
  const s=state.subjects.find(x=>x.name===subjectName);
  if(!s || !s.lessonSections) return [];
  const g=s.lessonSections[grade];
  if(!g) return [];
  return g[lessonIdx]||[];
}
function setLessonSections(subjectName, grade, lessonIdx, sections){
  const s=state.subjects.find(x=>x.name===subjectName);
  if(!s) return;
  if(!s.lessonSections) s.lessonSections={'دهم':{},'یازدهم':{},'دوازدهم':{}};
  if(!s.lessonSections[grade]) s.lessonSections[grade]={};
  if(sections && sections.length){s.lessonSections[grade][lessonIdx]=sections.slice();}
  else{delete s.lessonSections[grade][lessonIdx];}
  save();
}
function getLessonSectionRecord(subjectName, grade, lessonIdx, sectionName){
  const lessonRec=getLessonRecord(subjectName, grade, lessonIdx);
  if(!lessonRec || !lessonRec.sections) return null;
  return lessonRec.sections[sectionName]||null;
}
function setLessonSectionRecord(subjectName, grade, lessonIdx, sectionName, record){
  const lessonRec=getLessonRecord(subjectName, grade, lessonIdx) || {studied:false, reviews:[], sections:{}};
  if(!lessonRec.sections) lessonRec.sections={};
  if(record) lessonRec.sections[sectionName]=record;
  else delete lessonRec.sections[sectionName];
  setLessonRecord(subjectName, grade, lessonIdx, lessonRec);
}
function isLessonFullyStudied(subjectName, grade, lessonIdx){
  const sections=getLessonSections(subjectName, grade, lessonIdx);
  if(sections.length>0){return sections.every(sec=>{const rec=getLessonSectionRecord(subjectName, grade, lessonIdx, sec);return rec && rec.studied;});}
  const rec=getLessonRecord(subjectName, grade, lessonIdx);
  return rec && rec.studied;
}
function getLessonLastReview(subjectName, grade, lessonIdx){
  const sections=getLessonSections(subjectName, grade, lessonIdx);
  if(sections.length>0){
    let lastDate=null, lastTs=0;
    sections.forEach(sec=>{
      const rec=getLessonSectionRecord(subjectName, grade, lessonIdx, sec);
      if(rec && rec.reviews && rec.reviews.length){
        const lastRev=rec.reviews[rec.reviews.length-1];
        if((lastRev.ts||0)>lastTs){lastTs=lastRev.ts||0;lastDate=lastRev.date;}
      }
    });
    return lastDate;
  }
  const rec=getLessonRecord(subjectName, grade, lessonIdx);
  if(rec && rec.reviews && rec.reviews.length){return rec.reviews[rec.reviews.length-1].date;}
  return null;
}

/* ============ REVIEW COUNTS ============ */
function getLessonReviewCount(subjectName, grade, lessonIdx){
  const sections = getLessonSections(subjectName, grade, lessonIdx);
  if(sections.length > 0){
    let minCount = Infinity;
    sections.forEach(sec=>{const rec = getLessonSectionRecord(subjectName, grade, lessonIdx, sec);const cnt = rec && rec.reviews ? rec.reviews.length : 0;if(cnt < minCount) minCount = cnt;});
    return minCount === Infinity ? 0 : minCount;
  }
  const rec = getLessonRecord(subjectName, grade, lessonIdx);
  return rec && rec.reviews ? rec.reviews.length : 0;
}
function getChapterReviewCount(subjectName, grade, topic){
  const sections = getChapterSections(subjectName, grade, topic);
  if(sections.length > 0){
    let minCount = Infinity;
    sections.forEach(sec => {const rec = getSectionRecord(subjectName, grade, topic, sec);const cnt = rec && rec.reviews ? rec.reviews.length : 0;if(cnt < minCount) minCount = cnt;});
    return minCount === Infinity ? 0 : minCount;
  }
  const rec = getTopicRecord(subjectName, grade, topic);
  return rec && rec.reviews ? rec.reviews.length : 0;
}
function reviewChecks(count){
  if(!count || count <= 0) return '';
  if(count === 1) return '<span class="ov-dot">✓</span>';
  if(count <= 5) return '<span class="ov-dot">' + '✓'.repeat(count) + '</span>';
  return `<span class="ov-dot">✓<sup>×${fa(count)}</sup></span>`;
}

/* ============ PROGRESS ============ */
function getEffectiveProgress(rec){
  if(!rec) return 0;
  if(rec.progress != null && !isNaN(+rec.progress)) return Math.max(0, Math.min(100, Math.round(+rec.progress/5)*5));
  return rec.studied ? 100 : 0;
}
function setChapterProgress(subject, grade, topic, progress){
  const val = Math.max(0, Math.min(100, Math.round(progress/5)*5));
  const rec = getTopicRecord(subject, grade, topic) || {studied:false, reviews:[], sections:{}};
  rec.progress = val; rec.studied = val >= 100;
  setTopicRecord(subject, grade, topic, rec);
}
function setSectionProgress(subject, grade, topic, section, progress){
  const val = Math.max(0, Math.min(100, Math.round(progress/5)*5));
  const rec = getSectionRecord(subject, grade, topic, section) || {studied:false, reviews:[]};
  rec.progress = val; rec.studied = val >= 100;
  setSectionRecord(subject, grade, topic, section, rec);
}
function setLessonProgress(subject, grade, lessonIdx, progress){
  const val = Math.max(0, Math.min(100, Math.round(progress/5)*5));
  const rec = getLessonRecord(subject, grade, lessonIdx) || {studied:false, reviews:[]};
  rec.progress = val; rec.studied = val >= 100;
  setLessonRecord(subject, grade, lessonIdx, rec);
}
function setLessonSectionProgress(subject, grade, lessonIdx, section, progress){
  const val = Math.max(0, Math.min(100, Math.round(progress/5)*5));
  const rec = getLessonSectionRecord(subject, grade, lessonIdx, section) || {studied:false, reviews:[]};
  rec.progress = val; rec.studied = val >= 100;
  setLessonSectionRecord(subject, grade, lessonIdx, section, rec);
}
function getChapterProgress(subject, grade, topic){
  const sections = getChapterSections(subject, grade, topic);
  if(sections.length > 0){let sum = 0;sections.forEach(sec => {const rec = getSectionRecord(subject, grade, topic, sec);sum += getEffectiveProgress(rec);});return Math.round(sum / sections.length);}
  const rec = getTopicRecord(subject, grade, topic);
  return getEffectiveProgress(rec);
}
function getLessonEffectiveProgress(subject, grade, lessonIdx){
  const sections = getLessonSections(subject, grade, lessonIdx);
  if(sections.length > 0){let sum = 0;sections.forEach(sec => {const rec = getLessonSectionRecord(subject, grade, lessonIdx, sec);sum += getEffectiveProgress(rec);});return Math.round(sum / sections.length);}
  const rec = getLessonRecord(subject, grade, lessonIdx);
  return getEffectiveProgress(rec);
}
/* ============ TIME (MINUTES) ============ */
let START_HOUR=6,END_HOUR=24,START_MIN=360,END_MIN=1440;
let HOURS=Array.from({length:18},(_,i)=>6+i);
let ROW_H=58,PX_PER_MIN=58/60;
const SNAP=15;
function applyTimeBlockSettings(){
  START_HOUR=0;
  END_HOUR=24;
  START_MIN=0;
  END_MIN=1440;
  HOURS=Array.from({length:24},(_,i)=>i);
}
applyTimeBlockSettings();
function computeRowHeight(){const nH=Math.max(1,HOURS.length);const vh=window.innerHeight||720;const avail=Math.max(220,vh-300);let h=Math.floor(avail/nH);h=Math.max(20,Math.min(56,h));ROW_H=h;PX_PER_MIN=h/60;}
const snapMin=(m)=>Math.round(m/SNAP)*SNAP;
function minToStr(m){const h=Math.floor(m/60),mm=m%60;return fa(h)+':'+fa(pad2(mm));}
function hmString(min){min=Math.round(min||0);if(min<=0)return'—';const h=Math.floor(min/60),m=min%60;if(h>0&&m>0)return`${fa(h)}:${fa(pad2(m))}`;if(h>0)return`${fa(h)}:۰۰`;return`${fa(m)} دقیقه`;}
const hmTotalStr=(min)=>{min=Math.round(min||0);if(min<=0)return'—';const h=Math.floor(min/60),m=min%60;return`${fa(h)}:${fa(pad2(m))}`;};

/* ============ TIME PAIR ============ */
function focusNextFieldAfter(container){
  const root=container.closest('.modal')||container.closest('.card')||container.closest('.wr-body')||document.body;
  const all=[...root.querySelectorAll('input, select, textarea')].filter(el=>{
    if(el.disabled||el.offsetParent===null)return false;
    const t=(el.type||'').toLowerCase();
    if(t==='checkbox'||t==='radio'||t==='color'||t==='file')return false;
    return true;
  });
  let found=false;
  for(const el of all){if(container.contains(el)){found=true;continue;}if(found){el.focus();if(el.select&&el.tagName!=='SELECT')el.select();return;}}
  const active=document.activeElement;if(active&&active.blur)active.blur();
}
function createTimePair(container,opts){
  opts=opts||{};
  const initial=opts.value;
  let hVal='',mVal='';
  if(initial!=null&&!isNaN(initial)){const total=+initial;hVal=Math.floor(total/60);mVal=total%60;}
  container.innerHTML=`<input dir="ltr" class="time-part time-h num-input" type="text" min="0" max="24" inputmode="numeric" placeholder="ساعت" value="${hVal!==''?hVal:''}"><span class="time-sep">:</span><input dir="ltr" class="time-part time-m num-input" type="text" min="0" max="59" inputmode="numeric" placeholder="دقیقه" value="${mVal!==''?pad2(mVal):''}">`;
  const hEl=container.querySelector('.time-h');
  const mEl=container.querySelector('.time-m');
  hEl.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();mEl.focus();if(mEl.select)mEl.select();}});
  mEl.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();focusNextFieldAfter(container);}});
  hEl.addEventListener('input',()=>{const v=hEl.value.replace(/\D/g,'');if(v!==hEl.value)hEl.value=v;if(v.length>=2&&+v<=24){mEl.focus();if(mEl.select)mEl.select();}});
  mEl.addEventListener('input',()=>{const v=mEl.value.replace(/\D/g,'');if(v!==mEl.value)mEl.value=v;if(v.length>=2&&+v<=59){focusNextFieldAfter(container);}});
  hEl.addEventListener('blur',()=>{
    const v=parseInt(hEl.value,10);
    if(isNaN(v)||v<0||v>24){if(hEl.value!=='')hEl.value='';}
    else if(v===24){hEl.value=24;mEl.value='00';}
    else hEl.value=v;
  });
  mEl.addEventListener('blur',()=>{
    const hv=parseInt(hEl.value,10);
    if(hv===24){mEl.value='00';return;}
    const v=parseInt(mEl.value,10);
    if(isNaN(v)||v<0||v>59){if(mEl.value!=='')mEl.value='';}
    else mEl.value=pad2(v);
  });
  if(opts.onChange){hEl.addEventListener('change',opts.onChange);mEl.addEventListener('change',opts.onChange);hEl.addEventListener('input',opts.onChange);mEl.addEventListener('input',opts.onChange);}
  return {
    get(){
      const hv=parseInt(hEl.value,10),mv=parseInt(mEl.value,10);
      if(isNaN(hv)&&isNaN(mv))return null;
      if(isNaN(hv)||hv<0||hv>24)return null;
      const mm=isNaN(mv)?0:mv;
      if(mm<0||mm>59)return null;
      if(hv===24&&mm!==0)return null;
      return hv*60+mm;
    },
    set(val){if(val==null){hEl.value='';mEl.value='';return;}hEl.value=Math.floor(val/60);mEl.value=pad2(val%60);},
    getHourEl(){return hEl;},getMinuteEl(){return mEl;},focus(){hEl.focus();}
  };
}
window._timePairs=new Map();
function mountTimePair(id,container,opts){const tp=createTimePair(container,opts);window._timePairs.set(id,tp);return tp;}
function getTimePair(id){return window._timePairs.get(id);}
function getTimePairValue(id){const tp=window._timePairs.get(id);return tp?tp.get():null;}
function setTimePairValue(id,val){const tp=window._timePairs.get(id);if(tp)tp.set(val);}

/* ============ AGG ============ */
function countedActivities(keys){
  const keySet=new Set(Array.isArray(keys)?keys:[keys]);
  return[...state.activities.filter(a=>keySet.has(a.date)),...state.exams.filter(e=>e.hasResults&&keySet.has(e.date)).map(e=>({id:'exam-'+e.id,date:e.date,subject:EXAM_SUBJECT,topic:e.name||state.settings.examName||'آزمون',minutes:Math.max(0,(+e.endMin||0)-(+e.startMin||0)),startMin:e.startMin,endMin:e.endMin,tests:null,isExamActivity:true}))];
}
const sumMinutes=(list)=>list.reduce((s,a)=>s+(+a.minutes||0),0);
function sumTests(list){return list.reduce((s,a)=>{if(a.tests)s+=(+a.tests.correct||0)+(+a.tests.wrong||0)+(+a.tests.blank||0);return s;},0);}
function testsBreakdown(list){let c=0,w=0,b=0;list.forEach((a)=>{if(a.tests){c+=+a.tests.correct||0;w+=+a.tests.wrong||0;b+=+a.tests.blank||0;}});return{c,w,b,t:c+w+b,pct:(c+w+b)?Math.max(0,Math.round((3*c-w)/(3*(c+w+b))*100)):0};}
function dayActs(key){return countedActivities([key]).filter((a)=>a.subject!==OTHER_SUBJECT);}
function studyIntensityLevel(minutes){
  if(minutes<60)return 0;
  if(minutes<240)return 1;
  if(minutes<420)return 2;
  if(minutes<660)return 3;
  return 4;
}
function studyIntensityLabel(level){
  return ['کمتر از ۱ ساعت','۱ تا ۴ ساعت','۴ تا ۷ ساعت','۷ تا ۱۱ ساعت','۱۱ ساعت و بیشتر'][level]||'';
}
function weekActs(jdn){const keys=weekKeysOf(jdn);return countedActivities(keys).filter((a)=>a.subject!==OTHER_SUBJECT);}
function sleepForDay(key){return state.sleeps.filter((s)=>{if(s.date===key)return true;if((s.endDate||s.date)===key&&(s.endDate||s.date)!==s.date)return true;return false;});}
function examForDay(key){return state.exams.filter((e)=>e.date===key);}
function subjectsForPie(){return[...state.subjects];}
function examPctFromCounts(c,w,b,withNegative){c=+c||0;w=+w||0;b=+b||0;const t=c+w+b;if(!t)return null;if(withNegative)return(3*c-w)/(3*t)*100;return(c/t)*100;}
function examTotals(exam){
  let c=0,w=0,b=0;
  const spec=specializedSubjectNames();
  if(exam&&exam.subjects)Object.entries(exam.subjects).forEach(([name,d])=>{if(!spec.includes(name))return;c+=+d.correct||0;w+=+d.wrong||0;b+=+d.blank||0;});
  const t=c+w+b;
  return{c,w,b,t,pctNeg:examPctFromCounts(c,w,b,true),pctRaw:examPctFromCounts(c,w,b,false)};
}
function examSubjectNames(exam){
  if(!exam)return[];
  const included=Array.isArray(exam.includedSubjects)&&exam.includedSubjects.length
    ? new Set(exam.includedSubjects)
    : new Set(exam.subjects?Object.keys(exam.subjects):[]);
  return state.subjects.filter(subject=>subject.type==='specialized'&&included.has(subject.name))
    .map(subject=>subject.name);
}
function examNeedsAttention(exam){
  if(!exam||!Array.isArray(exam.questions))return[];
  const spec=specializedSubjectNames();
  return exam.questions.filter(q=>spec.includes(q.subject)).filter(q=>{
    const st=qStatus(q);
    if(st==='correct'||st==='pending')return false;
    if(q.noteHidden)return false;
    const hasTags=['topics','errorTypes','specialTags','questionTypes'].some(key=>
      Array.isArray(q[key])&&q[key].length>0);
    return !hasTags;
  });
}
function ensureContinuousNumbering(exam){
  if(!exam||!exam.questions.length)return;
  const sorted=getSortedQuestions(exam);
  if(sorted.every((question,index)=>question.number===index+1))return;
  sorted.forEach((q,i)=>{q.number=i+1;});
  save();
}
function getSortedQuestions(exam){
  if(!exam||!Array.isArray(exam.questions))return[];
  const spec=specializedSubjectNames();
  const valid=exam.questions.filter(q=>spec.includes(q.subject));
  const subjOrder=state.subjects.map(s=>s.name);
  return[...valid].sort((a,b)=>{
    const ia=subjOrder.indexOf(a.subject),ib=subjOrder.indexOf(b.subject);
    if(ia!==ib)return(ia<0?99:ia)-(ib<0?99:ib);
    return a.number-b.number;
  });
}

/* ============ NAVIGATION ============ */
let currentExamId=null;
function applyHideClasses(){
  const navBtn = document.querySelector('.nav-btn[data-view="class"]');
  if(navBtn) navBtn.style.display = state.settings.hideClasses ? 'none' : '';
  if(state.settings.hideClasses){
    const classView = document.getElementById('view-class');
    if(classView && classView.classList.contains('active')) switchView('dashboard');
  }
}

function updateContextButton(viewName){
  const btn=document.getElementById('contextActionBtn');
  const labelEl=document.getElementById('contextActionLabel');
  if(!btn||!labelEl)return;
  const configs={
    dashboard:{icon:'📊',label:'گزارش',title:'گزارش تصویری روزانه/هفتگی',handler:()=>openReport('day')},
    plan:{icon:'🖼️',label:'برنامه هفتگی',title:'خروجی تصویری برنامه هفتگی',handler:openPlanImagePicker},
    exam:{icon:'📊',label:'مقایسه آزمون‌ها',title:'مقایسه آزمون‌های آزمایشی',handler:openExamCompare}
  };
  const cfg=configs[viewName];
  if(!cfg||viewName==='overview'||viewName==='class'||viewName==='activity'){btn.classList.add('hidden');return;}
  btn.classList.remove('hidden');
  btn.querySelector('.ctx-icon').textContent=cfg.icon;
  labelEl.textContent=cfg.label;
  btn.title=cfg.title;
  btn.onclick=cfg.handler;
}

function switchView(name){
  if(name === 'class' && state.settings.hideClasses){ toast('بخش کلاس‌ها مخفی است'); return; }
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));
  if(name==='dashboard')renderDashboard();
  if(name==='overview'&&typeof renderOverview==='function')renderOverview();
  if(name==='plan')renderPlan();
  if(name==='activity'){initActivityForm();renderActivityList();renderActivityHeader();}
  if(name==='exam')renderExamSection();
  if(name==='class')renderClass();
  updateContextButton(name);
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.nav-btn').forEach((btn)=>{btn.addEventListener('click',()=>switchView(btn.dataset.view));});

/* ============ MODAL ============ */
const modalBackdrop=document.getElementById('modalBackdrop');
const modalContent=document.getElementById('modalContent');
function openModal(html){modalContent.innerHTML=html;modalContent.classList.remove('report-modal');modalBackdrop.classList.add('show');document.body.style.overflow='hidden';modalContent.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);}
function closeModal(){modalBackdrop.classList.remove('show');modalContent.classList.remove('report-modal');if(currentExamId)document.body.style.overflow='hidden';else document.body.style.overflow='';}
modalBackdrop.addEventListener('click',(e)=>{if(e.target===modalBackdrop)closeModal();});

/* ============ DATE PICKER ============ */
function openJalaliDatePicker(opts){
  opts = opts || {};
  const title = opts.title || 'انتخاب تاریخ';
  const initialKey = opts.initialKey || TODAY_KEY;
  const onPick = opts.onPick || (()=>{});
  const j = parseKey(initialKey);
  let pickerYear = j.jy || TODAY_J.jy;
  let pickerMonth = j.jm || TODAY_J.jm;
  let selectedKey = initialKey;
  const render = () => {
    const firstJdn = j2d(pickerYear, pickerMonth, 1);
    const startCol = dowIndex(firstJdn);
    const len = jMonthLength(pickerYear, pickerMonth);
    let gridHtml = '';
    for(let i=0;i<startCol;i++) gridHtml += '<div class="date-pick-cell empty"></div>';
    for(let d=1;d<=len;d++){
      const k = keyOf(pickerYear, pickerMonth, d);
      const isToday = k===TODAY_KEY;
      const isSelected = k===selectedKey;
      gridHtml += `<div class="date-pick-cell${isToday?' today':''}${isSelected?' sel':''}" data-key="${k}">${fa(d)}</div>`;
    }
    const rem = (7 - ((startCol + len) % 7)) % 7;
    for(let i=0;i<rem;i++) gridHtml += '<div class="date-pick-cell empty"></div>';
    document.getElementById('modalContent').innerHTML = `
      <div class="modal-head"><div class="card-title">📅 ${esc(title)}</div><button class="icon-btn" data-close>✕</button></div>
      <div class="date-pick-nav"><button id="dpPrev" type="button">‹</button><div class="date-pick-title">${MONTHS[pickerMonth-1]} ${fa(pickerYear)}</div><button id="dpNext" type="button">›</button></div>
      <div class="cal-dow"><div>ش</div><div>ی</div><div>د</div><div>س</div><div>چ</div><div>پ</div><div>ج</div></div>
      <div class="cal-grid date-pick-grid">${gridHtml}</div>
      <div class="dp-selected">${keyLabel(selectedKey)}</div>
      <div class="row mt-14"><button class="btn ghost" id="dpToday" type="button">امروز</button><button class="btn primary" id="dpConfirm" type="button">تأیید</button></div>
    `;
    document.getElementById('dpPrev').onclick = () => { pickerMonth--; if(pickerMonth<1){pickerMonth=12;pickerYear--;} render(); };
    document.getElementById('dpNext').onclick = () => { pickerMonth++; if(pickerMonth>12){pickerMonth=1;pickerYear++;} render(); };
    document.getElementById('dpToday').onclick = () => { selectedKey=TODAY_KEY; pickerYear=TODAY_J.jy; pickerMonth=TODAY_J.jm; render(); };
    document.querySelectorAll('.date-pick-cell[data-key]').forEach(c=>{c.onclick = () => { selectedKey = c.dataset.key; render(); };});
    document.getElementById('dpConfirm').onclick = () => { closeModal(); onPick(selectedKey); };
    document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
  };
  openModal('');
  render();
}

/* ============ REVIEW ADDERS ============ */
function addReviewToTopic(subject, grade, topic, dateKey){
  const rec = getTopicRecord(subject, grade, topic) || {studied:false, reviews:[], sections:{}};
  if(!rec.reviews) rec.reviews = [];
  rec.reviews.push({date: dateKey, ts: Date.now()});
  rec.studied = true;
  setTopicRecord(subject, grade, topic, rec);
}
function addReviewToSection(subject, grade, topic, section, dateKey){
  const rec = getSectionRecord(subject, grade, topic, section) || {studied:false, reviews:[]};
  if(!rec.reviews) rec.reviews = [];
  rec.reviews.push({date: dateKey, ts: Date.now()});
  rec.studied = true;
  setSectionRecord(subject, grade, topic, section, rec);
}
function addReviewToLesson(subject, grade, lessonIdx, dateKey){
  const rec = getLessonRecord(subject, grade, lessonIdx) || {studied:false, reviews:[]};
  if(!rec.reviews) rec.reviews = [];
  rec.reviews.push({date: dateKey, ts: Date.now()});
  rec.studied = true;
  rec.lastReview = dateKey;
  setLessonRecord(subject, grade, lessonIdx, rec);
}
function addReviewToLessonSection(subject, grade, lessonIdx, section, dateKey){
  const rec = getLessonSectionRecord(subject, grade, lessonIdx, section) || {studied:false, reviews:[]};
  if(!rec.reviews) rec.reviews = [];
  rec.reviews.push({date: dateKey, ts: Date.now()});
  rec.studied = true;
  setLessonSectionRecord(subject, grade, lessonIdx, section, rec);
}

/* ============ EXAM HELPERS ============ */
function qHasUsefulInfo(q){
  if(!q) return false;
  if(q.starred) return true;
  if(q.questionText && q.questionText.trim()) return true;
  if(q.note && q.note.trim()) return true;
  if(q.answerText && q.answerText.trim()) return true;
  if(q.errorTypes && q.errorTypes.length > 0) return true;
  if(q.specialTags && q.specialTags.length > 0) return true;
  if(q.errorDetails && Object.keys(q.errorDetails).some(k => Array.isArray(q.errorDetails[k]) && q.errorDetails[k].length > 0)) return true;
  if(q.reviewSolvable !== null && q.reviewSolvable !== undefined) return true;
  return false;
}
function getSpecialTagsForSubject(subjectName){
  const s = state.subjects.find(x => x.name === subjectName);
  return s && Array.isArray(s.specialTags) ? s.specialTags : [];
}
function autoStarCorrectQuestion(q){
  if(!q) return false;
  if(qStatus(q) !== 'correct') return false;
  if(q.starred) return false;
  if(!qHasUsefulInfo(q)) return false;
  q.starred = true;
  return true;
}
/* اعمال تغییر رشته به دروس */
function applyFieldChange(newField, options) {
  options = options || {};
  if (!FIELDS.includes(newField)) return null;
  const grade=PROFILE_GRADES.includes(options.grade)?options.grade:(state.profile.grade||'دوازدهم');
  const newSpecials=fieldSpecializedSubjects(newField,grade);
  const currentNames = state.subjects.map(s => s.name);
  const toRemove = options.preserveExisting ? [] : state.subjects
    .filter(s => s.type === 'specialized' && !newSpecials.includes(s.name))
    .map(s => s.name);
  const toAdd = newSpecials.filter(n => !currentNames.includes(n));

  toRemove.forEach(name => {
    state.subjects = state.subjects.filter(s => s.name !== name);
    delete state.classes[name];
    state.activities = state.activities.filter(a => a.subject !== name);
    state.sessions = state.sessions.filter(s => s.subject !== name);
    state.exams.forEach(e => {
      if (e.subjects && e.subjects[name]) delete e.subjects[name];
      if (Array.isArray(e.includedSubjects)) e.includedSubjects = e.includedSubjects.filter(n => n !== name);
      if (Array.isArray(e.questions)) e.questions = e.questions.filter(q => q.subject !== name);
    });
  });

  toAdd.forEach(name => {
    const grades=fieldSubjectGrades(newField,name,grade);
    const template=(EMPTY_SPECIALIZED_TEMPLATES[newField]||[]).find(t=>t.name===name);
    const defaultSubject=DEFAULT_SUBJECTS.find(s=>s.name===name);
    const raw=template
      ? makeEmptySubjectTemplate({...template,grades})
      : defaultSubject
        ? {...JSON.parse(JSON.stringify(defaultSubject)),grades}
        : makeEmptySubjectTemplate({name,color:'#8b5cf6',defaultQ:20,sessions:15,grades});
    const subject=normalizeSubject(raw);
    state.subjects.push(subject);
    state.classes[name]={total:subject.sessions,sessions:{}};
  });

  state.subjects.forEach(subject=>{
    if(subject.type!=='specialized'||!newSpecials.includes(subject.name))return;
    subject.grades=[...new Set([
      ...(subject.grades||[]),
      ...fieldSubjectGrades(newField,subject.name,grade)
    ])].sort((a,b)=>PROFILE_GRADES.indexOf(a)-PROFILE_GRADES.indexOf(b));
  });

  restoreFieldManagedGeneralCurriculum(state.subjects,newField);
  state.subjects.forEach(subject=>{
    if(isFieldManagedGeneralSubject(subject.name,newField)&&!state.classes[subject.name]){
      state.classes[subject.name]={total:subject.sessions||0,sessions:{}};
    }
  });
  state.subjects=keepSpecializedSubjectsFirst(state.subjects);
  save();
  return { toRemove, toAdd, field: newField };
}

window.addEventListener('load', ()=>{ setTimeout(()=>{ try{applyHideClasses();}catch(e){console.warn('[core] applyHideClasses failed:', e);} }, 100); });