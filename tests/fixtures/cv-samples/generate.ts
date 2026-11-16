/** Synthetic benchmark only; run from repository root. No external downloads. */
import { readFile, writeFile } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

const dir = 'tests/fixtures/cv-samples/';
const onlyLegacy = process.argv.includes('--legacy-only');
const fontPath = 'lib/server/fonts/FiraGO-Regular-subset.ttf';
type Truth = { name: string; email: string; phone: string; city: string; roles: { label: string; start: string; end: string }[]; years: number; education: string[]; educationLevel: string; skills: string[]; languages: {name: string; level: string}[]; certifications: string[] };
const expected: Record<string, Truth> = {};
const common = (name: string, n: number): Truth => ({name, email:`synthetic${n}@example.com`,phone:`+995 555 00 00 ${String(n).padStart(2,'0')}`,city:'თბილისი', roles:[],years:0,education:[],educationLevel:'bachelor',skills:[],languages:[],certifications:[]});
const us: Truth = {...common('Mira Example',4),city:'Boston',roles:[{label:'Senior Analyst — Fictional Labs',start:'2020-01',end:'2023-12'},{label:'Analyst — Example Works',start:'2018-03',end:'2021-06'}],years:5,education:['Bachelor of Science — Fictional University'],skills:['SQL','Python','Tableau'],languages:[{name:'ინგლისური',level:'native'},{name:'გერმანული',level:'b2'}],certifications:['AWS Certified Cloud Practitioner']};
const usLines = [us.name,us.email,us.phone,us.city,'PROFESSIONAL SUMMARY','Analyst focused on reliable reporting.','EXPERIENCE','Senior Analyst — Fictional Labs','Jan 2020 – Dec 2023','Analyst — Example Works','Mar 2018 – Jun 2021','EDUCATION',...us.education,'SKILLS','SQL, Python, Tableau','LANGUAGES','English native; German B2','CERTIFICATIONS',...us.certifications];
async function pdf(name: string, columns: {x:number; width:number; lines:string[]}[], truth:Truth) {
 if (onlyLegacy) return;
 const doc=await PDFDocument.create(); doc.registerFontkit(fontkit);
 const font=await doc.embedFont(await readFile(fontPath),{subset:true}); const page=doc.addPage([600,800]);
 for(const col of columns) { let y=755; for(const rawLine of col.lines) { const line=rawLine.normalize('NFC'); const size=10; if(font.widthOfTextAtSize(line,size)>col.width) throw Error(`${name}: line exceeds column: ${line}`); page.drawText(line,{x:col.x,y,font,size,color:rgb(.12,.16,.22)}); y-=23; }}
 await writeFile(dir+name,await doc.save()); expected[name]=truth;
}
// Synthetic encoding/name-detection test, NOT a real AcadNusx font. Only original
// Georgian runs use the renamed font; email and Latin skills retain normal FiraGO.
async function legacyPdf(lines: string[]) {
 const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
 const bytes = await readFile(fontPath);
 const normal = await doc.embedFont(bytes, {subset:true});
 const legacyFont = await doc.embedFont(bytes, {subset:true, customName:'AcadNusx-Synthetic-FiraGO'});
 const page = doc.addPage([600,800]);
 const letters = 'აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ';
 const latin = 'abgdevzTiklmnopJrstufqRySCcZwWxjh';
 for (const [index,line] of lines.entries()) {
   let x = 35;
   for (const run of line.match(/[ა-ჰ]+|[^ა-ჰ]+/gu) ?? []) {
     const tagged = /^[ა-ჰ]/u.test(run);
     const text = tagged ? [...run].map(c => latin[letters.indexOf(c)]).join('') : run;
     const font = tagged ? legacyFont : normal;
     page.drawText(text, {x,y:755-index*23,font,size:10,color:rgb(.12,.16,.22)});
     x += font.widthOfTextAtSize(text,10);
   }
 }
 await writeFile(dir+'georgian-acadnusx.pdf', await doc.save());
}
// Reuses the existing test's deflate + central-directory approach, generalized to valid packages.
function zip(entries: Record<string,string>) {
 const bodies:Buffer[]=[]; const headers:Buffer[]=[]; let offset=0;
 for(const [path,xml] of Object.entries(entries)) {const name=Buffer.from(path), raw=Buffer.from(xml), method=path==='mimetype'?0:8, data=method===0?raw:deflateRawSync(raw);let crc=0xffffffff;for(const b of raw){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^(crc&1?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(method,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(method,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(raw.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);const body=Buffer.concat([local,name,data]);bodies.push(body);headers.push(Buffer.concat([central,name]));offset+=body.length;}
 const central=Buffer.concat(headers), end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(headers.length,8);end.writeUInt16LE(headers.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...bodies,central,end]);
}
const xmlEscape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
async function main(){
 const ep:Truth={...common('Alex Sample',1),roles:[{label:'Data Analyst — Example Europe',start:'2022-07',end:'current'},{label:'Junior Analyst — Sample Europe',start:'2019-03',end:'2022-06'}],years:7,education:['Bachelor of Science — Example University'],skills:['Excel','SQL','Data visualization'],languages:[{name:'ქართული',level:'native'},{name:'ინგლისური',level:'b2'}],certifications:['Google Data Analytics Certificate']};
 await pdf('europass-en.pdf',[{x:35,width:530,lines:[ep.name,ep.email,ep.phone,'Tbilisi','WORK EXPERIENCE',ep.roles[0].label,'01/07/2022 – Current',ep.roles[1].label,'01/03/2019 – 30/06/2022','EDUCATION AND TRAINING',...ep.education,'LANGUAGE SKILLS','Mother tongue(s): Georgian','English: Listening B2 Reading B2 Spoken interaction B2','Spoken production B2 Writing B2','DIGITAL SKILLS','Excel, SQL, Data visualization','CERTIFICATIONS',...ep.certifications]}],ep);
 const li:Truth={...common('Robin Demo',2),roles:[{label:'Product Analyst — Fictional Network',start:'2020-01',end:'current'}],years:6,education:['Master of Science — Sample Institute'],educationLevel:'master',skills:['SQL','Tableau','Stakeholder management'],languages:[{name:'ინგლისური',level:'full professional'}],certifications:['Professional Scrum Master I']};
 await pdf('linkedin-export.pdf',[{x:25,width:160,lines:['Contact',li.email,li.phone,'Tbilisi','Top Skills','SQL','Tableau','Stakeholder management','Languages','English (Full Professional)','Certifications',...li.certifications]},{x:205,width:370,lines:[li.name,'Summary','Product analytics and reporting.','Experience',li.roles[0].label,'January 2020 - Present (5 years 11 months)','Education',...li.education]}],li);
 const can:Truth={...common('Dara Fiction',3),city:'ბათუმი',roles:[{label:'Designer — Imaginary Studio',start:'2019',end:'2022'}],years:4,education:['Bachelor of Arts — Fictional Academy'],skills:['Figma','Photoshop','Typography'],languages:[{name:'ინგლისური',level:'c1'}],certifications:['Design Foundations Certificate']};
 await pdf('two-column-canva.pdf',[{x:30,width:330,lines:[can.name,'E X P E R I E N C E',can.roles[0].label,'2019 — 2022','E D U C A T I O N',...can.education,'C E R T I F I C A T I O N S',...can.certifications]},{x:400,width:175,lines:['+ Contact',can.email,can.phone,'Batumi','S K I L L S','Figma','Photoshop','Typography','L A N G U A G E S','English C1']}],can);
 await pdf('us-resume.pdf',[{x:35,width:530,lines:usLines}],us);
 const ru:Truth={...common('Алина Примерова',5),city:'ქუთაისი',roles:[{label:'Бухгалтер — Пример Компания',start:'2020-06',end:'current'}],years:6,education:['Магистр экономики — Учебный институт'],educationLevel:'master',skills:['1C','Excel','CRM'],languages:[{name:'რუსული',level:'native'},{name:'ინგლისური',level:'b2'}],certifications:['Сертификат 1С Профессионал']};
 await pdf('hh-ru.pdf',[{x:35,width:530,lines:[ru.name,ru.email,ru.phone,'Кутаиси','Опыт работы — 6 лет 3 месяца',ru.roles[0].label,'Июнь 2020 — настоящее время','Образование',...ru.education,'Ключевые навыки','1С, Excel, CRM','Знание языков: Русский — Родной, Английский — B2','Сертификаты',...ru.certifications]}],ru);
 const ge:Truth={...common('ნინა მაგალითაძე',6),roles:[{label:'ბუღალტერი — სადემო კომპანია',start:'2021-03',end:'current'}],years:5,education:['ბაკალავრი — სადემო უნივერსიტეტი'],skills:['Excel','1C','ბუღალტერია'],languages:[{name:'ქართული',level:'native'},{name:'ინგლისური',level:'b2'}],certifications:['ბუღალტერიის სერტიფიკატი']};
 const geLines=[ge.name,ge.email,ge.phone,'თბილისი','სამუშაო გამოცდილება',ge.roles[0].label,'2021 წლის მარტი – დღემდე','განათლება',...ge.education,'უნარები','Excel, 1C, ბუღალტერია','ენები','ქართული მშობლიური','ინგლისური B2','სერტიფიკატები',...ge.certifications];
 await pdf('georgian.pdf',[{x:35,width:530,lines:geLines}],ge);
 const letters='აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ';const latin='abgdevzTiklmnopJrstufqRySCcZwWxjh';const legacy=geLines.map(l=>[...l].map(c=>letters.includes(c)?latin[letters.indexOf(c)]:c).join(''));
 if (!onlyLegacy) await writeFile(dir+'georgian-acadnusx.txt',legacy.join('\n'));expected['georgian-acadnusx.txt']=ge;
 await legacyPdf(geLines); expected['georgian-acadnusx.pdf']=ge;
 if (onlyLegacy) { console.log('Updated only georgian-acadnusx.pdf: synthetic font-tagged runs, not a real legacy font.'); return; }
 const p=(s:string)=>`<w:p><w:r><w:t xml:space="preserve">${xmlEscape(s)}</w:t></w:r></w:p>`;
 const body=usLines.slice(1,7).map(p).join('')+'<w:tbl>'+[[ 'Jan 2020 – Dec 2023',us.roles[0].label],['Mar 2018 – Jun 2021',us.roles[1].label]].map(row=>'<w:tr>'+row.map(c=>'<w:tc>'+p(c)+'</w:tc>').join('')+'</w:tr>').join('')+'</w:tbl>'+usLines.slice(11).map(p).join('');
 await writeFile(dir+'word-table.docx',zip({'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/_rels/document.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>','word/document.xml':`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/></w:sectPr></w:body></w:document>`,'word/header1.xml':`<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${p(us.name)}</w:hdr>`}));expected['word-table.docx']=us;
 GlobalFonts.registerFromPath(fontPath,'FixtureFont');const canvas=createCanvas(1200,1600),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1200,1600);ctx.fillStyle='black';ctx.font='20px FixtureFont';usLines.forEach((l,i)=>ctx.fillText(l,70,90+i*46));
 const scan=await PDFDocument.create(),page=scan.addPage([600,800]);const png=canvas.toBuffer('image/png');await writeFile(dir+'scanned-source.png',png);page.drawImage(await scan.embedPng(png),{x:0,y:0,width:600,height:800});await writeFile(dir+'scanned.pdf',await scan.save());expected['scanned.pdf']=us;
 const rtf=(s:string)=>[...s].map(c=>c.charCodeAt(0)>127?`\\u${c.charCodeAt(0)>32767?c.charCodeAt(0)-65536:c.charCodeAt(0)}?`:c.replace(/[\\{}]/g,'\\$&')).join('');
 await writeFile(dir+'us-resume.rtf','{\\rtf1\\ansi\\uc1\n'+usLines.map(rtf).join('\\par\n')+'}');expected['us-resume.rtf']=us;
 // ODF mimetype is first and stored (method 0).
 const odt=zip({'mimetype':'application/vnd.oasis.opendocument.text','META-INF/manifest.xml':'<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>','content.xml':`<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text>${usLines.map(l=>`<text:p>${xmlEscape(l)}</text:p>`).join('')}</office:text></office:body></office:document-content>`});await writeFile(dir+'us-resume.odt',odt);expected['us-resume.odt']=us;
 await writeFile(dir+'expected.json',JSON.stringify({asOf:'2026-11-16T12:00:00Z',note:'Synthetic people only. Years = floor(union of inclusive calendar months / 12). Year-only dates assume January–December; not exact tenure. Full Professional is retained as a source label, without inventing CEFR equivalence. LinkedIn/hh displayed durations intentionally stale; dates are ground truth.',fixtures:expected},null,2)+'\n');
 console.log(`Generated ${Object.keys(expected).length} synthetic CV fixtures.`);
}
void main();
