import * as k from '../../../../.skill/kit/iso-kit.mjs';
import * as G from '../../../../.skill/kit/lathe.mjs';
import * as A from '../../../../.skill/kit/audit.mjs';
import {scene} from './metric-scene.mjs';
export function auditFigure(){
const P={origin:[400,400],scale:1.1,azimuth:52,elevation:36},R=A.recorder(P);
for(const p of scene(k,G,P)){const s=p.shape,meta={name:p.name,owner:p.name.split('.')[0]};const sh=s.kind==='slab'?A.slab(s.plan,s.z,s.h,meta,2):s.kind==='disc'?A.disc(s.F,s.s0,s.s1,s.r,meta):s.kind==='ring'?A.ring(s.F,s.s0,s.s1,s.ri,s.ro,meta):A.prism(s.F,s.poly,s.s0,s.s1,meta);R.solid(sh);R.put({name:p.name,at:p.at,svg:k.solidSvg(p.paths,{inner:p.inner}),shapes:[sh]});}
A.settle(R,P,{step:1});A.auditOrExit(R,P,{argv:['--audit']});

}
