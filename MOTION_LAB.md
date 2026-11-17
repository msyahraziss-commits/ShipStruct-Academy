# ShipStruct Motion Lab

Open `simulator.html`. The original dashboard links to it from the sidebar and Training tools. Structural Systems links directly to the panting example, and the Mini-games navigation links back to the lab.

## Topics

Six rigid-body motions are shown independently: rolling, pitching, yawing, heaving, swaying and surging. Combined mode provides all six amplitude controls, a component selector on the model, and four teaching presets. The live value and cycle graph follow the selected component.

Seven separate hull-effect illustrations cover panting, racking, hogging, sagging, torsion, fore-bottom slamming / pounding and transient whipping. Panting is localized to the forward side shell. Racking distorts the section rather than rotating it. Hogging and sagging preserve their respective bend direction throughout the cycle. Torsion varies the twist along the length. The illustrated slamming pulse marks downward fore-bottom contact with the visual water surface. Whipping uses a decaying oscillation after a prescribed impulse.

## Controls

- Main amplitude or effect-intensity slider directly on the model; combined mode can select any of the six components there.
- Play / pause, restart cycle, 15-degree stepping and a cycle-position slider. Scrubbing pauses playback; the 360-degree endpoint remains selectable.
- Cycle period and playback speed are separate controls. Changing period preserves the current cycle position.
- Perspective, side, end, top and bow close-up views; zoom and optional orbit / tilt controls.
- Fixed reference axes, undeformed reference hull and structural cutaway layers.
- Independently adjustable visual wave height and approach direction. The wave arrow points in the direction of travel; the heading control describes where waves approach from relative to the starting bow.
- Reset scene, clear all combined amplitudes, default mix and head-sea / beam-sea / quartering-sea teaching examples.

Rotation amplitudes are in degrees and translations use the illustrative model’s metre scale. Hull-effect intensity is dimensionless; displayed relative flex is normalized, not a calculated strain, stress or pressure.

## Model and implementation

This is an original schematic teaching renderer with prescribed motions, a generic cargo hull and magnified deformation. Wave appearance does not solve for ship motion. It is not a stability, seakeeping, structural-stress or safe-operating-limit calculation.

`motion-core.mjs` contains coordinate transforms, phase controls, hull deformation and wave geometry. `motion-data.mjs` contains explanations and lesson / source links. `motion-renderer.mjs` draws the original vessel on a 2D canvas using an orthographic 3D projection. `simulator.js` manages the accessible controls, cycle plot and playback lifecycle.

The feature has no build step, added library dependency, backend migration or credential. It does not write to browser learning-progress storage or Classroom / Course Notes data. Animation pauses while the page is hidden. The reduced-motion preference starts playback paused.

## Verification

```sh
node --check simulator.js
node --check motion-core.mjs
node --check motion-renderer.mjs
node --test motion-core.test.mjs games-core.test.mjs notes-core.test.mjs
```

The ten motion tests cover isolated axes and rigid-body shape preservation, zero-amplitude reference geometry, localized panting, non-rigid racking, hogging / sagging signs, opposite torsional twist, phase / period / pause controls, independent combined amplitudes, visual water, slamming contact, whipping decay and valid course links.

Browser checks cover all six motions, all seven hull effects, combined controls and presets, scrubbing and stepping, amplitude / period / speed changes, camera and layers, reset, and phone-width layouts. Development-only responsive harnesses are excluded from the release.

## Learning references

- NOAA, Vessel Motion and Attitude: https://repository.library.noaa.gov/view/noaa/1739/noaa_1739_DS1.pdf
- NOAA, Mariners Weather Log, December 2000, six degrees of freedom: https://www.vos.noaa.gov/MWL/dec2000.pdf
- MCA, Second Engineer Naval Architecture syllabus, ship stresses: https://www.gov.uk/government/publications/second-engineer-written-examination-syllabuses/naval-architecture-written-examination-syllabus
- IMO, From Management to Operation, section 6.8.3: https://wwwcdn.imo.org/localresources/en/OurWork/Environment/Documents/Air%20pollution/M3%20from%20management%20to%20operation%20final.pdf
- DNV, Whipping and springing analysis: https://www.dnv.com/ca/services-from-dnv/whipping-and-springing-analysis---service/
- Virginia Tech, longitudinal bending, Figure 4.14: https://publishing.vt.edu/books/63/files/9bc9a262-a20f-4022-9532-4926bb773426.pdf

Diagrams, vessel geometry, animation and teaching text in this feature are original; the links provide further reading.
