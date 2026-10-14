import {SPEC} from './metric-params.mjs';
// Explanatory geometry; all dimensions are model units, not survey measurements.
export function scene(k,G,P,angle=0,gate=.65,dynamic=false) {
 const isMoving=n=>/wheel\.(spoke|bucket)|crown\.tooth|lantern\.pin|^runner$|^gate\./.test(n);
 const parts=[]; const tau=Math.PI*2;
 const put=(name,paths,at,shape,tone='mid',inner='')=>parts.push({name,paths,at,shape,tone,inner});
 const box=(name,x,y,z,w,d,h,tone='mid')=>{if(dynamic&&!isMoving(name))return;const plan={x,y,w,d,r:.4};put(name,k.slabOf(plan,z,h,P,2,.5),[x+w/2,y+d/2,z+h/2],{kind:'slab',plan,z,h},tone)};
 const disc=(name,o,axis,s0,s1,r,tone='mid')=>{if(dynamic&&!isMoving(name))return;const F=G.frameAlong(o,axis);put(name,G.disc(s0,s1,r,F,P,{steps:64}),o.map((v,i)=>v+axis[i]*(s0+s1)/2),{kind:'disc',F,s0,s1,r},tone)};
 const ring=(name,o,axis,s0,s1,ri,ro,tone='mid')=>{const F=G.frameAlong(o,axis);put(name,G.ringBand(s0,s1,ri,ro,F,P,{hole:[G.dot3(F.a,G.viewOf(P))>=0?s1:s0,ri]}),o.map((v,i)=>v+axis[i]*(s0+s1)/2),{kind:'ring',F,s0,s1,ri,ro},tone)};
 const prism=(name,F,poly,s0,s1,tone='mid')=>{if(dynamic&&!isMoving(name))return;const c=poly.reduce((s,p)=>[s[0]+p[0]/poly.length,s[1]+p[1]/poly.length],[0,0]);put(name,G.prismOf(F,poly,s0,s1,P),F.o.map((v,i)=>v+F.u[i]*c[0]+F.v[i]*c[1]+F.a[i]*(s0+s1)/2),{kind:'prism',F,poly,s0,s1},tone)};
 const rotated=(a,poly)=>poly.map(([u,v])=>[u*Math.cos(a)-v*Math.sin(a),u*Math.sin(a)+v*Math.cos(a)]);
 box('stand.plinth',-100,-152,-10,236,294,10,'lo');
 box('stand.foundation',-85,-66,0,154,131,19,'lo');
 box('stand.race',77,-143,0,44,278,3,'lo');
 box('stand.bank-left',72,-145,0,5,280,8,'lo');box('stand.bank-right',121,-145,0,5,280,8,'lo');
 for(let i=0;i<8;i++)box('floor.'+i,-83+i*18,-62,19,17.5,122,5,'mid');
 // A low rear wall and a roof strip keep every drive component visible.
 for(let j=0;j<4;j++)for(let i=0;i<6;i++)box('masonry.'+j+'.'+i,-84+i*25+(j%2?3:0),-65,24+j*9,24,8,9,'lo');
 for(const [i,x,y] of [[0,-78,-56],[1,57,-56],[2,-78,52]]){
  box('post.'+i,x,y,29,7,7,126);box('post.foot.'+i,x-1,y-1,24,9,9,5,'lo');
  box('post.peg.'+i,x+1,y+7,140,2,1.5,2,'hi');
 }
 box('lintel.back',-78,-56,155,142,8,8);box('lintel.side',-78,-48,155,7,107,8);
 box('bridge',-45,-25,103,69,7,7);box('bridge.leg0',-45,-25,24,7,7,79);box('bridge.leg1',17,-25,24,7,7,79);
 // Half a pitched roof, with individual overlapping shingles.
 const roofF=G.frameOf([0,0,0],[1,0,0],[0,1,0],[0,0,1]);
 for(let i=0;i<12;i++)prism('roof.'+i,roofF,[[-62,167],[-23,189],[-23,192],[-62,170]],-85+i*12.5,-73+i*12.5,'lo');
 for(const x of [-78,57])prism('roof.rafter.'+x,roofF,[[-56,163],[-23,185],[-23,189],[-56,167]],x,x+7,'mid');
 prism('roof.ridge',roofF,[[-24,188],[-20,190],[-22,194],[-26,192]],-88,66,'mid');
 // Water supply sits above the wheel's upstream quadrant.
 for(const y of [-133,-69]){
 box('launder.trestle.'+y,87,y,3,7,7,108);box('launder.trestle2.'+y,113,y,3,7,7,108);
 box('launder.cross.'+y,84,y,108,39,7,5);
 }
 box('launder.bed',90,-145,113,15,115,4);
 box('launder.side0',87,-145,113,3,115,12);box('launder.side1',105,-145,113,3,115,12);
 box('gate.guide0',86,-102,125,4,5,27);box('gate.guide1',105,-102,125,4,5,27);box('gate.cross',90,-105,125,15,3,3);
 box('gate.panel',90.05,-101,117+gate*15,14.9,3,17,'hi');box('gate.handle',95.5,-101,134+gate*15,4,3,10,'hi');
 // Bearings and the one horizontal shaft.
 box('stand.bearing-footing',62,-12,19,10,24,5,'lo');
 for(const x of [-42,64]){box('bearing.pedestal.'+x,x,-10,24,10,20,32);ring('bearing.ring.'+x,[x,0,65],[1,0,0],0,10,4.5+SPEC.shaftBearingRadialClearanceMm/SPEC.unitMm,9,'hi')}
 // One physical shaft; occluded runs inside hubs are omitted from the SVG so painter order stays exact.
 for(const [i,a,b] of [[0,-46,-42],[1,-32,-18],[2,-10,64],[3,74,85],[4,90,105],[5,110,119]])disc('axle.'+i,[0,0,65],[1,0,0],a,b,4.5,'hi');
 // Crown wheel: face teeth and a vertical lantern, 24:8 = 3:1.
 const gearF=G.frameAlong([-15,0,65],[1,0,0]);
 ring('crown.body',[-15,0,65],[1,0,0],0,5,4.5,25,'mid');
 ring('crown.hub',[-15,0,65],[1,0,0],-3,0,4.5,7,'hi');
 for(let i=0;i<24;i++)prism('crown.tooth.'+i,gearF,rotated(angle+i*tau/24,[[-.95,21],[.95,21],[.95,25],[-.95,25]]),5,9,'hi');
 const pinAngle=3*angle+Math.PI/8;
 ring('lantern.bottom',[0,0,80],[0,0,1],0,3,2.3,10,'mid');ring('lantern.top',[0,0,83],[0,0,1],17,20,2.3,10,'mid');
 for(let i=0;i<8;i++){const a=pinAngle+i*tau/8;disc('lantern.pin.'+i,[SPEC.lanternPitchRadius*Math.cos(a),SPEC.lanternPitchRadius*Math.sin(a),83],[0,0,1],0,17,SPEC.lanternPinRadius,'hi')}
 for(const [i,a,b] of [[0,83,100],[1,103,110],[2,117,117+SPEC.stoneGapMm/SPEC.unitMm+.2]])disc('spindle.'+i,[0,0,0],[0,0,1],a,b,2.3,'hi');
 ring('bedstone',[0,0,110],[0,0,1],0,7,3,28,'mid');
 const stoneZ=117+SPEC.stoneGapMm/SPEC.unitMm;
 ring('runner',[0,0,stoneZ],[0,0,1],0,8,4,27,'lit');
 // Closed dressing grooves belong to the runner's top face.
 const runner=parts.at(-1);let grooves='';
 for(let i=0;i<10;i++) {const a=pinAngle+i*tau/10;const poly=[[7,0],[24,3],[22,4],[7,1]].map(([r,t])=>[r*Math.cos(a)-t*Math.sin(a),r*Math.sin(a)+t*Math.cos(a),stoneZ+8.1]);grooves+=`<path class="iso-line" data-tone="lo" d="${k.pathOf(poly.map(p=>k.iso(p,P)),true)}"/>`}
 runner.inner=grooves;
 box('stone.rynd',-.6,-4,stoneZ+.2,1.2,8,.5,'hi');
 box('hopper.support0',-31,-28,110,4,4,43);box('hopper.support1',27,-28,110,4,4,43);
 box('hopper.rail',-31,-28,150,62,4,4);box('hopper.arm0',-26,-24,154,3,46,5);box('hopper.arm1',23,-24,154,3,46,5);
 box('hopper.clamp0',-26,-24,159,6,46,1,'hi');box('hopper.clamp1',20,-24,159,6,46,1,'hi');
 // Sloping wooden walls; a real bottom aperture replaces the old vertical trapezoids.
 const L=Math.hypot(16.5,22),vx=16.5/L,vz=22/L;
 const front=G.frameOf([0,2.5,137],[0,-vz,vx],[1,0,0],[0,vx,vz]);
 const back=G.frameOf([0,-2.5,137],[0,-vz,-vx],[1,0,0],[0,-vx,vz]);
 prism('hopper.front',front,[[-2.5,0],[2.5,0],[22,L],[-22,L]],-.7,0,'hi');
 prism('hopper.back',back,[[-2.5,0],[2.5,0],[22,L],[-22,L]],0,.7,'mid');
 const LS=Math.hypot(19.5,22),ux=19.5/LS,uz=22/LS;
 const left=G.frameOf([-2.5,0,137],[-uz,0,-ux],[0,1,0],[-ux,0,uz]);
 const right=G.frameOf([2.5,0,137],[-uz,0,ux],[0,1,0],[ux,0,uz]);
 prism('hopper.left',left,[[-1.8,0],[1.8,0],[18.3,LS],[-18.3,LS]],0,.7,'mid');
 prism('hopper.right',right,[[-1.8,0],[1.8,0],[18.3,LS],[-18.3,LS]],-.7,0,'mid');
 box('hopper.feedfront',-2.5,2.5,126.3,5,.4,10.7,'hi');box('hopper.feedback',-2.5,-2.9,126.3,5,.4,10.7,'mid');box('hopper.feedleft',-2.9,-2.9,126.3,.4,5.8,10.7,'mid');box('hopper.feedright',2.5,-2.9,126.3,.4,5.8,10.7,'mid');
 box('flour.trough',-12,28,107,24,25,4,'lo');box('flour.trough.side0',-14,28,107,2,25,6);box('flour.trough.side1',12,28,107,2,25,6);
 box('flour.box',-18,43,24,34,22,24,'hi');box('flour.box.inset',-15,46,48,28,16,.3,'lo');
 for(const [i,x,y] of [[0,-57,21],[1,-44,42]]){
 disc('sack.'+i,[x,y,24],[0,0,1],0,23,9,'mid');disc('sack.tie.'+i,[x,y,47],[0,0,1],0,2,6,'lo');
 }
 // Each bucket is a board carried between two open, segmented rims.
 const WF=G.frameAlong([96,0,65],[1,0,0]);
 for(const s of [-10,10]){
  for(let i=0;i<16;i++){const a=i*tau/16,b=(i+1)*tau/16;const poly=[];for(let j=0;j<=4;j++){const t=a+(b-a)*j/4;poly.push([52*Math.cos(t),52*Math.sin(t)])}for(let j=4;j>=0;j--){const t=a+(b-a)*j/4;poly.push([47*Math.cos(t),47*Math.sin(t)])}prism('wheel.rim.'+s+'.'+i,WF,poly,s,s+3,'hi')}
  for(let i=0;i<8;i++)prism('wheel.spoke.'+s+'.'+i,WF,rotated(angle+i*tau/8,[[8,-2],[47,-2],[47,2],[8,2]]),s,s+3,'mid');
  ring('wheel.hub.'+s,[96,0,65],[1,0,0],s-1,s+4,4.5,8,'hi');
 }
 for(let i=0;i<16;i++)prism('wheel.bucket.'+i,WF,rotated(angle+i*tau/16,[[37,-2],[49,-2],[49,1],[37,1]]),-7,10,'mid');
 return parts;
}
export function model(opening){const gate=Math.max(0,Math.min(1,opening));return {gate,wheel:gate*6,stone:gate*18,ratio:3}}
