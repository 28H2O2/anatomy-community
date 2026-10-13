# Brazilian electric shower

A working cutaway of the electric shower commonly used in Brazil, with an enlarged pressure switch and a linked electrical circuit. The complete isometric shower remains available under **Whole shower** and **Heating element**.

Opening the tap flexes a sealed diaphragm. An insulated stem transfers that motion to a metal contact. Only when the moving and fixed contacts touch does the pressure switch complete its part of the heater circuit. Closing the tap lets the mechanism return and opens the contacts. The **Cold** setting demonstrates that pressure contacts can be closed while the heat selector keeps heater current at zero.

## Try it

- **Open / Close tap**: compare the contact gap and the closed switch.
- **Replay opening**: watch pressure, diaphragm displacement, contact closure and current in order.
- **Heat setting** and **Water flow**: compare outlet temperature and current.
- **Whole shower / Pressure switch / Heating element**: move between the complete device and the two mechanisms.

Every caption, control, accessible description and readout is in English. Light and dark pages are built without runtime dependencies or network access. Motion pauses offscreen and holds still under reduced motion.

## Physical model and scope

The example uses 220 V, 20 °C inlet water, 5,500 W winter power and an illustrative 3,500 W summer setting. Water has density approximately 1 kg/L and specific heat 4,186 J/(kg·K). The ideal steady-state temperature rise is `power / (mass flow × specific heat)`. Current is `power / voltage`.

This is a generic teaching model, not a replica of one manufacturer's internal geometry or an installation guide. The contact gap, diaphragm stroke and time scale are enlarged. The inlet flow control assumes adequate pressure. Diaphragm mechanics are prescribed, not a fluid-structure simulation. The enlarged electrical view shows one pressure-switch pole. The three-dimensional view has simplified connections. Heat color is symbolic. Thermal transients, losses and boiling are not modeled.

## Sources

- [Lorenzetti, Maxi Ducha](https://www.lorenzetti.com.br/produto/maxi-ducha): representative Brazilian shower product.
- [Lorenzetti, shower FAQ](https://www.lorenzetti.com.br/dicas/duvidas-frequentes/duchas-e-chuveiros-eletricos): discrete power settings and shower operation.
- [BR102017014047B1](https://patents.google.com/patent/BR102017014047B1/en), background paragraphs 006–009: water-operated diaphragm and electrical contacts.
- [AU728445B2](https://patents.google.com/patent/AU728445B2/en): diaphragm, insulating actuator and moving/fixed contacts.

## Validation

The isometric kit audit passes for its recorded static pose: 141 drawn items, 100 solids, two tube routes and one sampled depth state. That result does not cover every animated pose or the separate enlarged explanatory section.

Local checks exercised the live code in a DOM implementation with a controlled animation clock: tap opening and closing, replay, current only after contact closure, cold-setting isolation, nine flow/power cases, all three views at 320/390/736-pixel widths, unique IDs, reduced motion and a single animation loop. These are logic checks with mocked layout, not browser screenshots or performance tests. Static SVG renders were visually reviewed in both themes, including open, closed and intermediate positions.

The community validator runs schema, source safety, deterministic builds, output checks and the geometry audit locally. Browser capture and line-check launchers are disabled in the ChatGPT distribution. The community's own CI is the remaining browser validation gate.

## Build

From the repository root with the matching Anatomy kit linked at `.skill`:

```sh
node figures/fmenegui/brazilian-electric-shower/src/build.mjs --light
node figures/fmenegui/brazilian-electric-shower/src/build.mjs
node figures/fmenegui/brazilian-electric-shower/src/build.mjs --audit
```

Published using Anatomy's unmodified `publish.mjs` with `--no-preview --no-session`. The authenticated GitHub connector transports the source commit and creates the pull request because the GitHub CLI is not installed in this session.

MIT license. Anatomy geometry kit copyright (c) 2026 Ryan. The original MIT notice is retained in the figure source.
