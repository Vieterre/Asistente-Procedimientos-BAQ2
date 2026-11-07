import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { listAdminConsultation, getAdminConsultation } from '../src/domain/admin-consultation.js';
import { canPerform, ACTIONS } from '../src/domain/permissions.js';
import { PROCEDURE_STATUS } from '../src/domain/workflow.js';
import { createAppServer } from '../src/server.js';

const id = '33333333-3333-4333-8333-333333333333';
const admin = { id: '11111111-1111-4111-8111-111111111111', role: 'administrador', active: true, mustChangePassword: false };
const payload = {
  fields: { objetivo: 'Objetivo guardado', alcance: 'Alcance guardado', definiciones: 'Término: definición', condiciones: 'Condiciones guardadas', elaboro: 'Profesional', elaboroNombre: 'Autora', reviso: 'Asesor', aprobo: 'Director' },
  norms: [{ tipo: 'Interna', norma: 'Manual guardado', anio: '2020', descripcion: 'Norma completa', articulo: '1', entidad: 'Entidad' }],
  activities: [{uid:'s',tipo:'Inicio',actividad:'Recibir'}, {uid:'a',tipo:'Actividad',actividad:'Verificar solicitud',descripcion:'Descripción guardada',responsable:'Profesional',evidencia:'Registro guardado',sistema:'Sistema guardado',tieneControl:true,controlAccion:'Verifica',controlEjecucion:'Ejecución guardada'}, {uid:'d',tipo:'Decisión',descripcion:'¿Cumple?',responsable:'Asesor',decisionSi:'f',decisionNo:'a'}, {uid:'f',tipo:'Fin',actividad:'Terminar'}],
  annexes: [{documento:'Anexo guardado',tipo:'Formato',codigo:'F-001',observacion:'Observación guardada'}],
  changes: [{version:'1.0',fecha:'2015-01-01',razon:'Creación histórica'}], settings:{annexesNotApplicable:false}
};
const row = { id, code:'DE-P-001', name:'Procedimiento histórico', process_code:'DE',process_name:'Dirección Estratégica',status:'borrador',version:'1.0',revision:7,updated_at:'2020-01-02T12:00:00Z',author_name:'Autora',evaluator_name:null,current_payload:payload };

function readPool(rows = [row]) {
  const calls=[];
  return { calls, async query(sql, params=[]) {
    calls.push({sql,params});
    assert.match(sql.trim(), /^SELECT\b/, 'consultation domain must issue SELECT only');
    if (sql.includes('FROM processes ORDER')) return {rows:[{code:'DE',name:'Dirección Estratégica'}]};
    if (sql.includes('WHERE p.id = $1')) return {rows:rows.filter(r=>r.id===params[0])};
    return {rows:rows.filter(r=>(!params[0]||r.process_code===params[0])&&(!params[1]||r.status===params[1]))};
  }};
}

test('only active administrators can list or inspect the consultation', async () => {
  for (const user of [{...admin,role:'elaborador'},{...admin,role:'evaluador'},{...admin,active:false},{...admin,mustChangePassword:true},null]) {
    const pool=readPool();
    await assert.rejects(listAdminConsultation(pool,user),{code:'forbidden',status:403});
    await assert.rejects(getAdminConsultation(pool,user,id),{code:'forbidden',status:403});
    assert.equal(pool.calls.length,0);
  }
  assert.equal(canPerform(admin,ACTIONS.GENERATE_BRANDED_PDF,{procedure:{status:'borrador'}}),false);
});

test('consultation covers all workflow stages and historic records, with independent filters', async () => {
  const rows=Object.values(PROCEDURE_STATUS).map((status,i)=>({...row,id:String(i),status,process_code:i%2?'DE':'GDI'}));
  const pool=readPool(rows);
  const result=await listAdminConsultation(pool,admin);
  assert.equal(result.procedures.length,Object.keys(PROCEDURE_STATUS).length);
  assert.ok(result.procedures.every(r=>r.updatedAt===row.updated_at));
  assert.ok(result.procedures.every(r=>!('payload' in r)));
  const filtered=await listAdminConsultation(pool,admin,{processCode:'DE',status:'enviado_a_evaluacion'});
  assert.equal(filtered.procedures.length,1);
  assert.deepEqual(pool.calls.at(-2).params,['DE','enviado_a_evaluacion']);
  await assert.rejects(listAdminConsultation(pool,admin,{status:'invalid'}),{status:400});
  await assert.rejects(listAdminConsultation(pool,admin,{processCode:'DE\' OR 1=1'}),{status:400});
});

test('detail returns the saved payload without changing revision, state or content', async () => {
  const before=JSON.stringify(row); const pool=readPool();
  const result=await getAdminConsultation(pool,admin,id);
  assert.deepEqual(result.payload,payload); assert.equal(result.revision,7); assert.equal(result.status,'borrador');
  assert.equal(result.evaluatorName,null); assert.equal(result.authorName,'Autora');
  assert.equal(JSON.stringify(row),before);
  await assert.rejects(getAdminConsultation(pool,admin,'missing'),{code:'draft_not_found',status:404});
});

test('HTTP consultation is GET-only, administrator-only and does not start evaluations', async () => {
  let role='administrador', authenticated=true; const calls=[];
  const pool={async query(sql,params=[]) {
    calls.push(sql);
    if(sql.includes('FROM app_sessions s')) return {rows:authenticated?[{...admin,role,session_id:'session',display_name:'Administrador',must_change_password:false}]:[]};
    if(sql.startsWith('UPDATE app_sessions SET last_seen_at')) return {rows:[]};
    assert.match(sql.trim(),/^SELECT\b/,'no procedure or evaluation writes');
    if(sql.includes('FROM processes ORDER')) return {rows:[]};
    return {rows:sql.includes('WHERE p.id = $1')&&params[0]!==id?[]:[row]};
  },async end(){}};
  const server=createAppServer({poolFactory:()=>pool});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api/admin/consultation/procedures`;
  const headers={cookie:'__Host-asistente_session=isolated-test-token'};
  try {
    assert.equal((await fetch(base,{headers})).status,200);
    const detail=await fetch(base+'/'+id,{headers}); assert.equal(detail.status,200); assert.deepEqual((await detail.json()).procedure.payload,payload);
    for(const deniedRole of ['elaborador','evaluador']) {role=deniedRole;assert.equal((await fetch(base,{headers})).status,403);assert.equal((await fetch(base+'/'+id,{headers})).status,403);}
    role='administrador';
    assert.equal((await fetch(base+'/99999999-9999-4999-8999-999999999999',{headers})).status,404);
    assert.equal((await fetch(base,{method:'POST',headers})).status,404);
    authenticated=false;assert.equal((await fetch(base,{headers})).status,401);
    assert.ok(!calls.some(sql=>/\b(?:INSERT INTO|UPDATE) (?:procedures|evaluations)\b/.test(sql)));
  }finally{await new Promise(resolve=>server.close(resolve));}
});

class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.style={};this.dataset={};this.attributes={};this.textContent='';this.classList={toggle(){}};}
  append(...nodes){this.children.push(...nodes)} replaceChildren(...nodes){this.children=nodes}
  setAttribute(k,v){this.attributes[k]=String(v)}
}
function collect(node){return [node,...node.children.flatMap(collect)]}
test('read-only viewer preserves all saved sections and draws without changing editor state',()=>{
  const source=readFileSync(new URL('../public/drafts.js',import.meta.url),'utf8');
  const content=new Element(); const editRows=[{uid:'local',actividad:'Edición local pendiente'}];
  const context={document:{createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)},ui:{consultationContent:content},activityRows:editRows,flowIntrinsicWidth:1234,flowIntrinsicHeight:5678,flowZoom:77,dirty:true,statusLabel:value=>value};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function svgNode('),source.indexOf('\nfunction errorText(')),context);
  vm.runInContext(source.slice(source.indexOf('function reportTable('),source.indexOf('\nfunction dateOnly(')),context);
  vm.runInContext(source.slice(source.indexOf('function consultationDate('),source.indexOf('\nfunction renderConsultationList(')),context);
  vm.runInContext(source.slice(source.indexOf('function renderConsultationProcedure('),source.indexOf('\nasync function openConsultationProcedure(')),context);
  const procedure={id,name:row.name,code:row.code,processCode:row.process_code,processName:row.process_name,status:row.status,revision:7,version:'1.0',authorName:'Autora',payload};
  const before=JSON.stringify(procedure);context.renderConsultationProcedure(procedure);
  const nodes=collect(content),text=nodes.map(n=>n.textContent).join(' ');
  for(const expected of ['Objetivo guardado','Alcance guardado','Término: definición','Condiciones guardadas','Manual guardado','Descripción guardada','Sistema guardado','Registro guardado','Ejecución guardada','Anexo guardado','2015-01-01','Creación histórica'])assert.ok(text.includes(expected),expected);
  assert.ok(nodes.some(n=>n.tagName==='svg'&&n.attributes.role==='img'));
  assert.ok(nodes.some(n=>n.tagName==='marker'&&n.attributes.id==='consultationFlowArrow'));
  assert.ok(!nodes.some(n=>['button','input','select','textarea','form'].includes(n.tagName)));
  assert.equal(context.activityRows,editRows);assert.equal(context.flowIntrinsicWidth,1234);assert.equal(context.flowZoom,77);assert.equal(context.dirty,true);assert.equal(JSON.stringify(procedure),before);
});
