import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseSPXRows,parseDelimited,detectSPXFileKind} from '../src/spx-manifest.mjs';
const head=['AT ID','Sequence','Stop','SPX TN','Destination Address','Bairro','City','Zipcode/Postal code','Latitude','Longitude'];
const rows=[head,
 ['AT20261030EXEMPLO','-','-','BR000000000001A','Rua Exemplo, 100','Centro','Cidade X','00000-000',-15,-58],
 ['AT20261030EXEMPLO','-','-','BR000000000002B','Rua Modelo, 200','Jardim','Cidade X','00000-000',-15,-58],
 ['AT20261030EXEMPLO','-','-','BR000000000001A','Rua Exemplo, 100','Centro','Cidade X','00000-000',-15,-58]];
test('XLSX export-like SPX contains one AT and unique BR with linked addresses',()=>{
 const parsed=parseSPXRows(rows);
 assert.equal(parsed.manifests.length,1);
 const at=parsed.manifests[0];
 assert.equal(at.atId,'AT20261030EXEMPLO');
 assert.equal(at.count,2);
 assert.deepEqual(at.parcels.map(p=>p.street),['Rua Exemplo','Rua Modelo']);
 assert.equal(parsed.duplicates.length,1);
 assert.equal(at.parcels[0].address,'Rua Exemplo, 100');
});
test('multiple AT in one export are isolated; no implicit DOE classification',()=>{
 const mixed=[...rows,['AT20261030SEGUNDA','-','-','BR000000000004D','Rua Nova, 70','Centro','Cidade X','00000-000',null,null]];
 const parsed=parseSPXRows(mixed);
 assert.equal(parsed.manifests.length,2);
 assert.equal(parsed.manifests[1].count,1);
 assert.equal('route' in parsed.manifests[0].parcels[0],false);
});
test('CSV export handles quoted addresses and semicolons',()=>{
 const csv='AT ID;SPX TN;Destination Address;Bairro\nAT20261030EXEMPLO;BR000000000001A;"Rua Modelo, 32; proximo ao comercio";Centro';
 const parsed=parseSPXRows(parseDelimited(csv));
 assert.equal(parsed.manifests[0].parcels[0].address,'Rua Modelo, 32; proximo ao comercio');
});
test('fails explicitly when essential SPX columns are missing',()=>{
 assert.throws(()=>parseSPXRows([['SPX TN','Bairro'],['BR000000000001A','Centro']]),/AT ID/);
});
test('UI recognizes XLSX.XLS ZIP exports and shows BR addresses',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.includes('Planilha SPX'));
 assert.ok(html.includes('spx-manifest.js'));
 assert.ok(html.includes('file.name'));
 assert.ok(html.includes('detectSPXFileKind(file.name,file.type'));
 assert.ok(html.includes('Pacotes importados e ruas'));
 assert.ok(html.includes("routeOptions(selected?.route||'')"));
 const main=html.match(/<script type="module">([\s\S]*?)<\/script>/);
 assert.ok(main);
 assert.doesNotThrow(()=>new Function('return (async function(){'+main[1]+'})'));
});

test('Android SPX XLSX.XLS export is accepted by ZIP signature even with XLS extension',()=>{
 const zip=[0x50,0x4b,0x03,0x04,0x14,0x00,0x00,0x00];
 assert.equal(detectSPXFileKind('relatorio-SPX.xlsx.xls','application/vnd.ms-excel',zip),'xlsx');
 assert.equal(detectSPXFileKind('relatorio-SPX.xlsx','application/octet-stream',zip),'xlsx');
 assert.equal(detectSPXFileKind('arquivo-sem-extensao','',zip),'xlsx');
});
test('old binary XLS is rejected with clear message, not silently parsed as XLSX',()=>{
 assert.throws(()=>detectSPXFileKind('relatorio.xls','application/vnd.ms-excel',[208,207,17,224,161,177,26,225]),/XLS antigo/);
});
test('CSV and TXT stay supported independently of Android MIME',()=>{
 assert.equal(detectSPXFileKind('SPX.csv','application/octet-stream',[65,84,32,73,68]),'text');
 assert.equal(detectSPXFileKind('SPX.TXT','text/plain',[65,84,32,73,68]),'text');
});
test('file picker must not filter Samsung Android documents by MIME/extension',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<input id="importFile" type="file" aria-describedby="spxFileHelp">/);
 assert.doesNotMatch(html,/<input id="importFile"[^>]*\baccept=/);
 assert.ok(html.includes('detectSPXFileKind(file.name,file.type'));
});
