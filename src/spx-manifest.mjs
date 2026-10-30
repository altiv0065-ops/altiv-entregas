// SPX: importacao local de manifesto exportado pelo entregador.
 // Campos pessoais nunca devem ser enviados a servidor ou para o repositorio.
const canonical=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const clean=(v,max=180)=>String(v??'').trim().slice(0,max);
function getColumn(header,aliases) {return header.findIndex(x=>aliases.includes(canonical(x)));}
function normalizeBR(value){
 const s=clean(value,40).toUpperCase().replace(/\s+/g,'');
 const m=s.match(/^BR[-_]?([A-Z0-9]{8,26})$/);
 return m?'BR'+m[1]:null;
}
export function streetFromAddress(value){
 const text=clean(value,220);
 // Nome da via antes da primeira virgula; nunca adivinhar rotas a partir do CEP.
 return clean(text.split(',')[0].replace(/\s+/g,' '),120);
}
export function parseSPXRows(rows){
 if(!Array.isArray(rows)||rows.length<2) throw Error('Planilha vazia ou sem cabecalho.');
 const header=rows[0].map(x=>String(x??''));
 const col={
  at:getColumn(header,['ATID','ATCODE']),
  br:getColumn(header,['SPXTN','BR','TRACKINGNUMBER']),
  address:getColumn(header,['DESTINATIONADDRESS','ENDERECO','ADDRESS']),
  neighborhood:getColumn(header,['BAIRRO','NEIGHBORHOOD']),
  city:getColumn(header,['CITY','CIDADE']),
  zip:getColumn(header,['ZIPCODEPOSTALCODE','ZIPCODE','CEP']),
  lat:getColumn(header,['LATITUDE','LAT']),
  lng:getColumn(header,['LONGITUDE','LON','LNG']),
 };
 for(const key of ['at','br','address','neighborhood']){
   if(col[key]<0)throw Error('Campo obrigatorio nao encontrado: '+({at:'AT ID',br:'SPX TN',address:'Destination Address',neighborhood:'Bairro'}[key]));
 }
 const groups=new Map(),duplicates=[],warnings=[];
 const coord=(n,min,max)=>{if(n===null||n===undefined||n==='')return null;const v=Number(n);return Number.isFinite(v)&&v>=min&&v<=max?v:null;};
 const atOwner=new Map();
 for(let rowIndex=1;rowIndex<rows.length;rowIndex++){
   const row=rows[rowIndex];
   if(!Array.isArray(row)||row.every(x=>x===null||x===undefined||String(x).trim()===''))continue;
   const at=clean(row[col.at],48).toUpperCase(),br=normalizeBR(row[col.br]);
   if(!/^AT[A-Z0-9]{8,42}$/.test(at)||!br){
     warnings.push('Linha '+(rowIndex+1)+' ignorada: AT ou BR invalida.');continue;
   }
   const address=clean(row[col.address],240),neighborhood=clean(row[col.neighborhood],100);
   if(!address||!neighborhood)warnings.push('Linha '+(rowIndex+1)+': endereco/bairro ausente.');
   if(!groups.has(at))groups.set(at,{atId:at,parcels:[],brs:new Set()});
   const group=groups.get(at);
   if(group.brs.has(br)){duplicates.push({atId:at,br,row:rowIndex+1});continue;}
   if(atOwner.has(br)&&atOwner.get(br)!==at)warnings.push('BR presente em mais de uma AT: verificar conflito entre listas.');
   atOwner.set(br,at);group.brs.add(br);
   group.parcels.push({
      br,address,street:streetFromAddress(address),neighborhood,
      city:col.city>=0?clean(row[col.city],100):'',
      zip:col.zip>=0?clean(row[col.zip],22):'',
      latitude:col.lat>=0?coord(row[col.lat],-90,90):null,
      longitude:col.lng>=0?coord(row[col.lng],-180,180):null
   });
 }
 const manifests=[...groups.values()].map(g=>({atId:g.atId,parcels:g.parcels,count:g.parcels.length}));
 if(!manifests.length)throw Error('Nenhuma AT com BR valida no arquivo.');
 return {manifests,duplicates,warnings};
}
// CSV exportado como texto delimitado por virgula ou ponto e virgula; respeita aspas.
export function parseDelimited(text){
 const src=String(text||'').replace(/^\uFEFF/,'');
 const first=src.split(/\r?\n/)[0]||'';
 const delim=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
 let field='',row=[],rows=[],quoted=false;
 for(let i=0;i<src.length;i++){
   const ch=src[i];
   if(ch==='"'){
     if(quoted&&src[i+1]==='"'){field+='"';i++}else quoted=!quoted;
   }else if(ch===delim&&!quoted){row.push(field);field='';}
   else if((ch==='\n'||ch==='\r')&&!quoted){
      row.push(field);field='';if(row.some(x=>x.trim()))rows.push(row);row=[];
      if(ch==='\r'&&src[i+1]==='\n')i++;
   }else field+=ch;
 }
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}

// O seletor de arquivos do Android pode rotular um ZIP XLSX valido como "XLS".
// A extensao e o MIME type nao sao confiaveis no Android SAF: usar assinatura real.
export function detectSPXFileKind(filename='',mime='',signature=[]) {
 const bytes=Array.from(signature||[]);
 const zip=bytes[0]===0x50&&bytes[1]===0x4b&&
   ((bytes[2]===0x03&&bytes[3]===0x04)||
    (bytes[2]===0x05&&bytes[3]===0x06)||
    (bytes[2]===0x07&&bytes[3]===0x08));
 if(zip)return 'xlsx';
 const legacyExcel=[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]
   .every((n,i)=>bytes[i]===n);
 if(legacyExcel)throw Error('Excel XLS antigo detectado. Exporte como XLSX na SPX; XLSX.XLS funciona sem renomear.');
 const name=String(filename||'').trim();
 const media=String(mime||'').toLowerCase();
 if(/\.(?:xlsx|xls)(?:\.xls)?$/i.test(name)||
    /spreadsheetml|ms-excel|excel/.test(media)) {
   throw Error('Este arquivo tem nome Excel, mas nao contem uma planilha XLSX valida. Baixe novamente a exportacao da SPX.');
 }
 if(/\.(?:csv|txt)$/i.test(name)||/^text\//.test(media)||media.includes('csv'))return 'text';
 // Alguns provedores Android nao fornecem nem extensao nem MIME.
 // Aceitar arquivo texto somente se a assinatura for textual legivel.
 if(bytes.length>0&&bytes.every(n=>n===9||n===10||n===13||(n>=32&&n<127)))return 'text';
 throw Error('Arquivo nao reconhecido. Selecione o relatorio SPX XLSX.XLS, XLSX, CSV ou TXT.');
}
