import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('const STORE_VERSION = 1;');
const end=html.indexOf('/* PDF A4 minimalista', start);
assert.ok(start>0&&end>start,'Motor de conferência embutido na página');
const source=html.slice(start,end);
const api=vm.runInNewContext('(function(){'+source+'; return {normBR,findBR,extractBRs,normRoute,emptyState,importAT,registerBR,upsertCorrection,summarize,matchAddressRule,exportCSV,addressRows,upsertAssignmentRequest};})()', {});
const A='BR2689439187386',B='BR2657125532019',C='BR1234567890001',X='BR1234567890002';
test('AT importa BRs sem contagem duplicada',()=>{
 const imported=api.extractBRs(A+'\n'+A+'\n'+B);
 assert.equal(imported.brs.length,2);
 assert.equal(imported.duplicates.length,1);
});
test('QR com BR e barras têm identidade única',()=>{
 assert.equal(api.findBR('https://example.test/?br='+A),A);
 assert.equal(api.findBR(A),A);
 assert.equal(api.findBR('QR-NAO-VINCULADO'),null);
});
test('rotas DOE / DOI / 2-4 padronizadas',()=>{
 assert.equal(api.normRoute('2-4'),'DOE-04');
 assert.equal(api.normRoute('doi-3'),'DOE-03');
});
test('AT faltante, extra e pacote da rua errada',()=>{
 const s=api.emptyState();const at=api.importAT(s,{name:'DOE-04 dia',route:'DOE-04',content:A+'\n'+B+'\n'+C}).at;
 api.registerBR(s,at.id,A);api.registerBR(s,at.id,B);api.registerBR(s,at.id,B);
 api.registerBR(s,at.id,X);
 api.upsertCorrection(s,{atId:at.id,br:A,destRoute:'DOE-03',street:'Rua das Flores',neighborhood:'Centro'});
 const report=api.summarize(at,s.scans,s.corrections);
 assert.equal(report.scanned,3);assert.equal(report.valid,1);
 assert.equal(report.missing[0],C);assert.equal(report.extras[0],X);
 assert.equal(report.divergences[0],A);assert.equal(report.duplicateAttempts,1);
 assert.equal(api.addressRows(s.corrections).length,1);
});
test('a mesma BR não é contada em duas ATs',()=>{
 const s=api.emptyState();const at4=api.importAT(s,{name:'AT4',route:'DOE-04',content:A}).at;
 const at3=api.importAT(s,{name:'AT3',route:'DOE-03',content:A}).at;
 api.registerBR(s,at4.id,A);
 const duplicate=api.registerBR(s,at3.id,A);
 assert.equal(duplicate.duplicate,true);assert.equal(duplicate.crossAT,true);assert.equal(s.scans.length,1);
});
test('confirmação por bairro evita rua homônima',()=>{
 const rules=[{street:'Rua São José',neighborhood:'Centro',originRoute:'DOE-04',destRoute:'DOE-03'}];
 assert.equal(api.matchAddressRule(rules,'R Sao Jose','Centro','DOE-04').destRoute,'DOE-03');
 assert.equal(api.matchAddressRule(rules,'R Sao Jose','Outro bairro','DOE-04'),null);
});
test('CSV impede fórmula executável',()=>{
 const csv=api.exportCSV(['BR','Rua'],[[A,'=1+1']]);
 assert.ok(csv.includes('"\'=1+1"'));
});
test('página contém a interface e os campos operacionais',()=>{
 for(const x of ['Bipar pacotes','Correções','Regras de ruas','Relatórios','./manifest.webmanifest'])assert.ok(html.includes(x));
});

test('pacote extra precisa ser bipado antes de solicitar inclusão em AT',()=>{
 const s=api.emptyState(),at=api.importAT(s,{name:'AT04',route:'DOE-04',content:A}).at;
 assert.throws(()=>api.upsertAssignmentRequest(s,{atId:at.id,br:X,destRoute:'DOE-04'}),/Bipe/);
 api.registerBR(s,at.id,X);
 const r=api.upsertAssignmentRequest(s,{atId:at.id,br:X,destRoute:'DOE-04',street:'Rua X',neighborhood:'Centro'});
 assert.equal(r.destRoute,'DOE-04');
 assert.equal(s.ats[0].brs.length,1);
 assert.equal(s.assignmentRequests.length,1);
 api.upsertAssignmentRequest(s,{atId:at.id,br:X,destRoute:'DOE-13'});
 assert.equal(s.assignmentRequests.length,1);
 assert.equal(s.assignmentRequests[0].destRoute,'DOE-13');
 assert.throws(()=>api.upsertAssignmentRequest(s,{atId:at.id,br:A,destRoute:'DOE-03'}),/consta na AT/);
});
test('DOE-13 é rota válida sem limitar o cadastro às 12 primeiras rotas',()=>{
 assert.equal(api.normRoute('2-13'),'DOE-13');
 assert.ok(html.includes('length:99'));
});
test('navegação enxuta e scanner nativo fazem parte da versão 2',()=>{
 for(const label of ['Comece pela sua AT','Pacotes fora da AT','Solicitar inclusão em AT','window.ALTIVNativeScanner.start','altiv-solicitar-atribuicao.csv']){
   assert.ok(html.includes(label),'faltando: '+label);
 }
});
