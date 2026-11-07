import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/drafts.js',import.meta.url),'utf8');
class Element {
  constructor(){this.textContent='';this.children=[];this.hidden=false;this.disabled=false;this.attributes={};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name),contains:name=>this.classes.has(name)};}
  append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=nodes}
  setAttribute(k,v){this.attributes[k]=String(v)}addEventListener(){}
}
function setup(){
  const elements=new Map(),pending=[];
  const ui=new Proxy({}, {get(_,key){if(!elements.has(key))elements.set(key,new Element());return elements.get(key)}});
  const context={ui,document:{createElement:()=>new Element()},activityRows:[{uid:'a',tipo:'Actividad',actividad:'Verificar solicitud'}],flowReviewVersion:1,draftEditorGeneration:1,flowReviewRequestId:0,flowReviewPending:false,lastFlowReviewPassed:false,
    confirmedSave:null,dirty:false,saveInFlight:false,currentUserRole:'elaborador',currentDraft:{status:'borrador'},
    syncSaveControls(){},setMessage(node,text){node.textContent=text},refreshProcedureProgress(){},errorText:error=>error.message,
    request(){return new Promise((resolve,reject)=>pending.push({resolve,reject}))}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function syncFlowReviewButton()'),source.indexOf('\nfunction focusFlowItem(')),context);
  context.applyDraftEditability=()=>{ui.reviewFlowButton.disabled=false;context.syncFlowReviewButton()};
  return {context,ui,pending,green:()=>ui.reviewFlowButton.classList.contains('is-reviewed')};
}

test('HTTP success alone never approves flow: blocking rules and completeness remain authoritative',async()=>{
  for(const response of [{issues:[]},{issues:[{message:'Ruta inválida'}],completenessIssues:[]},{issues:[],completenessIssues:[{message:'Falta responsable',index:0}]}]){
    const h=setup(),done=h.context.runFlowReview();assert.equal(h.green(),false);assert.equal(h.ui.reviewFlowButton.disabled,true);
    h.pending[0].resolve(response);await done;assert.equal(h.green(),false);assert.equal(h.ui.flowReviewResult.hidden,false);
  }
});
test('a passed real review turns green, preserves warnings, and a new edit invalidates it',async()=>{
  const h=setup();h.ui.processCode.disabled=true;const done=h.context.runFlowReview();
  h.pending[0].resolve({issues:[{message:'Aviso no bloqueante',severity:'warning'}],completenessIssues:[]});await done;
  assert.equal(h.green(),true);assert.equal(h.ui.reviewFlowButton.disabled,false);assert.equal(h.ui.processCode.disabled,true);
  const text=h.ui.flowReviewResult.children.flatMap(n=>[n.textContent,...n.children.map(c=>c.textContent)]).join(' ');
  assert.ok(text.includes('Aviso no bloqueante'));
  h.context.activityRows[0].actividad='Ajustar solicitud';h.context.markDirty();assert.equal(h.green(),false);
});
test('failed review never leaves a green success and retains the error result',async()=>{
  const h=setup();h.context.lastFlowReviewPassed=true;h.context.syncFlowReviewButton();const done=h.context.runFlowReview();assert.equal(h.green(),false);
  h.pending[0].reject(new Error('Sin conexión'));await done;assert.equal(h.green(),false);assert.equal(h.ui.flowReviewResult.hidden,false);
});
test('edits during pending review prevent old results from approving the changed flow',async()=>{
  const h=setup(),done=h.context.runFlowReview();h.context.activityRows[0].actividad='Otro contenido';h.context.markDirty();
  h.pending[0].resolve({issues:[],completenessIssues:[]});await done;assert.equal(h.green(),false);assert.equal(h.context.lastFlowReviewPassed,false);
});
test('late responses cannot approve another editor or override the latest review',async()=>{
  const h=setup(),old=h.context.runFlowReview();
  h.context.draftEditorGeneration++;h.context.flowReviewVersion++;
  const current=h.context.runFlowReview();h.pending[1].resolve({issues:[{message:'Falla vigente'}],completenessIssues:[]});await current;
  h.pending[0].resolve({issues:[],completenessIssues:[]});await old;assert.equal(h.green(),false);
  const other=setup(),waiting=other.context.runFlowReview();other.context.draftEditorGeneration++;
  other.pending[0].resolve({issues:[],completenessIssues:[]});await waiting;assert.equal(other.green(),false);
});
