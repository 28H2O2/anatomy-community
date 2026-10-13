// An enlarged explanatory section of one pressure-operated contact pair.
// The complete shower uses the audited isometric kit geometry in build.mjs.
export function pressureSvg(width=420, stroke=1, flowing=true) {
  const c=width*.43, u=34*stroke
  const membrane=`M${c-90} 282 Q${c-62} 282 ${c-38} ${282-u*.55} Q${c-20} ${282-u} ${c-10} ${282-u} L${c+10} ${282-u} Q${c+20} ${282-u} ${c+38} ${282-u*.55} Q${c+62} 282 ${c+90} 282 L${c+90} 287 Q${c+62} 287 ${c+38} ${287-u*.55} Q${c+20} ${287-u} ${c+10} ${287-u} L${c-10} ${287-u} Q${c-20} ${287-u} ${c-38} ${287-u*.55} Q${c-62} 287 ${c-90} 287 Z`
  const water=`M${c-90} 287 Q${c-62} 287 ${c-38} ${287-u*.55} Q${c-20} ${287-u} ${c-10} ${287-u} L${c+10} ${287-u} Q${c+20} ${287-u} ${c+38} ${287-u*.55} Q${c+62} 287 ${c+90} 287 L${c+90} 350 L${c-90} 350 Z`
  const leaf=`M${c+8} ${164-u} C${c+67} ${164-u} ${c+72} 195 ${c+83} 207 L${c+83} 213 C${c+67} 201 ${c+64} ${170-u} ${c+8} ${170-u} Z`
  const screw=(x,y)=>`<circle cx="${x}" cy="${y}" r="4" class="ps-top"/><path d="M${x-2} ${y}H${x+2}" class="ps-leader"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" class="pressure-svg" viewBox="0 0 ${width} 405" role="img" aria-labelledby="ps-title ps-desc"><title id="ps-title">How water pressure closes the contacts</title><desc id="ps-desc">Water below a flexible sealed diaphragm pushes its center upward. An insulated stem transfers this movement to a metal contact. The moving contact touches the fixed contact above it. This closes the switch. With the tap closed, the diaphragm relaxes and the contacts separate.</desc>
    <text x="16" y="25" class="ps-label">The mechanical action</text><text x="16" y="45" class="ps-small">Dry contacts above · water below</text>
    <path class="ps-stem" d="M${c-91} 95 h22 v30 h-22Z M${c+76} 196 h25 v29 h-25Z"/>
    <path class="ps-top" d="M${c-91} 95 l8 -6 h22 l-8 6Z M${c+76} 196 l8 -6 h25 l-8 6Z"/>
    <path class="ps-wire" d="M${c-81} 105 V73 H${c-57}"/><circle cx="${c-57}" cy="73" r="3" class="ps-dot"/>
    <text x="${c-48}" y="77" class="ps-small">Supply</text>
    <path class="ps-wire" d="M${c+90} 217 v34 h14"/><circle cx="${c+104}" cy="251" r="3" class="ps-dot"/>
    <text x="${c+55}" y="269" class="ps-small">To heater</text>
    <path class="ps-metal" d="M${c-81} 106 H${c+11} V114 H${c-81}Z"/><path class="ps-top" d="M${c-81} 106 l8 -6 h92 l-8 6Z"/>
    <rect class="ps-pad" x="${c-9}" y="114" width="18" height="6" rx="2"/>
    ${screw(c-71,109)}
    <text x="${c+36}" y="94" class="ps-label">Fixed contact</text><path class="ps-leader" d="M${c+29} 97 L${c+9} 117"/>
    <g data-ps-moving="" transform="translate(0 ${-u})">
      <rect class="ps-stem" x="${c-6}" y="168" width="12" height="114" rx="2"/>
      <path class="ps-top" d="M${c+6} 168 l5 -5 v114 l-5 5Z"/>
      <rect class="ps-pad" x="${c-9}" y="154" width="18" height="6" rx="2"/>
      <path class="ps-metal" d="M${c-15} 160 h32 v8 h-32Z"/>
      <rect class="ps-top" x="${c-12}" y="276" width="24" height="6" rx="2"/>
      <text x="${c+36}" y="158" class="ps-label">Moving contact</text><path class="ps-leader" d="M${c+29} 155 H${c+9}"/>
    </g>
    <path data-ps-leaf="" class="ps-metal" d="${leaf}"/>
    ${screw(c+88,207)}
    <path class="ps-stem" d="M${c-12} 215 h5 v13 h-5Z M${c+7} 215 h5 v13 h-5Z"/>
    <text x="16" y="189" class="ps-label">Insulated stem</text><path class="ps-leader" d="M108 193 L${c-6} 204"/>
    <text x="16" y="229" class="ps-label">Diaphragm</text><text x="16" y="245" class="ps-small">Flexible seal</text>
    <path data-ps-seal-label="" class="ps-leader" d="M35 252 L${c-52} ${282-u*.32}"/>
    <path data-ps-water="" class="ps-water" d="${water}"/>
    <path class="ps-metal" d="M${c-100} 281 h10 v69 h180 v-69 h10 v79 h-200Z"/>
    <path class="ps-top" d="M${c-100} 281 l8 -6 h10 l-8 6Z M${c+90} 281 l8 -6 h10 l-8 6Z"/>
    <path data-ps-membrane="" class="ps-rubber" d="${membrane}"/>
    <rect class="ps-metal" x="${c-101}" y="277" width="20" height="14" rx="2"/><rect class="ps-metal" x="${c+81}" y="277" width="20" height="14" rx="2"/>
    ${screw(c-91,284)}${screw(c+91,284)}
    <g data-ps-force="" opacity="${flowing?1:0}">${[-44,0,44].map(dx=>`<path class="ps-force" d="M${c+dx} 315 v-21 m-4 4 l4 -4 l4 4"/>`).join('')}</g>
    <text x="${c}" y="337" text-anchor="middle" class="ps-label">Water chamber</text>
    <text x="${c}" y="385" text-anchor="middle" class="ps-label" data-ps-status="">${flowing?'Pressure lifts the diaphragm':'No flow · diaphragm relaxed'}</text>
    <g data-ps-gap="" opacity="${stroke<1?1:0}"><path class="ps-leader" d="M${c-31} 120 h-5 v${34-u} h5"/><text x="${c-43}" y="141" text-anchor="end" class="ps-small">Gap</text></g>
  </svg>`
}

export function circuitSvg(width=250, contacts=true, selector=true) {
  const right=width-30, mid=width/2, energized=contacts&&selector
  const live=energized?' ps-live':''
  return `<svg xmlns="http://www.w3.org/2000/svg" class="circuit-svg" viewBox="0 0 ${width} 405" role="img" aria-labelledby="pc-title pc-desc"><title id="pc-title">The electrical consequence</title><desc id="pc-desc">The AC supply, pressure contacts, heat selector and heater form one loop. Heater current requires both the pressure switch and heat selector to be closed.</desc>
    <text x="16" y="25" class="ps-label">The electrical consequence</text>
    <text x="${mid}" y="62" text-anchor="middle" class="ps-small">Pressure contacts</text>
    <g data-circuit-wires="" class="ps-wire${live}">
      <path d="M28 155 V94 H${mid-16} M${mid+16} 94 H${right} V157 M${right} 189 V257 M${right} 303 V336 H28 V199"/>
      <path data-circuit-contact="" d="M${mid+16} 94 L${mid-16} ${contacts?94:74}"/>
      <path data-circuit-selector="" d="M${right} 189 L${selector?right:right-18} 157"/>
      <rect x="${right-8}" y="257" width="16" height="46"/>
      <circle cx="28" cy="177" r="22"/>
    </g>
    <circle cx="${mid-16}" cy="94" r="3" class="ps-dot"/><circle cx="${mid+16}" cy="94" r="3" class="ps-dot"/>
    <circle cx="${right}" cy="157" r="3" class="ps-dot"/><circle cx="${right}" cy="189" r="3" class="ps-dot"/>
    <text x="${mid}" y="116" text-anchor="middle" class="ps-label" data-circuit-state="">${contacts?'CLOSED':'OPEN'}</text>
    <text x="28" y="182" text-anchor="middle">AC</text><text x="28" y="220" text-anchor="middle" class="ps-small">220 V</text>
    <text x="${right-30}" y="170" text-anchor="end" class="ps-small">Heat selector</text><text x="${right-30}" y="188" text-anchor="end" class="ps-label" data-selector-state="">${selector?'HEAT':'COLD / OFF'}</text>
    <text x="54" y="273" class="ps-small">Heating element</text><text x="54" y="294" class="ps-label" data-circuit-power="">${energized?'5,500 W':'0 W'}</text>
    <text x="${mid}" y="372" text-anchor="middle" class="ps-label" data-circuit-status="">${energized?'Complete circuit · current flows':'Broken circuit · no current'}</text>
  </svg>`
}
