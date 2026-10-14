import assert from './check.mjs';
// Physical count identities are separate from SVG solids and ready-made assembly counts.
export function inventoryFor(parts){
 const defs={
 A01:{quantity:1,unit:'узел',items:[['Площадка',1,['stand.plinth']],['Фундамент',1,['stand.foundation']],['Дно канала',1,['stand.race']],['Берега канала',2,['stand.bank-']],['Основание опоры',1,['stand.bearing-footing']]],text:'Площадка, фундамент, дно, 2 берега канала и основание опоры.'},
 A02:{quantity:1,unit:'комплект',items:[['Доски настила',8,['floor.']],['Блоки кладки',24,['masonry.']]],text:'8 досок настила + 24 блока кладки.'},
 B01:{quantity:3,unit:'комплекта',items:[['Стойки',3,['post.0','post.1','post.2']],['Башмаки',3,['post.foot.']],['Нагели',3,['post.peg.']]],text:'В каждом: 1 стойка + 1 башмак + 1 нагель.'},
 B02:{quantity:1,unit:'комплект',items:[['Балки обвязки',2,['lintel.']],['Перемычка моста',1,['bridge']],['Ножки моста',2,['bridge.leg']]],text:'2 балки обвязки + перемычка моста + 2 ножки.'},
 C01:{quantity:2,unit:'опоры',items:[['Стойки опор',2,['bearing.pedestal.']],['Втулки',2,['bearing.ring.']]],text:'В каждой: 1 стойка + 1 втулка.'},
 D01:{quantity:2,unit:'обода',items:[['Сегменты ободьев',32,['wheel.rim.']]],text:'По 16 сегментов в ободе; всего 32 сегмента.'},
 D02:{quantity:2,unit:'комплекта',items:[['Спицы',16,['wheel.spoke.']],['Ступицы',2,['wheel.hub.']]],text:'На сторону: 8 спиц + 1 ступица; всего 16 + 2.'},
 D03:{quantity:16,unit:'досок',items:[['Доски ковшей',16,['wheel.bucket.']]],text:'По одной поперечной доске на каждый из 16 ковшей.'},
 E01:{quantity:1,unit:'вал',items:[['Общий вал',1,['axle.'],'one']],text:'Одна непрерывная деталь; 6 видимых участков рисунка не считаются отдельными валами.'},
 E02:{quantity:1,unit:'узел',items:[['Диск колеса',1,['crown.body']],['Ступица',1,['crown.hub']]],text:'1 диск + 1 ступица. Зубья перечислены отдельно в E03.'},
 E03:{quantity:24,unit:'зуба',items:[['Зубчатые вкладыши',24,['crown.tooth.']]],text:'24 отдельных деревянных зубчатых вкладыша.'},
 F01:{quantity:1,unit:'шестерня',items:[['Диски',2,['lantern.bottom','lantern.top']],['Цевки',8,['lantern.pin.']]],text:'2 диска + 8 цевок; это одна шестерня, а не 10 шестерён.'},
 F02:{quantity:1,unit:'веретено',items:[['Веретено',1,['spindle.'],'one']],text:'Одна деталь; видимые фрагменты не увеличивают её количество.'},
 G01:{quantity:1,unit:'камень',items:[['Нижний жернов',1,['bedstone']]],text:'1 неподвижный нижний жернов со сквозным отверстием.'},
 G02:{quantity:1,unit:'комплект',items:[['Верхний жернов',1,['runner']],['Порхлица',1,['stone.rynd']]],text:'1 верхний камень + 1 порхлица. Глазок — отверстие, не отдельная деталь.'},
 H01:{quantity:1,unit:'комплект',items:[['Стойки бункера',2,['hopper.support']],['Поперечина',1,['hopper.rail']],['Балки',2,['hopper.arm']],['Прижимы',2,['hopper.clamp']]],text:'2 стойки + поперечина + 2 балки + 2 прижима.'},
 H02:{quantity:1,unit:'комплект',items:[['Стенки бункера',4,['hopper.front','hopper.back','hopper.left','hopper.right']],['Доски рукава',4,['hopper.feed']]],text:'4 наклонные стенки бункера + 4 доски зернового рукава.'},
 J01:{quantity:2,unit:'рамы',items:[['Стойки рам',4,['launder.trestle']],['Поперечины рам',2,['launder.cross']]],text:'В каждой раме: 2 стойки + 1 поперечина.'},
 J02:{quantity:1,unit:'лоток',items:[['Дно лотка',1,['launder.bed']],['Борта лотка',2,['launder.side']]],text:'1 дно + 2 боковые доски.'},
 J03:{quantity:1,unit:'затвор',items:[['Направляющие',2,['gate.guide']],['Поперечина',1,['gate.cross']],['Щит',1,['gate.panel']],['Рукоять',1,['gate.handle']]],text:'2 направляющие + поперечина + щит + рукоять.'},
 K01:{quantity:1,unit:'кровля',items:[['Панели кровли',12,['roof.'],'roofpanels'],['Стропила',2,['roof.rafter']],['Конёк',1,['roof.ridge']]],text:'Показанная часть: 12 панелей + 2 стропила + 1 конёк.'},
 L01:{quantity:1,unit:'комплект',items:[['Детали отводящего лотка',3,['flour.trough']],['Готовый ящик',1,['flour.box'],'box'],['Мешки',2,['sack.'],'sacks']],excluded:['flour.box.inset','sack.tie.0','sack.tie.1'],text:'Отводящий лоток: 3 детали; готовый ящик: 1; мешки: 2. Вставка и обвязки на рисунке отдельно не считаются.'}
 };
 const match=(name,prefixes,mode)=>mode==='roofpanels'?/^roof\.\d+$/.test(name):mode==='box'?name==='flour.box':mode==='sacks'?/^sack\.\d+$/.test(name):prefixes.some(p=>p.endsWith('.')||p.endsWith('-')||['post.foot.','post.peg.','floor.','masonry.','axle.','spindle.'].includes(p)?name.startsWith(p):p==='bridge'?name===p:name.startsWith(p));
 const claimed=new Set();let componentCount=0;
 for(const [id,d] of Object.entries(defs)){
  d.lines=d.items.map(([name,expected,prefixes,mode])=>{
   const hits=parts.filter(p=>match(p.name,prefixes,mode));assert(hits.length>0,id+': '+name);
   for(const p of hits){assert(!claimed.has(p.name),'double count: '+p.name);claimed.add(p.name)}
   const actual=mode==='one'?1:hits.length;assert.equal(actual,expected,id+': '+name);componentCount+=actual;
   return {name,count:actual,renderElements:hits.map(p=>p.name)};
  });
  for(const name of d.excluded||[]){assert(parts.some(p=>p.name===name));assert(!claimed.has(name));claimed.add(name)}
 }
 assert.equal(claimed.size,parts.length,'unclassified render element');
 assert.equal(Object.keys(defs).length,22);
 return {groups:defs,componentCount,renderElementCount:parts.length,excludedGraphicElements:3,basis:'Shown physical components and explicitly named ready-made assemblies; not a purchasing or fabrication BOM.'};
}
