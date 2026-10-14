import {readFileSync,writeFileSync} from 'node:fs';
import assert from './check.mjs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditFigure} from './audit.mjs';
const HERE=dirname(fileURLToPath(import.meta.url));
import * as k from '../../../../.skill/kit/iso-kit.mjs';
import * as G from '../../../../.skill/kit/lathe.mjs';
import * as A from '../../../../.skill/kit/audit.mjs';
import {scene} from './metric-scene.mjs';
import {SPEC,mm,powerAt} from './metric-params.mjs';
import {metricPages,energyPage} from './metric-pages.mjs';
import {inventoryFor} from './inventory.mjs';
const depthChecks=[];
const groups=[
 ['A01','Основание и канал',n=>n.startsWith('stand.')],
 ['A02','Настил и кладка',n=>/^(floor|masonry)\./.test(n)],
 ['B01','Стойки, опоры, нагели',n=>n.startsWith('post.')],
 ['B02','Балки и мост',n=>/^(lintel\.|bridge)/.test(n)],
 ['C01','Опоры вала',n=>n.startsWith('bearing.')],
 ['D01','Сегменты двух ободьев',n=>n.startsWith('wheel.rim.')],
 ['D02','Спицы и ступицы',n=>/^wheel\.(spoke|hub)/.test(n)],
 ['D03','Доски ковшей',n=>n.startsWith('wheel.bucket.')],
 ['E01','Общий вал — одна деталь',n=>n.startsWith('axle.')],
 ['E02','Корончатое колесо',n=>/^crown\.(body|hub)/.test(n)],
 ['E03','Деревянные зубья',n=>n.startsWith('crown.tooth.')],
 ['F01','Цевочная шестерня',n=>n.startsWith('lantern.')],
 ['F02','Вертикальное веретено',n=>n.startsWith('spindle.')],
 ['G01','Нижний жернов',n=>n==='bedstone'],
 ['G02','Верхний жернов и порхлица',n=>n==='runner'||n==='stone.rynd'],
 ['H01','Опоры бункера',n=>/^hopper\.(support|rail|arm|clamp)/.test(n)],
 ['H02','Стенки бункера и рукав',n=>/^hopper\.(front|back|left|right|feed.*)$/.test(n)],
 ['J01','Стойки водяного лотка',n=>/^launder\.(trestle|cross)/.test(n)],
 ['J02','Дно и борта лотка',n=>/^launder\.(bed|side)/.test(n)],
 ['J03','Затвор и направляющие',n=>n.startsWith('gate.')],
 ['K01','Кровля и стропила',n=>n.startsWith('roof.')],
 ['L01','Приёмник муки и тара',n=>/^(flour\.|sack\.)/.test(n)]
];
const initialP={origin:[0,0],scale:1,azimuth:52,elevation:36};
const all=scene(k,G,initialP);
for(const p of all){const matches=groups.filter(g=>g[2](p.name));assert.equal(matches.length,1,p.name);p.code=matches[0][0]}
const counts=new Map(groups.map(([id,,f])=>[id,all.filter(p=>f(p.name)).length]));
assert.equal([...counts.values()].reduce((a,b)=>a+b,0),all.length);
// Counts follow physical components; shaft drawing runs are not separate fabrication pieces.
counts.set('E01',1);counts.set('F02',1);
const inventory=inventoryFor(all);const kits=inventory.groups;
const makeShape=p=>{const s=p.shape,m={name:p.name,owner:p.code};return s.kind==='slab'?A.slab(s.plan,s.z,s.h,m,2):s.kind==='disc'?A.disc(s.F,s.s0,s.s1,s.r,m):s.kind==='ring'?A.ring(s.F,s.s0,s.s1,s.ri,s.ro,m):A.prism(s.F,s.poly,s.s0,s.s1,m)};
function diagram({ids=groups.map(g=>g[0]),active=ids,offsets={},width=690,height=570,arrows=false,labels=false,camera={azimuth:52,elevation:36},dimensions=[]}){
 const selected=all.filter(p=>ids.includes(p.code));
 const bounds=[];
 for(const p of selected){const b=A.boundsOf(makeShape(p)),o=offsets[p.name]||offsets[p.code]||[0,0,0];for(const x of [b.min[0],b.max[0]])for(const y of [b.min[1],b.max[1]])for(const z of [b.min[2],b.max[2]])bounds.push([x+o[0],y+o[1],z+o[2]])}
 const P=k.fitProjection(bounds,width,height,{pad:dimensions.length?65:labels?45:18,...camera});
 const parts=scene(k,G,P).filter(p=>selected.some(q=>q.name===p.name));const R=A.recorder(P);
 if(ids.length===1&&['E01','F02'].includes(ids[0])){const horizontal=ids[0]==='E01',F=G.frameAlong(horizontal?[0,0,65]:[0,0,0],horizontal?[1,0,0]:[0,0,1]),s0=horizontal?-46:80,s1=horizontal?119:117+SPEC.stoneGapMm/SPEC.unitMm+.2,r=horizontal?4.5:2.3;parts.splice(0,parts.length,{name:horizontal?'axle.single':'spindle.single',paths:G.disc(s0,s1,r,F,P),at:F.o.map((v,i)=>v+F.a[i]*(s0+s1)/2),shape:{kind:'disc',F,s0,s1,r},inner:''});}
 for(const p of parts){p.code=groups.find(g=>g[2](p.name))[0];p.offset=offsets[p.name]||offsets[p.code]||[0,0,0];p.shape3=makeShape(p);p.svg=k.solidSvg(p.paths,{tone:'hi',inner:p.inner});const moved=A.moved(p.shape3,p.offset);R.solid(moved);p.item=R.put({name:p.name,at:p.at.map((v,i)=>v+p.offset[i]),svg:p.svg,shapes:[moved]})}
 A.settle(R,P,{step:1});
 const depth=A.depthOrder(R.items,P,{overlaps:R.settled.overlaps,solved:R.settled.solved});depthChecks.push({ids,camera,exploded:!!Object.keys(offsets).length,problems:depth.problems.map(p=>({front:p.front,back:p.back,kind:p.kind}))});
 let body=parts.sort((a,b)=>a.item.key-b.item.key).map(p=>`<g class="${active.includes(p.code)?'new':'existing'}" transform="${k.translateAlong(P,p.offset)}">${p.svg}</g>`).join('');
 let annotations='';
 if(arrows)for(const id of active){
  const ps=parts.filter(p=>p.code===id);const moves=new Map();
  for(const p of ps)if(p.offset.some(Boolean)){const key=p.offset.join(',');if(!moves.has(key))moves.set(key,[]);moves.get(key).push(p)}
  for(const moving of moves.values()){
   const o=moving[0].offset,c=moving.reduce((a,p)=>a.map((v,i)=>v+p.at[i]/moving.length),[0,0,0]);
   const start=k.iso(c.map((v,i)=>v+o[i]*.9),P),end=k.iso(c.map((v,i)=>v+o[i]*.2),P);
   annotations+=`<path d="M${start.join(',')} L${end.join(',')}" class="install-arrow" marker-end="url(#arr)"/>`;
  }
 }
 const occupied=[];
 if(labels)for(const id of active){
  const ps=parts.filter(p=>p.code===id);if(!ps.length)continue;
  const xs=ps.map(p=>k.iso(p.at.map((v,i)=>v+p.offset[i]),P));
  const cx=xs.reduce((s,p)=>s+p[0]/xs.length,0),cy=Math.max(16,Math.min(...xs.map(p=>p[1]))-22);
  let lx=cx,ly=cy;
  for(let attempt=0;attempt<30&&occupied.some(([x,y])=>Math.abs(x-lx)<64&&Math.abs(y-ly)<30);attempt++){
   lx=cx+((attempt%2? -1:1)*Math.ceil((attempt+1)/2)*64);
   if(lx<30||lx>width-30){lx=cx;ly=Math.max(16,cy-32*Math.ceil((attempt+1)/2))}
  }
  occupied.push([lx,ly]);
  if(Math.abs(lx-cx)>1||Math.abs(ly-cy)>1)annotations+=`<path d="M${lx},${ly+10} L${cx},${cy+15}" stroke="#111" fill="none" stroke-width="1"/>`;
  annotations+=`<g class="part-label" transform="translate(${lx},${ly})"><rect x="-22" y="-10" width="44" height="20"/><text text-anchor="middle" y="4">${id}</text></g>`;
 }
 for(const d of dimensions){
  const a=k.iso(d.a,P),b=k.iso(d.b,P),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
  const n=[-dy/len,dx/len],off=(d.offsetWorld??0)*G.scaleOf(P)+(d.offset??30),u=[a[0]+n[0]*off,a[1]+n[1]*off],v=[b[0]+n[0]*off,b[1]+n[1]*off];
  const cx=(u[0]+v[0])/2,cy=(u[1]+v[1])/2,label=d.label??String(Math.round(mm(Math.hypot(...d.b.map((x,i)=>x-d.a[i])))));
  const tick=p=>`M${p[0]-n[0]*4},${p[1]-n[1]*4} L${p[0]+n[0]*4},${p[1]+n[1]*4}`;
  annotations+=`<g class="dimension"><path d="M${a.join(',')} L${u.join(',')} M${b.join(',')} L${v.join(',')} M${u.join(',')} L${v.join(',')} ${tick(u)} ${tick(v)}"/><rect x="${cx-label.length*3.4-4}" y="${cy-8}" width="${label.length*6.8+8}" height="16"/><text x="${cx}" y="${cy+4}" text-anchor="middle">${label}</text></g>`;
 }
 return `<svg class="drawing iso" data-theme="light" viewBox="0 0 ${width} ${height}" role="img" aria-label="${active.join(', ')}"><defs><marker id="arr" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M1,1 L10,6 L1,11" fill="none" stroke="#111" stroke-width="1.8"/></marker></defs>${body}${annotations}</svg>`;
}
const small=ids=>diagram({ids,width:240,height:130});
const page=(n,title,body,sub='')=>{n=pages.length+1;return `<section class="sheet" id="page-${n}" aria-label="Страница ${n}: ${title}"><div class="page-head"><b>WM–01</b><span>${title}</span><span>${String(n).padStart(2,'0')} / __TOTAL__</span></div>${sub?`<p class="subline">${sub}</p>`:''}${body}<div class="page-foot"><span>ВОДЯНАЯ МЕЛЬНИЦА · КОЛЕСО Ø3000 · РАЗМЕРНЫЙ ЭСКИЗ</span><span>${n}</span></div></section>`};
const codeChips=ids=>ids.map(id=>`<span class="chip"><b>${id}</b><span>${kits[id].quantity} ${kits[id].unit}</span></span>`).join('');
const check=text=>`<p class="check"><span>✓</span>${text}</p>`;
let pages=[];
pages.push(page(1,'ОБЩИЙ ВИД',`<div class="cover-title"><p>РАЗМЕРНАЯ ВЕРСИЯ · ПОЛНОРАЗМЕРНЫЙ КОНЦЕПТ</p><h1>ВОДЯНАЯ<br>МЕЛЬНИЦА</h1><div class="cover-meta"><span>WM–01</span><span>Ø3000 мм</span><span>8 этапов</span><span>${groups.length} группы узлов</span></div></div><div class="cover-drawing iso-plate">${diagram({width:690,height:580})}</div><div class="cover-bottom"><div><b>СНАЧАЛА ДЕТАЛИ.</b><p>Размерные виды: страницы 2–6.<br>Каталог узлов: страницы 7–8.<br>Затем собирайте узлы по порядку.</p></div><div><b>ЧИТАЙТЕ РИСУНОК.</b><p>Чёрный — добавляемые детали.<br>Серый — уже собранная часть.<br>Стрелка — направление установки.</p></div></div><p class="scope">Размеры заданы от колеса Ø3000 мм. Это концепт для проверки компоновки; несущие конструкции и рабочие профили передачи требуют отдельного расчёта.</p>`));
metricPages({page,pages,diagram,small,groups,counts,check});
for(let index=0;index<2;index++){
 const rows=groups.slice(index*11,index*11+11);
 pages.push(page(index+2,'ДЕТАЛИ '+(index+1)+' / 2',`<h2 class="inventory-title">Комплекты и состав</h2><p class="inventory-note">Справа — количество названных единиц; ниже — их состав. Крепёж и скрытые соединения не нормированы: это не закупочная ведомость.</p><div class="inventory">${rows.map(([id,title])=>`<article><div class="inventory-top"><b>${id}</b><strong>${kits[id].quantity}<span class="count-unit">${kits[id].unit}</span></strong></div>${small([id])}<p class="kit-title">${title}</p><p class="kit-content">${kits[id].text}</p></article>`).join('')}</div><div class="inventory-rule"><span>□ Все группы найдены</span><span>□ Парные детали сверены</span><span>${index===0?'Продолжение → стр. 8':'Сборка → стр. 9'}</span></div>`));
}
const steps=[
 {title:'Основание и рабочая площадка',ids:['A01','A02'],active:['A02'],off:{A02:[0,0,25]},action:'Уложите настил на основание. Сложите заднюю стенку.',notes:['Оставьте водоотводный канал открытым.','Настил образует одну рабочую плоскость.'],detail:['A01','A02'],detailTitle:'Настил над основанием',checks:['Доски лежат поперёк опор.','Канал свободен по всей длине.']},
 {title:'Каркас и опоры механизма',ids:['A01','A02','B01','B02','C01'],active:['B01','B02','C01'],off:{B01:[0,0,12],B02:[0,0,30],C01:[0,0,12]},action:'Поставьте стойки. Установите балки, мост и опоры вала.',notes:['Передняя стенка на схеме снята для обзора.','Две опоры горизонтального вала должны совпасть по высоте.'],detail:['C01'],detailTitle:'Пара опор вала',checks:['Каркас опирается на площадку.','Вал сможет пройти через обе опоры.']},
 {title:'Водяное колесо',ids:['D01','D02','D03'],active:['D01','D02','D03'],off:Object.fromEntries(all.filter(p=>/^wheel\./.test(p.name)).map(p=>[p.name,p.name.includes('.-10.')||p.name==='wheel.hub.-10'?[-24,0,0]:p.name.includes('.10.')||p.name==='wheel.hub.10'?[24,0,0]:[0,0,0]])),action:'Соедините ободья со спицами. Установите доски ковшей между ободьями.',notes:['16 ковшей равномерно распределены по окружности.','Обе ступицы находятся на одной оси.'],detail:['D01','D02','D03'],detailTitle:'Колесо в собранном виде',checks:['Ковши закреплены между двумя ободьями.','Ступицы соосны, ободья параллельны.']},
 {title:'Вал и зубчатая передача',ids:['A01','A02','C01','D01','D02','D03','E01','E02','E03','F01','F02'],active:['E01','E02','E03','F01','F02'],off:{E02:[-40,0,0],E03:[-40,0,0],F01:[0,0,25],F02:[0,0,25]},action:'Установите колесо на общий вал. Совместите корончатое колесо и цевочную шестерню.',notes:['Горизонтальное вращение переходит в вертикальное.','24 зуба / 8 цевок = передаточное отношение 1:3.'],detail:['E02','E03','F01','F02'],detailTitle:'Передача под прямым углом',checks:['Зубья заходят в промежутки между цевками.','Геометрический скрининг не заменяет проверку рабочего профиля зубьев.']},
 {title:'Неподвижный и вращающийся камни',ids:['B02','F01','F02','G01','G02'],active:['G01','G02'],off:{G01:[0,0,16],G02:[0,0,40]},action:'Установите нижний жернов. Над ним разместите верхний камень с центральным глазком.',notes:['Нижний жернов закреплён; верхний приводится веретеном.','В размерной версии показан условный зазор 0,5 мм; режим помола им не определяется.'],detail:['G01','G02'],detailTitle:'Два камня, одна вертикальная ось',checks:['Центры камней совпадают с осью привода.','Верхний камень вращается, нижний остаётся на месте.']},
 {title:'Бункер и подача зерна',ids:['G01','G02','H01','H02'],active:['H01','H02'],off:{H01:[0,0,10],H02:[0,0,30]},action:'Установите опоры и четыре стенки бункера. Совместите выход с глазком жернова.',notes:['Бункер удерживается собственными опорами.','Зерно должно поступать в центр вращающегося камня.'],detail:['H01','H02'],detailTitle:'Бункер на опорах',checks:['Выход бункера находится над глазком.','Опоры не касаются вращающегося камня.']},
 {title:'Водяной лоток и затвор',ids:['A01','D01','D02','D03','J01','J02','J03'],active:['J01','J02','J03'],off:{J02:[0,0,18],J03:[0,0,30]},action:'Соберите стойки и лоток. Вставьте затвор в направляющие над верхней частью колеса.',notes:['Вода поступает сверху, затем уходит в нижний канал.','Поднятие затвора открывает проход воды.'],detail:['J02','J03'],detailTitle:'Затвор в направляющих',checks:['Край лотка расположен над ковшами.','Затвор поднимается и опускается свободно.']},
 {title:'Завершение и приёмник муки',ids:groups.map(g=>g[0]),active:['K01','L01'],off:{K01:[0,0,20],L01:[0,16,0]},action:'Установите кровлю, отводящий лоток и приёмный ящик. Разместите тару.',notes:['Передняя часть кровли условно снята, чтобы были видны жернова.','Приёмник расположен под выходом муки.'],detail:['L01'],detailTitle:'Приёмник и тара',checks:['Кровля не закрывает подачу зерна.','Путь от жерновов к приёмнику свободен.']}
];
steps.forEach((s,i)=>{
 const cameras=[{azimuth:65,elevation:55},{azimuth:40,elevation:30},{azimuth:28,elevation:18},{azimuth:20,elevation:30},{azimuth:45,elevation:40},{azimuth:135,elevation:45},{azimuth:25,elevation:30},{azimuth:130,elevation:35}];
 const main=diagram({camera:cameras[i],ids:s.ids,active:s.active,offsets:s.off,width:690,height:535,arrows:true,labels:true});
 const detail=diagram({ids:s.detail,width:310,height:200,camera:i===2?{azimuth:0,elevation:0}:i===3?{azimuth:0,elevation:15}:i===4?{azimuth:90,elevation:90}:i===5?{azimuth:135,elevation:65}:{azimuth:52,elevation:36}});
 pages.push(page(i+4,'ЭТАП '+(i+1)+' / 8',`<div class="step-title"><span>${i+1}</span><h2>${s.title}</h2></div><div class="parts-strip">${codeChips(s.active)}</div><p class="action">${s.action}</p><div class="step-drawing">${main}</div><div class="step-bottom"><div class="detail"><b>${s.detailTitle}</b>${detail}</div><div class="notes"><p>${s.notes.join('</p><p>')}</p><div class="checks">${s.checks.map(check).join('')}</div></div></div>`));
});
energyPage({page,pages,diagram,check});
pages.push(page(12,'КОНТРОЛЬ И РАБОТА',`<div class="step-title"><span>✓</span><h2>Проверка концепта</h2></div><div class="final-drawing">${diagram({width:690,height:490})}</div><div class="flow"><div><strong>1</strong><b>ВОДА</b><p>Лоток → ковши</p></div><span>→</span><div><strong>2</strong><b>ВРАЩЕНИЕ</b><p>Вал → передача</p></div><span>→</span><div><strong>3</strong><b>ПОМОЛ</b><p>Зерно → жернова</p></div><span>→</span><div><strong>4</strong><b>МУКА</b><p>Выход → ящик</p></div></div><div class="final-checks"><h3>Проверьте последовательность</h3>${['Затвор регулирует подачу воды к верхней части колеса.','Колесо и корончатая шестерня вращаются на общем валу.','Цевочная шестерня передаёт вращение верхнему жернову.','Нижний жернов закреплён, выход бункера совмещён с глазком.','Отвод воды и выход муки остаются свободными.'].map(check).join('')}</div><p class="endnote">Справка по историческому устройству: WaterHistory.org. Габариты и условные зазоры заданы. Прочность, материалы, крепления, профиль зубьев и производительность помола не подтверждены; статус проверок приведён на страницах 2, 5 и 17.</p>`));
assert.equal(pages.length,18);assert.equal(steps.length,8);assert([...counts.values()].every(n=>n>0));
const css=readFileSync(join(HERE,'booklet.css'),'utf8')+readFileSync(join(HERE,'metric.css'),'utf8');
writeFileSync(join(HERE,'watermill.html'),`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WM–02 — размерная инструкция Ø3000</title><style>${k.ISO_CSS}${css}</style></head><body class="iso" data-theme="light"><nav class="toolbar"><b>WM–02 · 18 страниц</b><button onclick="window.print()">Печать</button></nav><main>${pages.join('').replaceAll('__TOTAL__',String(pages.length)).replaceAll('WM–01','WM–02')}</main><script>const fit=()=>{document.querySelector("main").style.zoom=document.documentElement.clientWidth<820?Math.min(1,(document.documentElement.clientWidth-20)/794):1};fit();addEventListener("resize",fit);addEventListener("beforeprint",()=>{document.querySelector("main").style.zoom=1});addEventListener("afterprint",fit);</script></body></html>`);
assert(depthChecks.every(v=>v.problems.length===0),'depth-order conflict in a drawing');
console.log('view depth checks:',depthChecks.length,'views;',depthChecks.reduce((n,v)=>n+v.problems.length,0),'flags');
console.log('18 pages, 8 assembly stages,',all.length,'elements; inventory partition checked');
if(process.argv.includes("--audit"))auditFigure();
