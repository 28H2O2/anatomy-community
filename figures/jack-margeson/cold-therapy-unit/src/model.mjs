// The heat balance the figure's readout, needle and caption all come from.
// bath: ice water leaving the cooler, °C. skin: limb side of the dressing, °C.
// ua: pad-to-limb conductance, W/K. heat: water, J/(g·K). fusion: ice, J/g. ice: grams loaded.
export const MODEL = { bath: 1, skin: 30, ua: 1.5, heat: 4.186, fusion: 334, ice: 2500 };

// Pump flow in mL/min: the dial's range, where the figure starts, and the idle tour's stops.
export const FLOW = { min: 30, max: 300, start: 150, stops: [150, 45, 285] };

// Full scale of the return thermometer, °C.
export const DIAL_RANGE = 20;

// flow in mL/min → mean pad temperature, return temperature, heat drawn (W) and hours of ice.
export function model(flow) {
  const grams = flow / 60;
  const beta = MODEL.ua / (2 * grams * MODEL.heat);
  const pad = (MODEL.bath + beta * MODEL.skin) / (1 + beta);
  const watts = MODEL.ua * (MODEL.skin - pad);
  const back = MODEL.bath + watts / (grams * MODEL.heat);
  return { pad, watts, back, hours: (MODEL.ice * MODEL.fusion) / watts / 3600 };
}
