import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseLabelText} from '../src/ocr-parser.mjs';
const page = readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('OCR identifica rua e bairro sem armazenar destinatario ou numero',()=>{
 const result=parseLabelText('Destinatario: Fulano Silva\\nRua Joao Paulo Segundo, 950\\nBairro: Jardim Sao Paulo\\nDOE-02\\nDOE-13');
 assert.equal(result.street,'Rua Joao Paulo Segundo');
 assert.equal(result.neighborhood,'Jardim Sao Paulo');
 assert.deepEqual(result.routes,['DOE-02','DOE-13']);
 assert.ok(!JSON.stringify(result).includes('Fulano'));
 assert.ok(!JSON.stringify(result).includes('950'));
});
test('OCR nao inventa bairro nem rota quando ausentes',()=>{
 const result=parseLabelText('Rua das Flores, 22\\nDestinatario: Cliente');
 assert.equal(result.street,'Rua das Flores');
 assert.equal(result.neighborhood,'');
 assert.deepEqual(result.routes,[]);
});
test('JavaScript principal e sintaticamente valido e Scanner tem fluxo continuo',()=>{
 const m=page.match(/<script type="module">([\\s\\S]*?)<\\/script>/);
 assert.ok(m,'Script de interface encontrado');
 assert.doesNotThrow(()=>new Function('return (async function(){'+m[1]+'})'));
 for(const phrase of ['window.ALTIVNativeScanner.start','async function readLabel','window.ExcelJS','altiv-resumo-conferencia.csv','function exportAssignmentCSV']){
   assert.ok(page.includes(phrase),'Nao encontrado '+phrase);
 }
});
test('scanner nativo possui mecanismo de sessao e controles de camera',()=>{
 const scanner=readFileSync(new URL('../src/native-scanner.js',import.meta.url),'utf8');
 assert.ok(scanner.includes('BarcodeScanner.startScan'));
 assert.ok(scanner.includes('BarcodeScanner.stopScan'));
 assert.ok(scanner.includes('onCode(raw)'));
 assert.ok(scanner.includes('Torch.enable'));
 assert.ok(scanner.includes('TextRecognition.processImage'));
});
test('relatorios mantem restricao de dados pessoais e destino manual',()=>{
 assert.ok(page.includes('Solicitação de inclusão'));
 assert.ok(page.includes('Rota correta'));
 assert.ok(page.includes('Nao altera'));
});
