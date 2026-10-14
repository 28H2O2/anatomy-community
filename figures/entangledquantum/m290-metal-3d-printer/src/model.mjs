export const MATERIAL = { name: "IN718", rho: 8190, c: 650, k: 22, Tm: 1609, Tb: 3000, A: 0.4, Akh: 0.65, plate: 80, spot: 100, layer: 40 };

export const DEFAULTS = { P: 285, v: 960, h: 0.11 };

export const RANGES = { P: [100, 400, 5], v: [300, 2400, 10], h: [0.05, 0.2, 0.005] };

export function meltPool(P, v, h) {
  const m = MATERIAL;
  const softplus = (x) => (x > 30 ? x : Math.log1p(Math.exp(x)));
  const T0 = m.plate + 273.15;
  const speed = v / 1000;
  const sigma = (m.spot / 2) * 1e-6;
  const kappa = m.k / (m.rho * m.c);
  const dT = Math.max(60, m.Tm - T0);
  const hs = m.rho * m.c * dT;
  const enthalpy = (m.A * P) / (Math.PI * hs * Math.sqrt(kappa * speed * sigma ** 3));
  const ke = enthalpy / ((Math.PI * m.Tb) / m.Tm);
  const absorbed = m.A + (m.Akh - m.A) * (1 - Math.exp(-Math.max(0, ke - 1) / 0.8));
  const rosenthal = Math.sqrt((8 * absorbed * P) / (Math.E * Math.PI * m.rho * m.c * speed * dT));
  const width = Math.sqrt(rosenthal ** 2 + (0.6 * m.spot * 1e-6) ** 2);
  const depth = (rosenthal / 2) * (1 + 1.2 * 0.1 * softplus((ke - 1) / 0.1));
  const overlap = (h * 1e-3 / width) ** 2 + ((m.layer * 1e-6) / depth) ** 2;
  const lackOfFusion = 2.0 * 0.06 * softplus((overlap - 1) / 0.06);
  const keyhole = 0.2 * Math.max(0, (ke - 1.6) / 0.47) ** 2;
  const lineEnergy = P / v;
  const balling = Math.min(1, Math.max(0, (0.17 - lineEnergy) / 0.07)) * Math.min(1, Math.max(0, (v - 900) / 600)) * 0.5;
  const floor = 0.024;
  const porosity = lackOfFusion + keyhole + balling + floor;
  let regime = ke < 1 ? "conduction" : ke > 1.6 ? "unstable keyhole" : "stable keyhole";
  if (overlap > 1.05) regime = "lack of fusion";
  if (balling > 0.15) regime = "balling";
  return {
    ke,
    width: width * 1e6,
    depth: depth * 1e6,
    overlap,
    porosity,
    lackOfFusion: lackOfFusion + balling,
    keyhole,
    energy: P / (v * h * m.layer * 1e-3),
    rate: v * h * m.layer * 1e-3,
    regime,
  };
}
