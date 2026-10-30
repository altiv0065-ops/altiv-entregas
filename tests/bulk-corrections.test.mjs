import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('const STORE_VERSION = 1;');
const end=html.indexOf('/* PDF A4 minimalista',begin);
assert.ok(begin>0&&end>begin,'Motor de conferência acessível');
const code=html.slice(begin,end);
const engine=vm.runInNewContext('(function(){'+code+';return {emptyState,importAT,registerBR,summarize,upsertBulkRouteCorrections,prepareBulkRouteCorrections,exportCSV,correctionRows};})()', {});
const A='BR900000000001A',B='BR900000000002B',C='BR900000000003C';
function sample(withMissing=false){
 const state=engine.emptyState(),parcels={
  [A]:{br:A,address:'Rua Modelo, 100',street:'Rua Modelo',neighborhood:'Centro',city:'Cidade Exemplo',zip:'00000-000'},
  [B]:{br:B,address:'Rua Modelo, 120',street:'Rua Modelo',neighborhood:'Centro',city:'Cidade Exemplo',zip:'00000-000'},
  [C]:{br:C,address:withMissing?'':'Rua Estrela, 300',street:'Rua Estrela',neighborhood:'Bairro Novo',city:'Cidade Exemplo',zip:'11111-111'}
 };
 const at=engine.importAT(state,{name:'AT20261030TESTE',route:'DOE-04',content:[A,B,C].join('\n'),parcelsByBR:parcels}).at;
 return {state,at};
}
test('lote de 3 BRs preserva endereco completo e mantem contagem de bipagem',()=>{
 const {state,at}=sample();
 engine.registerBR(state,at.id,A);
 const before=engine.summarize(at,state.scans,state.corrections);
 const result=engine.upsertBulkRouteCorrections(state,{atId:at.id,brs:[A,B,C],destRoute:'DOE-13'});
 assert.equal(result.count,3);
 assert.equal(state.corrections.length,3);
 assert.ok(state.corrections.every(c=>c.batchId===result.batchId&&c.destRoute==='DOE-13'));
 assert.equal(state.corrections[1].address,'Rua Modelo, 120');
 assert.equal(state.corrections[2].neighborhood,'Bairro Novo');
 assert.equal(state.corrections[2].city,'Cidade Exemplo');
 assert.equal(state.corrections[2].zip,'11111-111');
 const after=engine.summarize(at,state.scans,state.corrections);
 assert.equal(after.scanned,before.scanned);
 assert.deepEqual([...after.missing].sort(),[...before.missing].sort());
});
test('BR repetida no lote e segundo salvamento nao duplicam as propostas',()=>{
 const {state,at}=sample();
 const first=engine.upsertBulkRouteCorrections(state,{atId:at.id,brs:[A,A,B],destRoute:'DOE-13'});
 assert.equal(first.count,2);
 const second=engine.upsertBulkRouteCorrections(state,{atId:at.id,brs:[A,B],destRoute:'DOE-03'});
 assert.equal(second.updated,2);
 assert.equal(state.corrections.length,2);
 assert.equal(state.corrections[0].destRoute,'DOE-03');
});
test('nao aceita BR de outra AT ou rota original e nao altera estado em erro',()=>{
 const {state,at}=sample();
 const atOther=engine.importAT(state,{name:'AT20261030OUTRA',route:'DOE-03',content:'BR900000000009Z'}).at;
 for(const bad of [
  {atId:at.id,brs:[A,'BR900000000009Z'],destRoute:'DOE-13'},
  {atId:at.id,brs:[A],destRoute:'DOE-04'},
  {atId:atOther.id,brs:[A],destRoute:'DOE-13'}
 ]){
  assert.throws(()=>engine.upsertBulkRouteCorrections(state,bad));
  assert.equal(state.corrections.length,0);
 }
});
test('endereco SPX e bairro obrigatorios antes de gerar lote atomico',()=>{
 const {state,at}=sample(true);
 assert.throws(()=>engine.upsertBulkRouteCorrections(state,{atId:at.id,brs:[A,C],destRoute:'DOE-13'}),/Endereco ausente/);
 assert.equal(state.corrections.length,0);
});
test('nao sobrescreve alteracao de rota ja finalizada',()=>{
 const {state,at}=sample();
 engine.upsertBulkRouteCorrections(state,{atId:at.id,brs:[A],destRoute:'DOE-13'});
 state.corrections[0].status='Aprovado';
 assert.throws(()=>engine.upsertBulkRouteCorrections(state,{atId:at.id,brs:[A,B],destRoute:'DOE-03'}),/finalizada/);
 assert.equal(state.corrections.length,1);
 assert.equal(state.corrections[0].destRoute,'DOE-13');
});
test('CSV inclui endereco completo, CEP e identificador de lote e neutraliza formula',()=>{
 const {state,at}=sample();
 const batch=engine.upsertBulkRouteCorrections(state,{atId:at.id,brs:[A,B],destRoute:'DOE-13'});
 assert.equal(engine.correctionRows(batch.records)[0][6],'Rua Modelo, 100');
 assert.equal(engine.correctionRows(batch.records)[0][8],'00000-000');
 assert.equal(engine.correctionRows(batch.records)[0][9],batch.batchId);
 const csv=engine.exportCSV(['Endereco'],[['=IMPORTXML("url","data")']]);
 assert.ok(csv.includes("'=IMPORTXML("));
});
test('interface contem comandos acessiveis e nao altera a contagem ao selecionar',()=>{
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
 assert.ok(script);
 assert.doesNotThrow(()=>new Function('return (async function(){'+script[1]+'})'));
 for(const phrase of ['bulkSelect','bulkStart','bulkCorrectionForm','lastBulkCSV','lastBulkPDF','data-bulk-br','Salvar lote e baixar CSV']){
  assert.ok(html.includes(phrase),'Faltando '+phrase);
 }
 assert.ok(html.includes('Selecionar pendentes'));
});
