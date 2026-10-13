export const SPEC = Object.freeze({ voltage:220, inlet:20, cp:4186, summer:3500, winter:5500 })
// Position is an explanatory normalized stroke, not a calibrated pressure model.
export function showerModel(mode='winter', flow=4, tapOpen=true, stroke=1) {
  if (!['cold','summer','winter'].includes(mode)) throw new Error('Unknown heat setting')
  if (!Number.isFinite(flow) || flow<3 || flow>8) throw new Error('Flow outside 3–8 L/min')
  const pressureContactsClosed = tapOpen && stroke >= 1
  const selectorOn = mode !== 'cold'
  const power = pressureContactsClosed && selectorOn ? SPEC[mode] : 0
  const discharge = tapOpen ? flow : 0
  const delta = discharge ? power / (discharge/60*SPEC.cp) : 0
  return { mode, running:tapOpen, discharge, power, diaphragm:tapOpen?1:0,
    pressureContactsClosed, selectorOn, closed:power>0, current:power/SPEC.voltage,
    resistance:power?SPEC.voltage**2/power:null, inlet:SPEC.inlet,
    outlet:tapOpen?SPEC.inlet+delta:null, delta }
}
