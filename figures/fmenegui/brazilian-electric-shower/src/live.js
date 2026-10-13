function mountShower() {
const root = document.getElementById('brazil-shower')
if (!root) return
const q = s => root.querySelector(s)
const qa = s => [...root.querySelectorAll(s)]
const mode = q('#sh-mode')
const flow = q('#sh-flow')
const flowValue = q('#sh-flow-value')
const out = q('#sh-outlet')
const current = q('#sh-current')
const detail = q('#sh-detail')
const actuator = qa('[data-part="actuator"]')
const membrane = qa('[data-part="membrane"]')
const dome=qa('[data-dome] path')
const svg=q('.sh-svg')
const camera=q('[data-camera]')
const focusButtons=qa('[data-focus]')
let focus='switch'
const tap=q('#sh-tap'), replay=q('#sh-replay'), phase=q('#sh-phase')
let tapOpen=true
let widthSwitch=420, widthCircuit=250, parts={}
let lastStatus=''
let replayAt=null
const heaterA = qa('[data-part="heater-a"]')
const heaterB = qa('[data-part="heater-b"]')
const jets = qa('[data-jet]')
const tracers = qa('[data-tracer]')
const sprays = q('[data-layer="sprays"]')
const streams = q('[data-layer="flow"]')
const controller = new AbortController()
const options = {signal:controller.signal}
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
let state = showerModel(mode.value, Number(flow.value))
let motion = state.diaphragm
let startMotion=motion, elapsed=2
let visible = true
let clock = 0
let previous = 0
let frame = 0
let dead = false
const number = (n,d=1) => n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})
const descriptions = {
  off:'With the tap closed, the diaphragm relaxes and the contacts separate. The gap breaks the heater circuit.',
  cold:'Water pressure holds the contacts together. The heat selector is off, so the heater still draws no current.',
  summer:'Pressure closes the switch. A longer resistive section gives lower power at the same supply voltage.',
  winter:'Pressure closes the switch. A shorter resistive section gives higher power at the same supply voltage.'
}
function paintSwitch() {
  const c=widthSwitch*.43, u=34*motion
  if (!parts.moving) return
  parts.moving.setAttribute('transform',`translate(0 ${-u})`)
  parts.leaf.setAttribute('d',`M${c+8} ${164-u} C${c+67} ${164-u} ${c+72} 195 ${c+83} 207 L${c+83} 213 C${c+67} 201 ${c+64} ${170-u} ${c+8} ${170-u} Z`)
  parts.membrane.setAttribute('d',`M${c-90} 282 Q${c-62} 282 ${c-38} ${282-u*.55} Q${c-20} ${282-u} ${c-10} ${282-u} L${c+10} ${282-u} Q${c+20} ${282-u} ${c+38} ${282-u*.55} Q${c+62} 282 ${c+90} 282 L${c+90} 287 Q${c+62} 287 ${c+38} ${287-u*.55} Q${c+20} ${287-u} ${c+10} ${287-u} L${c-10} ${287-u} Q${c-20} ${287-u} ${c-38} ${287-u*.55} Q${c-62} 287 ${c-90} 287 Z`)
  parts.water.setAttribute('d',`M${c-90} 287 Q${c-62} 287 ${c-38} ${287-u*.55} Q${c-20} ${287-u} ${c-10} ${287-u} L${c+10} ${287-u} Q${c+20} ${287-u} ${c+38} ${287-u*.55} Q${c+62} 287 ${c+90} 287 L${c+90} 350 L${c-90} 350 Z`)
  parts.sealLabel.setAttribute('d',`M35 252 L${c-52} ${282-u*.32}`)
  parts.force.setAttribute('opacity',tapOpen?1:0)
  parts.gap.setAttribute('opacity',motion<.98?1:0)
  const mid=widthCircuit/2,right=widthCircuit-30
  parts.contact.setAttribute('d',`M${mid+16} 94 L${mid-16} ${94-20*(1-motion)}`)
  parts.selector.setAttribute('d',`M${right} 189 L${state.selectorOn?right:right-18} 157`)
  parts.wires.classList.toggle('ps-live',state.closed)
  const status=!tapOpen?'Tap closed · heater off':!state.pressureContactsClosed?'Diaphragm rising · gap closing':state.closed?'Contacts touching · heater on':'Contacts touching · cold setting'
  if(status!==lastStatus){
    lastStatus=status
    phase.textContent=status
    parts.status.textContent=tapOpen?'Pressure lifts the diaphragm':'No flow · diaphragm relaxed'
    parts.circuitState.textContent=state.pressureContactsClosed?'CLOSED':'OPEN'
    parts.selectorState.textContent=state.selectorOn?'HEAT':'COLD / OFF'
    parts.circuitStatus.textContent=state.closed?'Complete circuit · current flows':'Broken circuit · no current'
    detail.textContent=!tapOpen?descriptions.off:!state.pressureContactsClosed?'Water pushes the diaphragm upward. Its insulated stem moves the lower metal contact. Heating starts only when the contacts touch.':descriptions[state.mode]
  }
  parts.power.textContent=number(state.power,0)+' W'
  out.textContent=state.outlet===null?'No flow':number(state.outlet)+' °C'
  current.textContent=number(state.current)+' A'
}
function pointAt(route,t) {
  let len=0
  const lengths=[]
  for(let i=1;i<route.length;i++) {
    const l=Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1])
    len+=l
    lengths.push(l)
  }
  let wanted=t*len
  for(let i=0;i<lengths.length;i++) {
    if(wanted<=lengths[i] || i===lengths.length-1) {
      const f=wanted/lengths[i]
      return [route[i][0]+(route[i+1][0]-route[i][0])*f,route[i][1]+(route[i+1][1]-route[i][1])*f]
    }
    wanted-=lengths[i]
  }
  return route[0]
}
function paint() {
  state=showerModel(mode.value,Number(flow.value),tapOpen,motion)
  paintSwitch()
    const lift=motion
  actuator.forEach(el=>el.setAttribute('transform',`translate(0 ${(DATA.atRise[1]-DATA.at0[1])*lift})`))
  membrane.forEach(el=>el.classList.toggle('sh-pressed',state.running))
  const proj=([x,y,z])=>{
    const az=DATA.P.azimuth*Math.PI/180, el=DATA.P.elevation*Math.PI/180
    const k=DATA.P.scale*Math.sqrt(1.6)
    return [DATA.P.origin[0]+(x*Math.sin(az)-y*Math.cos(az))*k,DATA.P.origin[1]+((x*Math.cos(az)+y*Math.sin(az))*Math.sin(el)-z*Math.cos(el))*k]
  }
  dome.forEach((el,index)=>{
    const p=[]
    for(let j=0;j<=16;j++){
      const a=(index+j/16)*Math.PI/2
      p.push(proj([DATA.diaphragm[0]+20*Math.cos(a),DATA.diaphragm[1]+20*Math.sin(a),105]))
    }
    for(let j=16;j>=0;j--){
      const a=(index+j/16)*Math.PI/2
      p.push(proj([DATA.diaphragm[0]+7*Math.cos(a),DATA.diaphragm[1]+7*Math.sin(a),105+4*motion]))
    }
    el.setAttribute('d',p.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ')+'Z')
  })
  // The hydraulic state and electrical state are distinct in the cold setting.
  heaterA.forEach(el=>el.classList.toggle('sh-energized',state.closed))
  heaterB.forEach(el=>el.classList.toggle('sh-energized',state.closed && state.mode==='summer'))
  sprays.style.opacity=state.running?'1':'0'
  streams.style.opacity=state.running?'1':'0'
  jets.forEach((el,i)=>{
    const jet=DATA.flowData.sprays[i]
    const t=reduced.matches?.35:(clock*(.52+state.discharge*.10)+jet.phase)%1
    const e=Math.min(1,t+.048)
    const a=[jet.a[0]+(jet.b[0]-jet.a[0])*t,jet.a[1]+(jet.b[1]-jet.a[1])*t]
    const b=[jet.a[0]+(jet.b[0]-jet.a[0])*e,jet.a[1]+(jet.b[1]-jet.a[1])*e]
    el.setAttribute('d',`M${a} L${b}`)
    el.style.opacity=String(.75*(1-t))
  })
  tracers.forEach((el,i)=>{
    const t=reduced.matches?(i+.5)/tracers.length:(clock*state.discharge*.035+i/tracers.length)%1
    const p=pointAt(DATA.flowData.cold,t)
    el.setAttribute('cx',p[0])
    el.setAttribute('cy',p[1])
  })
}
function sizeCamera(){
  const pressureView=q('.sh-switch-view'), fullView=q('.sh-view')
  pressureView.hidden=focus!=='switch'
  fullView.hidden=focus==='switch'
  if(focus==='switch') {
    const mech=q('.sh-mechanism'), circ=q('.sh-circuit')
    widthSwitch=Math.max(280,mech.getBoundingClientRect().width)
    widthCircuit=Math.max(200,circ.getBoundingClientRect().width)
    mech.innerHTML=pressureSvg(widthSwitch,motion,tapOpen)
    circ.innerHTML=circuitSvg(widthCircuit,state.pressureContactsClosed,state.selectorOn)
    const refs={moving:'ps-moving',leaf:'ps-leaf',membrane:'ps-membrane',water:'ps-water',sealLabel:'ps-seal-label',force:'ps-force',gap:'ps-gap',status:'ps-status',contact:'circuit-contact',selector:'circuit-selector',wires:'circuit-wires',circuitState:'circuit-state',selectorState:'selector-state',circuitStatus:'circuit-status',power:'circuit-power'}
    for(const [key,attr] of Object.entries(refs))parts[key]=q('[data-'+attr+']')
    lastStatus=''
    paintSwitch()
  } else {
    const width=Math.max(240,fullView.getBoundingClientRect().width)
    const height=width<460?width*1.04:435
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`)
    const box=focus==='heater'?[290,185,205,125]:[205,34,330,380]
    const scale=Math.min((width-22)/box[2],(height-22)/box[3])
    const dx=(width-box[2]*scale)/2-box[0]*scale
    const dy=(height-box[3]*scale)/2-box[1]*scale
    camera.setAttribute('transform',`translate(${dx} ${dy}) scale(${scale})`)
  }
}
focusButtons.forEach(button=>button.addEventListener('click',()=>{
  focus=button.dataset.focus
  focusButtons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)))
  sizeCamera()
},options))
const sizing=new ResizeObserver(sizeCamera)
sizing.observe(root)
function tick(now) {
  frame=0
  if(dead || !root.isConnected){destroy();return}
  const dt=previous?Math.min((now-previous)/1000,1/30):1/60
  previous=now
  clock+=dt
  elapsed+=dt
  if(replayAt!==null && clock>=replayAt){replayAt=null;tapOpen=true;startMotion=motion;elapsed=0;update()}
  const t=Math.min(1,elapsed/1.15), target=tapOpen?1:0
  motion=reduced.matches?target:startMotion+(target-startMotion)*(t*t*(3-2*t))
  paint()
  if(!frame && visible && !document.hidden && !reduced.matches && (state.running || elapsed<1.15 || replayAt!==null))frame=requestAnimationFrame(tick)
}
function run() {
  if(dead)return
  if(reduced.matches){motion=tapOpen?1:0;paint();return}
  if(!frame && visible && !document.hidden){previous=0;frame=requestAnimationFrame(tick)}
}
function update() {
  state=showerModel(mode.value,Number(flow.value),tapOpen,motion)
  flowValue.textContent=number(Number(flow.value))+' L/min'
  flow.setAttribute('aria-valuetext',number(Number(flow.value))+' liters per minute')
  tap.textContent=tapOpen?'Close tap':'Open tap'
  tap.setAttribute('aria-pressed',String(tapOpen))
  lastStatus=''
  paint()
  run()
}
tap.addEventListener('click',()=>{
  replayAt=null
  tapOpen=!tapOpen
  startMotion=motion
  elapsed=0
  update()
},options)
replay.addEventListener('click',()=>{
  tapOpen=false;motion=0;startMotion=0;elapsed=2
  replayAt=reduced.matches?null:clock+.85
  if(reduced.matches)tapOpen=true
  update()
},options)
mode.addEventListener('change',update,options)
flow.addEventListener('input',update,options)
reduced.addEventListener('change',()=>{if(frame)cancelAnimationFrame(frame);frame=0;run()},options)
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0}
  else run()
},options)
const observer=new IntersectionObserver(entries=>{
  visible=entries.at(-1).isIntersecting
  if(visible)run()
  else {if(frame)cancelAnimationFrame(frame);frame=0}
},{rootMargin:'80px'})
observer.observe(root)
function destroy(){
  if(dead)return
  dead=true
  if(frame)cancelAnimationFrame(frame)
  controller.abort()
  observer.disconnect()
  sizing.disconnect()
  removal.disconnect()
}
const removal=new MutationObserver(()=>{if(!root.isConnected)destroy()})
removal.observe(document.documentElement,{childList:true,subtree:true})
window.addEventListener('pagehide',destroy,{once:true,signal:controller.signal})
sizeCamera()
update()

}
mountShower()
