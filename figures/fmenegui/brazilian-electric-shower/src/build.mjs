import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {pressureSvg, circuitSvg} from './pressure.mjs'
import * as k from '../../../../.skill/kit/iso-kit.mjs'
import * as G from '../../../../.skill/kit/lathe.mjs'
import * as A from '../../../../.skill/kit/audit.mjs'
import {tubePieces,tubeSvg} from '../../../../.skill/kit/tube.mjs'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const W=736, H=475, az=52, el=27
const P=k.fitProjection([[-182,-25,67],[86,83,0],[-75,-78,147],[80,82,-91]],W,H,{pad:34,azimuth:az,elevation:el})
P.origin[0]-=32
const R=A.recorder(P)
const at=p=>k.iso(p,P)
const S=(p,t='mid',inner='')=>k.solidSvg(p,{tone:t,crease:'lo',inner})
const L=(d,t='lo')=>k.lineSvg(d,{tone:t})
const d3=pts=>pts.map((p,i)=>(i?'L':'M')+at(p).map(n=>n.toFixed(2)).join(' ')).join(' ')
function put(name,p,svg,shape,group='body',move=null){
  shape.name=name
  const dome=name==='diaphragm.membrane'?'<g data-dome="">'+Array.from({length:4},(_,i)=>`<path class="iso-shade" data-shade="${i}"/>`).join('')+'</g>':''
  const opts={name,piece:group,at:p,svg:`<g data-part="${group}" data-name="${name}">${svg}${dome}</g>`,shapes:[R.solid(shape)]}
  if(move)opts.move=move
  R.put(opts)
}
function slab(name,plan,z,h,t='mid',group='body',inner='',move=null){put(name,[plan.x+plan.w/2,plan.y+plan.d/2,z+h/2],S(k.slabOf(plan,z,h,P,5,.65),t,inner),A.slab(plan,z,h),group,move)}
function cyl(name,x,y,r,z,h,t='mid',group='body',inner='',move=null){put(name,[x,y,z+h/2],S(k.cylinder(x,y,r,z,h,P,64,.35),t,inner),A.cylinder(x,y,r,z,h),group,move)}
function ring(name,x,y,ri,ro,z,h,t='mid',group='body'){
  const f=G.frameOf([x,y,z],[0,0,1],[1,0,0],[0,1,0])
  put(name,[x,y,z+h/2],S(G.ringBand(0,h,ri,ro,f,P),t),A.ring(f,0,h,ri,ro),group)
}
function splitRing(name,x,y,ri,ro,z,h,t='mid',group='body'){
  for(let side=0;side<2;side++){
    const poly=sector(ri,ro,142+180*side,322+180*side).map(p=>[p[0]+x,p[1]+y])
    put(name+'.'+side,[x,y,z+h/2],S(k.extrude(poly,z,h,P,{convex:false}),t),A.extruded(poly,z,h),group)
  }
}
function screw(name,x,y,z,group='body'){
  cyl(name+'.washer',x,y,2.6,z,.7,'lo',group)
  cyl(name+'.head',x,y,1.65,z+.7,1.1,'mid',group,L(k.lineOnTop([x-1,y],[x+1,y],z+1.8,P),'hi'))
}
const sector=(ri,ro,a0,a1,n=96)=>{
  const out=[]
  for(let i=0;i<=n;i++){let a=(a0+(a1-a0)*i/n)*Math.PI/180
    out.push([ro*Math.cos(a),ro*Math.sin(a)])}
  for(let i=n;i>=0;i--){let a=(a0+(a1-a0)*i/n)*Math.PI/180
    out.push([ri*Math.cos(a),ri*Math.sin(a)])}
  return out
}
function arcSolid(name,ri,ro,z,h,t='mid',group='body',a0=142,a1=322){
  const poly=sector(ri,ro,a0,a1)
  put(name,[0,0,z+h/2],S(k.extrude(poly,z,h,P,{convex:false,bevel:.6}),t),A.extruded(poly,z,h),group)
}
function tube(name,pts,r,group='body',tone='mid'){
  const pieces=tubePieces(pts,r,P,{maxLength:18,spacing:1.8})
  const touching=name.startsWith('heater.')?['heater.seat.*','terminal.*']:[]
  const routes=R.route(name,pts,r,{piece:group,limp:group==='electric',touch:touching})
  pieces.forEach((p,i)=>{
    R.put({name:name+'.'+i,piece:group,at:p.mid,route:name,chunk:i,
      svg:`<g data-part="${group}" data-name="${name}">${tubeSvg(p,{tone})}</g>`,
      shapes:[A.tube(p.points,p.radii,{name:name+'.'+i,owner:name})]})
  })
  return pieces
}

// Wall coupling and exposed inlet channel, all along the same real axis.
const FX=G.frameOf([-182,-18,66],[1,0,0],[0,1,0],[0,0,1])
function inletRing(name,s0,s1,ri,ro,t='mid'){
  put(name,[-182+(s0+s1)/2,-18,66],S(G.ringBand(s0,s1,ri,ro,FX,P),t),A.ring(FX,s0,s1,ri,ro,{ground:name==='stand.wall'}),'inlet')
}
inletRing('stand.wall',0,4,9,24,'lo')
inletRing('inlet.socket',4,13,9,14)
inletRing('inlet.seal',13,15,9,13,'lo')
inletRing('inlet.union',15,23,9,16)
const pipePoly=sector(9,11,180,360,64)
put('inlet.cut-pipe',[-130,-18,60],S(G.prismOf(FX,pipePoly,23,98,P),'mid'),A.prism(FX,pipePoly,23,98),'inlet')
inletRing('inlet.body-collar',98,102,9,15)
// The mounting boss has an open square bore around the round inlet.
slab('inlet.boss-bottom',{x:-80,y:-33,w:10,d:30,r:0},51,4,'mid','inlet')
slab('inlet.boss-top',{x:-80,y:-33,w:10,d:30,r:0},77,4,'mid','inlet')
slab('inlet.boss-side-a',{x:-80,y:-33,w:10,d:4,r:0},55,22,'mid','inlet')
slab('inlet.boss-side-b',{x:-80,y:-7,w:10,d:4,r:0},55,22,'mid','inlet')

// Spread plate and retained heating chamber. Face perforations are genuine openings.
const nozzle=[]
for(let rr of [18,34,50,66]){
  const count=Math.round(rr/2.7)
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2
    nozzle.push([rr*Math.cos(a),rr*Math.sin(a),0])}
}
cyl('spreader.plate',0,0,79,0,5,'mid','spreader',
  L(k.ring(0,0,76,5,P,160),'lo')+nozzle.map(p=>`<path d="${k.ring(p[0],p[1],1.05,5,P,16)}" class="sh-hole"/>`).join(''))
splitRing('spreader.edge',0,0,79,83,0,7,'mid','spreader')
arcSolid('distribution.wall',69,74,5,10,'lo')
cyl('chamber.floor',0,0,74,15,4,'mid','body',L(k.ring(0,0,68,19,P,120),'lo'))
ring('chamber.gasket',0,0,70,75,19,2,'lo')
arcSolid('chamber.rear-bottom',70,75,21,30,'mid')
arcSolid('chamber.rear-top',70,75,81,14,'mid')
arcSolid('chamber.rear-port-a',70,75,51,30,'mid','body',142,166)
arcSolid('chamber.rear-port-b',70,75,51,30,'mid','body',218,322)
arcSolid('chamber.rim',69,77,95,4,'hi')
arcSolid('chamber.roof',.01,70,99,4,'mid')
arcSolid('dry.rear',70,75,103,31,'mid')
arcSolid('dry.cap-edge',69,77,134,4,'hi')
for(const a of [165,235,300]){
  const x=64*Math.cos(a*Math.PI/180),y=64*Math.sin(a*Math.PI/180)
  cyl('case.screw-post.'+a,x,y,4.5,19,80,'lo')
  screw('case.fastener.'+a,x,y,103)
}
// Outlet standpipe keeps the chamber wet when the valve closes.
ring('outlet.standpipe',24,53,5.4,7.5,19,41,'hi','outlet')
ring('outlet.lip',24,53,5.4,8.5,60,2,'hi','outlet')

// Ceramic supports and a serpentine resistive cartridge. This is schematic geometry.
for(const x of [-23,22]){
  for(const y of [-22,25])cyl('heater.foot.'+x+'.'+y,x,y,3.1,19,10,'lo','heater-support')
  slab('heater.ceramic.'+x,{x:x-3.5,y:-27,w:7,d:58,r:1.8},29,7.5,'hi','heater-support')
  for(const y of [-20,-4,12,28])slab('heater.seat.'+x+'.'+y,{x:x-4.5,y:y-1.1,w:9,d:2.2,r:.5},36.5,1,'lo','heater-support')
}
const heater=[]
for(let row=0;row<8;row++){
  const y=-27+row*8,dir=row%2===0?1:-1
  const start=dir===1?-37:42,end=dir===1?42:-37
  if(!row)heater.push([start,y,37.92])
  heater.push([end,y,37.92])
  if(row<7){for(let j=1;j<=16;j++){
    const theta=-Math.PI/2+Math.PI*j/16
    heater.push([end+dir*4*Math.cos(theta),y+4+4*Math.sin(theta),37.92])
  }}
}
const total=G.pathLength(heater), tapAt=total*(3500/5500)
const hA=G.cut(heater,0,tapAt-.75),hB=G.cut(heater,tapAt+.75,total)
tube('heater.active',hA,.42,'heater-a','hi')
tube('heater.extension',hB,.42,'heater-b','hi')
const first=heater[0],last=heater.at(-1),tap=G.pointAlong(heater,tapAt)
// Visible terminal posts at the two ends. The centre tap selects a shorter element.
for(const [n,p] of [['common',first],['summer',last],['winter',tap]]){
  const z=p[2]
  const f=G.frameOf(p,[1,0,0],[0,1,0],[0,0,1])
  // End terminals extend away from the wire end so each wire meets a flat face.
  const sign=n==='winter'?1:-1
  const s0=n==='winter'?-.75:-3.5,s1=n==='winter'?.75:0
  put('terminal.'+n,p,S(G.disc(s0,s1,1.6,f,P),'hi'),A.disc(f,s0,s1,1.6),'electric')
  if(n!=='winter')cyl('terminal.'+n+'.post',p[0]-1.75,p[1],.9,z+1.6,5,'hi','electric')
}

// Dry compartment. The diaphragm is attached at its rim and only its centre rises.
const DC=[-20,-22], dz=104
splitRing('diaphragm.mount',DC[0],DC[1],20,26,dz-1,4,'hi','membrane-frame')
cyl('diaphragm.membrane',DC[0],DC[1],20,dz,1,'lo','membrane')
for(const a of [0,90,180,270]){const an=a*Math.PI/180
  screw('diaphragm.screw.'+a,DC[0]+23*Math.cos(an),DC[1]+23*Math.sin(an),dz+3,'membrane-frame')}
cyl('diaphragm.puck',DC[0],DC[1],7,dz+1,3,'hi','actuator','',[0,0,4])
cyl('diaphragm.plunger',DC[0],DC[1],2.6,dz+4,17,'hi','actuator','',[0,0,4])
slab('switch.yoke',{x:-47,y:-26,w:54,d:8,r:2},125,3,'hi','actuator','',[0,0,4])
for(const x of [-42,2]){
  cyl('switch.tower.'+x,x,-43,4,103,33,'mid','switch')
  slab('switch.fixed.'+x,{x:x-3,y:-46,w:6,d:37,r:.6},136,1.7,'hi','switch')
  cyl('switch.fixed-pad.'+x,x,-12,2.7,133.8,2.2,'hi','switch')
  slab('switch.moving.'+x,{x:x-3,y:-22,w:6,d:13,r:.6},128,1.2,'hi','actuator','',[0,0,4])
  cyl('switch.moving-pad.'+x,x,-12,2.7,129.2,.6,'hi','actuator','',[0,0,4])
  screw('switch.screw.'+x,x,-41,137.7,'switch')
}
// A mechanical selector, placed on the visible remaining rim.
cyl('selector.seat',39,-36,8,103,3,'mid','selector')
cyl('selector.axis',39,-36,2.8,106,10,'hi','selector')
cyl('selector.cam',39,-36,9.5,116,3,'hi','selector')
slab('selector.lever',{x:37,y:-38,w:29,d:5,r:2},119,3,'hi','selector')
slab('selector.grip',{x:66,y:-40,w:7,d:9,r:2},118,5,'mid','selector')

// The supply connector sits on the remaining rear housing, not in the water.
slab('power.connector',{x:-48,y:-68,w:54,d:13,r:2},138,10,'hi','electric')
for(const x of [-38,-21,-4])screw('power.screw.'+x,x,-61.5,148,'electric')
// Copper straps have flat, face-to-face terminal joints rather than dangling wire tips.
for(const x of [-42,2]) {
  slab('feed.block.'+x,{x:x-2,y:-55,w:4,d:2,r:.2},140,4,'hi','electric')
  slab('feed.strap.'+x,{x:x-1.1,y:-53,w:2.2,d:10,r:.2},141.1,.9,'hi','electric')
  slab('feed.end.'+x,{x:x-1.1,y:-43,w:2.2,d:3,r:.2},139.5,2.5,'hi','electric')
}

// Modelled flow tracers are educational overlays, not physical pipes.
const coldRoute=[[-178,-18,66],[-95,-18,66],[-62,-18,66],[-47,-12,53],[-18,6,51],[16,24,53],[24,53,62]]
const hotRoute=[[24,53,61],[24,53,30],[24,53,12],[32,40,10]]
const flowData={cold:coldRoute.map(at),hot:hotRoute.map(at),sprays:[]}
const sprayMarkup=[]
nozzle.forEach((p,i)=>{
  if(i%2)return
  const end=[p[0]*1.18,p[1]*1.18,-65-(i%4)*6]
  const a=at([p[0],p[1],0]), b=at(end)
  flowData.sprays.push({a,b,phase:(i*.381966)%1})
  sprayMarkup.push(`<path class="sh-spray" d="M${a} L${b}"/><path class="sh-droplet" data-jet="${flowData.sprays.length-1}" d="M${a} L${b}"/>`)
})
const view=new Map()
for(const item of R.items)if(item.move)view.set(item.name,item.move)
console.log('Scene:',R.items.length,'drawn parts,',R.solids.length,'recorded solids,',R.routes.length,'routes')
// Settle against recorded full shapes. The sampled audit remains separate from browser QA.
const settled=A.settle(R,P,{step:.8,least:.6,states:[0]})
R.items.sort((a,b)=>a.key-b.key)
const solids=R.items.map(i=>i.svg).join('')
const svg=`<svg xmlns="http://www.w3.org/2000/svg" class="sh-svg iso-svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="sh-svg-title sh-svg-desc"><title id="sh-svg-title">Brazilian electric shower cutaway</title><desc id="sh-svg-desc">Water enters at the side, crosses the heating chamber and exits through the spray plate. Above the wet chamber, a diaphragm raises an insulated actuator and closes the pressure contacts. Front housing removed. Connections simplified.</desc><defs><linearGradient id="sh-jet-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--blue)" stop-opacity=".5"/><stop offset="1" stop-color="var(--blue)" stop-opacity="0"/></linearGradient></defs><g data-camera=""><g data-layer="sprays">${sprayMarkup.join('')}</g><g data-layer="parts">${solids}</g><g data-layer="flow"><path id="sh-cold-path" class="sh-flow-track" d="${d3(coldRoute)}"/><path id="sh-hot-path" class="sh-flow-track" d="${d3(hotRoute)}"/>${Array.from({length:10},(_,i)=>`<circle data-tracer="${i}" r="2.3" class="sh-tracer"/>`).join('')}</g></g></svg>`

const kitCss=fs.readFileSync(new URL('../../../../.skill/kit/iso.css',import.meta.url),'utf8')
const css=kitCss.slice(kitCss.indexOf('.iso-svg'),kitCss.indexOf('@keyframes'))
const scoped=css.replace(/(^|\n)([^@\n{}]+)\{/g,(m,pre,sel)=>pre+sel.split(',').map(s=>'#brazil-shower '+s.trim()).join(',')+'{')
let template=fs.readFileSync(path.join(HERE,'fragment.html'),'utf8')
const runtime=fs.readFileSync(path.join(HERE,'live.js'),'utf8')
const model=fs.readFileSync(path.join(HERE,'model.mjs'),'utf8').replace(/^export\s+/gm,'')
const data={P,W,H,diaphragm:DC,at0:at([0,0,0]),atRise:at([0,0,4]),flowData,parts:R.items.length}
template=template.replace('<!-- GEOMETRY -->',svg).replace('/* KIT_CSS */',scoped).replace('/* RUNTIME */',model+'\n'+pressureSvg.toString()+'\n'+circuitSvg.toString()+'\nconst DATA='+JSON.stringify(data)+'\n'+runtime)
const light=process.argv.includes('--light')
const page=light?'shower-light.html':'shower.html'
const pageCss=fs.readFileSync(path.join(HERE,'page.css'),'utf8')
const body=template.replace('<!-- PRESSURE -->',pressureSvg(420,1,true)).replace('<!-- CIRCUIT -->',circuitSvg(250,true,true))
const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brazilian electric shower</title><style>'+pageCss+'</style></head><body class="iso" data-theme="'+(light?'light':'dark')+'"><main class="iso-page">'+body+'</main></body></html>'
fs.writeFileSync(path.join(HERE,page),html)
if(process.argv.includes('--audit'))A.auditOrExit(R,P)
console.log('Wrote '+page)
