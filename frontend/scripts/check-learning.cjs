// Render the actual review component with synthetic data, without a browser/account.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app/homework/page.tsx'),'utf8')+'\nexport {TaskDetail as ReviewUnderTest};\n';
const component=(tag)=>({children,...props})=>React.createElement(tag,props,children);
const taskState=(task)=>task.submission?(task.submission.reviewed_at?'Tekshirildi':'Tekshiruvda'):'Topshirish kerak';
const result={exports:{}};
const mocks={
  '@/components/i18n':{useI18n:()=>({t:value=>value,locale:'uz'})},
  '@/components/auth':{useAuth:()=>({user:null,loading:false})},
  '@/components/ui/button':{Button:component('button')},
  '@/components/ui/card':{Card:component('div')},
  '@/components/common':{Notice:component('aside'),Loading:()=>null,LoginRequired:()=>null,Empty:component('section')},
  '@/lib/api':{when:value=>value,api:()=>{throw Error('Render must not make requests');},ApiError:class extends Error{}},
  '@/lib/learning':{taskState},
};
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(js,{exports:result.exports,require:name=>name.endsWith('.css')?{}:mocks[name]||require(name),Date,AbortController,setInterval,clearInterval},{filename:'homework-review-render.js'});
const Review=result.exports.ReviewUnderTest;
const task={id:7,mentor:1,student:2,mentor_name:'Mentor',student_name:'Student',title:'Algebra',instructions:'Solve the problem.',kind:'homework',deadline:'2099-01-01T00:00:00Z',questions:[],submission:{id:1,answer:'x = 4',answers:[],answer_checks:[],feedback:'Unique mentor feedback',submitted_at:'2026-10-25T12:00:00Z',reviewed_at:'2026-10-25T13:00:00Z'}};
const render=(data,teaching)=>renderToStaticMarkup(React.createElement(Review,{task:data,teaching,timezone:'Asia/Tashkent',onBack(){},onUpdate(){},onRefresh(){}}));
const reviewed=render(task,true);
assert.match(reviewed,/Izohni tahrirlash/);
assert.doesNotMatch(reviewed,/<textarea|Tekshirildi deb belgilash/);
assert.equal(reviewed.match(/Unique mentor feedback/g).length,1,'Reviewed feedback appears once');
const pending=render({...task,submission:{...task.submission,reviewed_at:null,feedback:''}},true);
assert.match(pending,/<textarea/);
assert.match(pending,/Tekshirildi deb belgilash/);
assert.doesNotMatch(pending,/Izohni tahrirlash/);
const student=render(task,false);
assert.doesNotMatch(student,/<textarea|Izohni tahrirlash|Tekshirildi deb belgilash/);
const unanswered=render({...task,submission:null},false);
assert.match(unanswered,/Javobni yuborish/);
const testResult=render({...task,kind:'test',questions:[{prompt:'2+2?',options:['3','4']},{prompt:'3+2?',options:['5','6']}],submission:{...task.submission,answer:'',answers:[1,1],answer_checks:[true,false]}},false);
assert.match(testResult,/To‘g‘ri/);assert.match(testResult,/Noto‘g‘ri/);
for(const markup of [reviewed,pending,student,unanswered,testResult])assert.doesNotMatch(markup,/max_score|name="score"|Maksimal ball|O‘rtacha natija|\d+%/);
console.log('Review UI: reviewed/pending/student states, single feedback, test correctness and no numeric scoring passed.');
