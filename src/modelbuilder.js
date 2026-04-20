// ═══════════════════════════════════════════════════════════════
// JARVIS 3D — Model Builder v2
// Assembles complete 3D models with hierarchical clickable parts
// Each mesh has userData for raycasting + drill-down
// ═══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // ─── Part node structure ───
    // {
    //   id, name, desc, group,
    //   build: () => THREE.BufferGeometry,
    //   pos: [x,y,z], rot: [x,y,z], scale: N,
    //   children: [ { same structure } ]
    // }

    // ═══════════════════════════════════════════════════════════
    // PROJECT DEFINITIONS — Complete hierarchical models
    // ═══════════════════════════════════════════════════════════

    const PROJECT_MODELS = {};

    // ════════ FALCON ROCKET ════════
    PROJECT_MODELS['proj-falcon'] = {
        parts: [
            {
                id: 'nose', name: 'Nose Cone', desc: 'Aerodynamic fairing protecting payload during ascent. Houses telemetry antennas.', group: 'Payload Section',
                build: () => JarvisGeometries.builders['nose'](),
                pos: [0, 4.2, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'nose-tip', name: 'Telemetry Antenna', desc: 'S-band omnidirectional antenna for flight data downlink.', build: () => new THREE.CylinderGeometry(0.01, 0.01, 0.15, 6), pos: [0, 0.7, 0], color: 0xaaaaaa },
                    { id: 'nose-fairing', name: 'Fairing Shell', desc: 'Aluminum-lithium alloy, 2 halves separated by pneumatic pushers.', build: () => new THREE.SphereGeometry(0.32, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.4), pos: [0, 0.2, 0], color: 0xcccccc },
                ]
            },
            {
                id: 'payload', name: 'Payload Bay', desc: 'Houses satellite or crew capsule. 15-ton capacity to LEO.', group: 'Payload Section',
                build: () => JarvisGeometries.builders['payload'](),
                pos: [0, 3.3, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'payload-paf', name: 'Payload Adapter', desc: 'Standard 1666mm interface ring. Clamp band separation system.', build: () => new THREE.TorusGeometry(0.3, 0.02, 8, 24), pos: [0, -0.4, 0], color: 0x666666 },
                    { id: 'payload-deploy', name: 'Deployment Mechanism', desc: 'Spring-loaded pusher plate for satellite release.', build: () => new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12), pos: [0, 0, 0], color: 0x888888 },
                ]
            },
            {
                id: 'second-stage', name: 'Second Stage', desc: 'Vacuum-optimized Merlin engine. 934kN thrust in vacuum.', group: 'Upper Stage',
                build: () => JarvisGeometries.builders['second-stage'](),
                pos: [0, 2.3, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: '2nd-engine', name: 'Merlin Vacuum', desc: 'Single MVac engine. Regeneratively cooled. Expansion ratio 165:1.', build: () => new THREE.CylinderGeometry(0.12, 0.06, 0.4, 16), pos: [0, -0.7, 0], color: 0xff6600 },
                    { id: '2nd-avionics', name: 'Flight Computer', desc: 'Triple-redundant flight computer. Radiation-hardened.', build: () => new THREE.BoxGeometry(0.1, 0.06, 0.1), pos: [0.2, 0, 0], color: 0x222222 },
                    { id: '2nd-helium', name: 'Helium Bottles', desc: 'Composite overwrapped pressure vessels for tank pressurization.', build: () => new THREE.SphereGeometry(0.06, 8, 8), pos: [0.25, -0.3, 0], color: 0xcccccc },
                ]
            },
            {
                id: 'interstage', name: 'Interstage', desc: 'Carbon fiber structure connecting stages. Contains separation system.', group: 'Upper Stage',
                build: () => JarvisGeometries.builders['interstage'](),
                pos: [0, 1.5, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'sep-bolts', name: 'Separation Bolts', desc: '12 frangible bolts. Pyrotechnic separation in <100ms.', build: () => new THREE.CylinderGeometry(0.012, 0.012, 0.04, 6), pos: [0.39, 0, 0], color: 0x999999 },
                ]
            },
            {
                id: 'first-stage', name: 'First Stage', desc: '9 Merlin engines, 7,607kN thrust at sea level. Lands vertically.', group: 'Booster',
                build: () => JarvisGeometries.builders['first-stage'](),
                pos: [0, -0.3, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'octaweb', name: 'Octaweb', desc: 'Aluminum structure holding 9 Merlin engines in octagonal pattern.', build: () => new THREE.CylinderGeometry(0.35, 0.35, 0.1, 8), pos: [0, -1.0, 0], color: 0x444444 },
                    { id: 'avionics-1st', name: 'Avionics Bay', desc: 'Flight computers, IMU, GPS receivers. Located on interstage.', build: () => new THREE.BoxGeometry(0.15, 0.1, 0.15), pos: [0.3, 0.5, 0], color: 0x111111 },
                    { id: 'cold-gas', name: 'Cold Gas Thrusters', desc: 'Nitrogen thrusters for roll control and attitude.', build: () => new THREE.CylinderGeometry(0.015, 0.01, 0.06, 6), pos: [0.42, 0.3, 0], color: 0x888888 },
                ]
            },
            {
                id: 'legs', name: 'Landing Legs', desc: '4 carbon fiber legs deploy before touchdown. Withstand 2m/s impact.', group: 'Booster',
                build: () => JarvisGeometries.builders['legs'](),
                pos: [0, -1.5, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'leg-hydraulic', name: 'Hydraulic Actuator', desc: 'Deploys legs in <2 seconds. Dampens landing shock.', build: () => new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), pos: [0.2, -0.3, 0], color: 0x888888 },
                    { id: 'leg-foot', name: 'Foot Pad', desc: 'Titanium pad. 3m diameter. Level-sensing radar.', build: () => new THREE.CylinderGeometry(0.1, 0.12, 0.03, 12), pos: [0.4, -0.7, 0], color: 0x666666 },
                ]
            },
            {
                id: 'grid-fins', name: 'Grid Fins', desc: 'Titanium aerodynamic control surfaces for precision landing.', group: 'Booster',
                build: () => JarvisGeometries.builders['grid-fins'](),
                pos: [0, 0.3, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'fin-actuator', name: 'Fin Actuator', desc: 'Electrically driven. Full deflection in 200ms.', build: () => new THREE.BoxGeometry(0.04, 0.06, 0.04), pos: [0, -0.05, 0], color: 0x444444 },
                ]
            },
            {
                id: 'engine-bell', name: 'Engine Bells', desc: '9 Merlin 1D engines with gimbal capability ±5°.', group: 'Propulsion',
                build: () => JarvisGeometries.builders['engine-bell'](),
                pos: [0, -1.3, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'turbopump', name: 'Turbopump', desc: 'Single-shaft design. 30,000 RPM. 100:1 oxidizer ratio.', build: () => new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8), pos: [0.12, 0.1, 0], color: 0x555555 },
                    { id: 'injector', name: 'Injector Head', desc: 'Pintle injector. 80:1 mixture ratio. Spark ignition.', build: () => new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), pos: [0, 0.22, 0], color: 0x444444 },
                ]
            },
            {
                id: 'fuel-tanks', name: 'Fuel Tanks', desc: 'RP-1 kerosene + LOX. 410,000 kg propellant capacity.', group: 'Propulsion',
                build: () => JarvisGeometries.builders['fuel-tanks'](),
                pos: [0, -0.3, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'lox-tank', name: 'LOX Tank', desc: 'Liquid oxygen. Subcooled to -207°C for density.', build: () => new THREE.CylinderGeometry(0.38, 0.38, 0.8, 16), pos: [0, 0.3, 0], color: 0x4488ff },
                    { id: 'rp1-tank', name: 'RP-1 Tank', desc: 'Kerosene fuel. Located below LOX tank.', build: () => new THREE.CylinderGeometry(0.38, 0.42, 0.9, 16), pos: [0, -0.4, 0], color: 0xaa6600 },
                    { id: 'common-dome', name: 'Common Dome', desc: 'Shared bulkhead between LOX and RP-1 tanks. Saves mass.', build: () => new THREE.SphereGeometry(0.38, 16, 8, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.5), pos: [0, -0.05, 0], color: 0x888888 },
                ]
            },
        ]
    };

    // ════════ SPORTS CAR ════════
    PROJECT_MODELS['proj-car'] = {
        parts: [
            {
                id: 'body', name: 'Carbon Body', desc: 'Full carbon fiber monocoque. 1,200kg total weight.', group: 'Body',
                build: () => JarvisGeometries.builders['body'](),
                pos: [0, 0.5, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'monocoque', name: 'Monocoque Tub', desc: 'Carbon fiber safety cell. FIA crash tested.', build: () => new THREE.BoxGeometry(0.8, 0.3, 0.6), pos: [0, 0, 0], color: 0x222222 },
                    { id: 'roof', name: 'Carbon Roof', desc: 'Removable targa panel. Integrated roll hoop.', build: () => new THREE.BoxGeometry(0.5, 0.02, 0.5), pos: [-0.1, 0.35, 0], color: 0xff0044 },
                    { id: 'rear-deck', name: 'Rear Deck', desc: 'Engine cover with ventilation louvers.', build: () => new THREE.BoxGeometry(0.5, 0.04, 0.5), pos: [-0.5, 0.25, 0], color: 0xcc0033 },
                ]
            },
            {
                id: 'hood', name: 'Active Hood', desc: 'Deployable air intake. Active cooling for battery.', group: 'Body',
                build: () => JarvisGeometries.builders['hood'](),
                pos: [0.6, 0.55, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'frunk', name: 'Front Trunk', desc: '150L storage. Electric latch release.', build: () => new THREE.BoxGeometry(0.4, 0.15, 0.45), pos: [0, -0.08, 0], color: 0x111111 },
                    { id: 'hood-latch', name: 'Hood Latch', desc: 'Electromagnetic release. Crash-safe pyrotechnic backup.', build: () => new THREE.BoxGeometry(0.04, 0.03, 0.04), pos: [0, 0, 0.2], color: 0x666666 },
                ]
            },
            {
                id: 'spoiler', name: 'Active Spoiler', desc: 'Hydraulic wing. 0-70° adjustment. 800kg downforce.', group: 'Aero',
                build: () => JarvisGeometries.builders['spoiler'](),
                pos: [-0.9, 0.75, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'spoiler-hydraulic', name: 'Hydraulic Actuator', desc: 'Adjusts angle in 300ms based on speed and G-forces.', build: () => new THREE.CylinderGeometry(0.01, 0.01, 0.12, 6), pos: [0, -0.02, 0], color: 0x888888 },
                    { id: 'drs-motor', name: 'DRS Motor', desc: 'Direct reduction system for low-drag straights.', build: () => new THREE.CylinderGeometry(0.015, 0.015, 0.04, 8), pos: [0, 0, 0.08], color: 0x444444 },
                ]
            },
            {
                id: 'diffuser', name: 'Rear Diffuser', desc: 'Venturi tunnel design. Ground effect generation.', group: 'Aero',
                build: () => JarvisGeometries.builders['diffuser'](),
                pos: [-1.0, 0.2, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'diffuser-tunnel', name: 'Venturi Tunnels', desc: '3 tunnels accelerating air underneath. 400kg downforce.', build: () => new THREE.BoxGeometry(0.5, 0.08, 0.3), pos: [0, 0, 0], color: 0x222222 },
                ]
            },
            {
                id: 'wheel-fl', name: 'Front Left Wheel', desc: '20" forged magnesium. Michelin Pilot Sport Cup 2.', group: 'Wheels',
                build: () => JarvisGeometries.builders['wheel-fl'](),
                pos: [0.65, 0.2, 0.45], rot: [Math.PI / 2, 0, 0], scale: 1,
                children: [
                    { id: 'fl-brake', name: 'Carbon Ceramic Brake', desc: '410mm carbon ceramic disc. 6-piston caliper.', build: () => new THREE.CylinderGeometry(0.09, 0.09, 0.02, 20), pos: [0, 0, 0], color: 0x666666 },
                    { id: 'fl-suspension', name: 'Double Wishbone', desc: 'Pushrod-activated inboard damper. Adjustable ride height.', build: () => new THREE.BoxGeometry(0.04, 0.2, 0.03), pos: [0, -0.15, 0.1], color: 0x444444 },
                    { id: 'fl-abs', name: 'ABS Sensor', desc: 'Wheel speed sensor for traction control.', build: () => new THREE.CylinderGeometry(0.01, 0.01, 0.02, 6), pos: [0.05, 0, 0], color: 0x222222 },
                ]
            },
            {
                id: 'wheel-fr', name: 'Front Right Wheel', desc: '20" forged magnesium. Carbon ceramic brakes.', group: 'Wheels',
                build: () => JarvisGeometries.builders['wheel-fr'](),
                pos: [0.65, 0.2, -0.45], rot: [Math.PI / 2, 0, 0], scale: 1,
                children: [
                    { id: 'fr-brake', name: 'Carbon Ceramic Brake', desc: '410mm disc. 6-piston caliper. 380° operating temp.', build: () => new THREE.CylinderGeometry(0.09, 0.09, 0.02, 20), pos: [0, 0, 0], color: 0x666666 },
                    { id: 'fr-suspension', name: 'Double Wishbone', desc: 'Pushrod-activated. Active damping.', build: () => new THREE.BoxGeometry(0.04, 0.2, 0.03), pos: [0, -0.15, -0.1], color: 0x444444 },
                ]
            },
            {
                id: 'wheel-rl', name: 'Rear Left Wheel', desc: '21" forged magnesium. Carbon ceramic brakes.', group: 'Wheels',
                build: () => JarvisGeometries.builders['wheel-rl'](),
                pos: [-0.7, 0.2, 0.48], rot: [Math.PI / 2, 0, 0], scale: 1,
                children: [
                    { id: 'rl-brake', name: 'Carbon Ceramic Brake', desc: '390mm disc. 4-piston caliper rear.', build: () => new THREE.CylinderGeometry(0.085, 0.085, 0.02, 20), pos: [0, 0, 0], color: 0x666666 },
                    { id: 'rl-suspension', name: 'Multi-link Rear', desc: '5-link suspension. Active toe adjustment.', build: () => new THREE.BoxGeometry(0.04, 0.18, 0.03), pos: [0, -0.15, 0.1], color: 0x444444 },
                ]
            },
            {
                id: 'wheel-rr', name: 'Rear Right Wheel', desc: '21" forged magnesium. Carbon ceramic brakes.', group: 'Wheels',
                build: () => JarvisGeometries.builders['wheel-rr'](),
                pos: [-0.7, 0.2, -0.48], rot: [Math.PI / 2, 0, 0], scale: 1,
                children: [
                    { id: 'rr-brake', name: 'Carbon Ceramic Brake', desc: '390mm disc. 4-piston caliper.', build: () => new THREE.CylinderGeometry(0.085, 0.085, 0.02, 20), pos: [0, 0, 0], color: 0x666666 },
                ]
            },
            {
                id: 'motor-f', name: 'Front Motor', desc: 'Permanent magnet. 350kW. Independent torque vectoring.', group: 'Drivetrain',
                build: () => JarvisGeometries.builders['motor-f'](),
                pos: [0.6, 0.25, 0], rot: [0, 0, Math.PI / 2], scale: 1,
                children: [
                    { id: 'f-inverter', name: 'Front Inverter', desc: 'SiC MOSFET. 800V. 98.5% efficiency.', build: () => new THREE.BoxGeometry(0.1, 0.08, 0.08), pos: [0.15, 0, 0], color: 0x00aaff },
                    { id: 'f-gearbox', name: 'Front Gearbox', desc: 'Single-speed reduction. 9.5:1 ratio.', build: () => new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12), pos: [-0.15, 0, 0], color: 0x555555 },
                ]
            },
            {
                id: 'motor-r', name: 'Rear Motors', desc: '2x 500kW motors. 1,000kW combined. Direct drive.', group: 'Drivetrain',
                build: () => JarvisGeometries.builders['motor-r'](),
                pos: [-0.7, 0.25, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'r-inverter-l', name: 'Left Inverter', desc: 'SiC inverter. 800V architecture. Water cooled.', build: () => new THREE.BoxGeometry(0.1, 0.08, 0.06), pos: [0, 0, 0.15], color: 0x00aaff },
                    { id: 'r-inverter-r', name: 'Right Inverter', desc: 'Independent torque control per wheel.', build: () => new THREE.BoxGeometry(0.1, 0.08, 0.06), pos: [0, 0, -0.15], color: 0x00aaff },
                ]
            },
            {
                id: 'battery-car', name: 'Battery Pack', desc: '100kWh solid-state. 800V architecture. 10min to 80%.', group: 'Drivetrain',
                build: () => JarvisGeometries.builders['battery-car'](),
                pos: [0, 0.15, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'bms', name: 'BMS Controller', desc: 'Battery management system. Cell-level monitoring.', build: () => new THREE.BoxGeometry(0.1, 0.04, 0.08), pos: [0.4, 0.08, 0], color: 0x00aa00 },
                    { id: 'cooling-plate', name: 'Cooling Plate', desc: 'Liquid cooling channels. Maintains 25-35°C.', build: () => new THREE.BoxGeometry(0.9, 0.01, 0.5), pos: [0, -0.08, 0], color: 0x0044aa },
                    { id: 'hv-contactors', name: 'HV Contactors', desc: 'Main fuse + contactors. 800V isolation.', build: () => new THREE.BoxGeometry(0.06, 0.04, 0.06), pos: [-0.4, 0.08, 0], color: 0xff8800 },
                ]
            },
        ]
    };

    // ════════ QUAD DRONE ════════
    PROJECT_MODELS['proj-drone'] = {
        parts: [
            {
                id: 'frame', name: 'Main Frame', desc: 'Carbon fiber X-frame, 450mm wheelbase.', group: 'Structure',
                build: () => JarvisGeometries.builders['frame'](),
                pos: [0, 0, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'bottom-plate', name: 'Bottom Plate', desc: 'Protects electronics. Battery mount.', build: () => new THREE.BoxGeometry(0.8, 0.02, 0.8), pos: [0, -0.04, 0], color: 0x1a1a1a },
                    { id: 'standoffs', name: 'Standoffs', desc: '4x aluminum spacers connecting top/bottom plates.', build: () => new THREE.CylinderGeometry(0.01, 0.01, 0.06, 6), pos: [0.15, -0.01, 0.15], color: 0x666666 },
                ]
            },
            {
                id: 'top-plate', name: 'Top Plate', desc: 'Mounts flight controller and GPS module.', group: 'Structure',
                build: () => JarvisGeometries.builders['top-plate'](),
                pos: [0, 0.05, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'fpv-antenna', name: 'FPV Antenna', desc: 'Circular polarized. LHCP. 5.8GHz.', build: () => new THREE.CylinderGeometry(0.008, 0.003, 0.1, 6), pos: [0, 0.06, 0], color: 0x00aaff },
                ]
            },
            { id: 'arm-fl', name: 'Front Left Arm', desc: 'Carbon tube. Houses motor wires and LED strip.', group: 'Arms', build: () => JarvisGeometries.builders['arm-fl'](), pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'arm-fr', name: 'Front Right Arm', desc: 'Carbon tube. Motor mount at tip.', group: 'Arms', build: () => JarvisGeometries.builders['arm-fr'](), pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'arm-bl', name: 'Back Left Arm', desc: 'Carbon tube. CW motor rotation.', group: 'Arms', build: () => JarvisGeometries.builders['arm-bl'](), pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'arm-br', name: 'Back Right Arm', desc: 'Carbon tube. CCW motor rotation.', group: 'Arms', build: () => JarvisGeometries.builders['arm-br'](), pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, children: [] },
            {
                id: 'motor', name: 'Brushless Motors', desc: '4x 2300KV motors. 5045 props. 1.2kg thrust each.', group: 'Propulsion',
                build: () => JarvisGeometries.builders['motor'](),
                pos: [0.5, 0.06, 0.5], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'motor-bearings', name: 'Bearings', desc: 'Japanese NSK bearings. Shielded. 500hr lifespan.', build: () => new THREE.TorusGeometry(0.02, 0.005, 6, 12), pos: [0, 0, 0], color: 0x888888 },
                    { id: 'motor-magnets', name: 'Magnets', desc: 'N52 neodymium. 14 poles. Arc magnets.', build: () => new THREE.CylinderGeometry(0.05, 0.05, 0.02, 14), pos: [0, 0.02, 0], color: 0x444444 },
                ]
            },
            { id: 'prop', name: 'Propellers', desc: '5-inch tri-blade props. Self-tightening.', group: 'Propulsion', build: () => JarvisGeometries.builders['prop'](), pos: [0.5, 0.12, 0.5], rot: [0, 0, 0], scale: 1, children: [
                { id: 'prop-hub', name: 'Prop Hub', desc: 'Self-tightening nut. CW/CCW threads.', build: () => new THREE.CylinderGeometry(0.02, 0.02, 0.015, 8), pos: [0, 0, 0], color: 0x555555 },
            ] },
            {
                id: 'battery', name: 'LiPo Battery', desc: '4S 1500mAh 100C. ~8 min flight time.', group: 'Power',
                build: () => JarvisGeometries.builders['battery'](),
                pos: [0, -0.06, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'balance-lead', name: 'Balance Lead', desc: '5-pin balance connector for cell-level charging.', build: () => new THREE.BoxGeometry(0.02, 0.01, 0.03), pos: [0.18, 0, 0.05], color: 0xffffff },
                ]
            },
            {
                id: 'fc', name: 'Flight Controller', desc: 'F7 processor running Betaflight. Gyro + accelerometer.', group: 'Avionics',
                build: () => JarvisGeometries.builders['fc'](),
                pos: [0, 0.04, 0], rot: [0, 0, 0], scale: 1,
                children: [
                    { id: 'fc-gyro', name: 'BMI270 Gyro', desc: '6-axis IMU. 3.2kHz sampling. Low noise.', build: () => new THREE.BoxGeometry(0.015, 0.005, 0.015), pos: [0.04, 0.018, 0.03], color: 0x222222 },
                    { id: 'fc-baro', name: 'Barometer', desc: 'DPS310. Altitude hold precision ±0.01m.', build: () => new THREE.BoxGeometry(0.01, 0.005, 0.01), pos: [-0.03, 0.018, -0.03], color: 0x333333 },
                ]
            },
            { id: 'gps', name: 'GPS Module', desc: 'u-blox M10. Dual constellation. 10Hz update rate.', group: 'Avionics', build: () => JarvisGeometries.builders['gps'](), pos: [0, 0.07, 0], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'camera', name: 'FPV Camera', desc: '1200TVL CMOS camera. 150° FOV. Low latency.', group: 'Avionics', build: () => JarvisGeometries.builders['camera'](), pos: [0.4, 0.02, 0], rot: [0, 0.3, 0], scale: 1, children: [
                { id: 'cam-lens', name: 'Lens Element', desc: '1.8mm wide-angle. M12 mount.', build: () => new THREE.CylinderGeometry(0.015, 0.012, 0.02, 8), pos: [0, 0.02, 0], color: 0x334455 },
            ] },
        ]
    };

    // ════════ MECH SUIT ════════
    PROJECT_MODELS['proj-robot'] = {
        parts: [
            { id: 'helmet', name: 'Helmet Assembly', desc: 'AR visor with HUD. 270° camera array.', group: 'Head', build: () => JarvisGeometries.builders['helmet'](), pos: [0, 2.2, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'hud', name: 'AR Display', desc: 'Waveguide optics. 4K per eye. 120° FOV.', build: () => new THREE.PlaneGeometry(0.2, 0.1), pos: [0, 0, 0.2], color: 0x00ff88 },
                { id: 'comms', name: 'Comms Array', desc: 'Encrypted satellite uplink. Multi-band.', build: () => new THREE.BoxGeometry(0.06, 0.04, 0.04), pos: [0, 0.3, -0.1], color: 0x333333 },
            ] },
            { id: 'torso', name: 'Torso Frame', desc: 'Titanium-alloy spine. Houses reactor and life support.', group: 'Core', build: () => JarvisGeometries.builders['torso'](), pos: [0, 1.2, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'life-support', name: 'Life Support', desc: 'O₂ supply, CO₂ scrubber, cooling loop. 4hr capacity.', build: () => new THREE.BoxGeometry(0.2, 0.2, 0.15), pos: [0, -0.2, -0.2], color: 0x335533 },
                { id: 'spine-actuator', name: 'Spine Actuator', desc: 'Hydraulic spine. 500kg load capacity.', build: () => new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8), pos: [0, 0, -0.28], color: 0x666666 },
            ] },
            { id: 'reactor', name: 'Arc Reactor', desc: 'Compact fusion reactor. 8GW output. Palladium core.', group: 'Core', build: () => JarvisGeometries.builders['reactor'](), pos: [0, 1.3, 0.28], rot: [0, 0, 0], scale: 1, children: [
                { id: 'reactor-core', name: 'Palladium Core', desc: 'Synthetic palladium. Sustained fusion reaction.', build: () => new THREE.SphereGeometry(0.04, 12, 12), pos: [0, 0, 0], color: 0x00ddff },
                { id: 'reactor-coil', name: 'Magnetic Coils', desc: 'Superconducting coils containing plasma.', build: () => new THREE.TorusGeometry(0.1, 0.015, 8, 16), pos: [0, 0, 0], color: 0xffaa00 },
            ] },
            { id: 'l-arm', name: 'Left Arm', desc: 'Hydraulic actuators. 2-ton lift capacity.', group: 'Limbs', build: () => JarvisGeometries.builders['l-arm'](), pos: [0, 1.5, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'l-shoulder', name: 'Shoulder Joint', desc: '3-axis gimbal. 360° rotation. 5,000Nm torque.', build: () => new THREE.SphereGeometry(0.12, 12, 12), pos: [-0.5, 0, 0], color: 0x444444 },
                { id: 'l-hydraulic', name: 'Hydraulic Pump', desc: 'Variable displacement. 280 bar operating pressure.', build: () => new THREE.CylinderGeometry(0.04, 0.04, 0.15, 8), pos: [-0.55, -0.4, 0], color: 0x666666 },
            ] },
            { id: 'r-arm', name: 'Right Arm', desc: 'Weapon hardpoint. Integrated repulsor emitter.', group: 'Limbs', build: () => JarvisGeometries.builders['r-arm'](), pos: [0, 1.5, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'repulsor', name: 'Repulsor Emitter', desc: 'Directed energy weapon. Concussive blast.', build: () => new THREE.CircleGeometry(0.04, 16), pos: [0.5, -1.05, 0.04], color: 0x00ddff },
            ] },
            { id: 'l-hand', name: 'Left Hand', desc: '5-finger manipulator. Haptic feedback.', group: 'Limbs', build: () => JarvisGeometries.builders['l-hand'](), pos: [0, 0.45, 0], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'r-hand', name: 'Right Hand', desc: 'Repulsor palm emitter. Concussive blast capable.', group: 'Limbs', build: () => JarvisGeometries.builders['r-hand'](), pos: [0, 0.45, 0], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'l-leg', name: 'Left Leg', desc: 'Knee + ankle hydraulics. 30mph sprint.', group: 'Legs', build: () => JarvisGeometries.builders['l-leg'](), pos: [0, 0.3, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'l-knee', name: 'Knee Actuator', desc: 'Hydraulic knee joint. 10,000Nm torque.', build: () => new THREE.SphereGeometry(0.09, 12, 12), pos: [-0.2, -0.65, 0], color: 0x444444 },
            ] },
            { id: 'r-leg', name: 'Right Leg', desc: 'Knee + ankle hydraulics. Shock absorbers.', group: 'Legs', build: () => JarvisGeometries.builders['r-leg'](), pos: [0, 0.3, 0], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'thruster-l', name: 'Left Thruster', desc: 'Sub-orbital flight capable. Max Mach 3.', group: 'Flight', build: () => JarvisGeometries.builders['thruster-l'](), pos: [-0.4, 0.8, -0.3], rot: [0, 0, 0.3], scale: 1, children: [] },
            { id: 'thruster-r', name: 'Right Thruster', desc: 'Sub-orbital flight. Gimbal-mounted.', group: 'Flight', build: () => JarvisGeometries.builders['thruster-r'](), pos: [0.4, 0.8, -0.3], rot: [0, 0, -0.3], scale: 1, children: [] },
            { id: 'boot-jet', name: 'Boot Jets', desc: 'VTOL thrust vectoring. Landing stabilization.', group: 'Flight', build: () => JarvisGeometries.builders['boot-jet'](), pos: [0, -0.1, 0], rot: [0, 0, 0], scale: 1, children: [] },
        ]
    };

    // ════════ SATELLITE ════════
    PROJECT_MODELS['proj-sat'] = {
        parts: [
            { id: 'bus', name: 'Satellite Bus', desc: 'Main structural body. Houses all subsystems.', group: 'Structure', build: () => JarvisGeometries.builders['bus'](), pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'bus-frame', name: 'Aluminum Frame', desc: '6061-T6 aluminum. Honeycomb panels.', build: () => new THREE.BoxGeometry(0.75, 0.55, 0.75), pos: [0, 0, 0], color: 0xbbbbbb },
            ] },
            { id: 'antenna-dish', name: 'Main Antenna', desc: '2.4m reflector dish. Ku-band. 10Gbps throughput.', group: 'Comms', build: () => JarvisGeometries.builders['antenna-dish'](), pos: [0, 0.8, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'dish-subreflector', name: 'Subreflector', desc: 'Cassegrain subreflector. Focuses signal to feed.', build: () => new THREE.ConeGeometry(0.06, 0.08, 8), pos: [0, -0.35, 0], color: 0xdddddd },
            ] },
            { id: 'antenna-horn', name: 'Feed Horn', desc: 'Low-noise amplifier. Signal processing unit.', group: 'Comms', build: () => JarvisGeometries.builders['antenna-horn'](), pos: [0, 0.5, 0], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'solar-l', name: 'Left Solar Array', desc: 'GaAs triple-junction cells. 15kW output.', group: 'Power', build: () => JarvisGeometries.builders['solar-l'](), pos: [-1.2, 0, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'solar-l-drive', name: 'Array Drive', desc: 'Stepper motor. Sun-tracking ±180°.', build: () => new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), pos: [0.7, 0, 0], color: 0x666666 },
            ] },
            { id: 'solar-r', name: 'Right Solar Array', desc: 'GaAs triple-junction cells. 15kW output.', group: 'Power', build: () => JarvisGeometries.builders['solar-r'](), pos: [1.2, 0, 0], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'battery-pak', name: 'Battery Pack', desc: 'Li-ion. 100kWh capacity. 15-year lifespan.', group: 'Power', build: () => JarvisGeometries.builders['battery-pak'](), pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'radiator', name: 'Thermal Radiator', desc: 'Heat pipe system. Maintains -10 to +40°C.', group: 'Thermal', build: () => JarvisGeometries.builders['radiator'](), pos: [0, -0.4, 0], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'thruster-cluster', name: 'Ion Thrusters', desc: '4x Hall-effect thrusters. Station-keeping.', group: 'Propulsion', build: () => JarvisGeometries.builders['thruster-cluster'](), pos: [0, 0, -0.5], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'fuel-tank-sat', name: 'Xenon Tank', desc: '150kg xenon propellant. 15-year station-keeping.', group: 'Propulsion', build: () => JarvisGeometries.builders['fuel-tank-sat'](), pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, children: [] },
        ]
    };

    // ════════ SUBMARINE ════════
    PROJECT_MODELS['proj-sub'] = {
        parts: [
            { id: 'hull', name: 'Pressure Hull', desc: 'Titanium alloy. Rated to 11,000m depth.', group: 'Hull', build: () => JarvisGeometries.builders['hull'](), pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'hull-ring-1', name: 'Hull Section A', desc: 'Forward section. Houses sonar and torpedo room.', build: () => new THREE.CylinderGeometry(0.45, 0.45, 0.8, 16), pos: [0.8, 0, 0], rot: [0, 0, Math.PI / 2], color: 0x445566 },
                { id: 'hull-ring-2', name: 'Hull Section B', desc: 'Mid section. Control room and crew quarters.', build: () => new THREE.CylinderGeometry(0.48, 0.48, 0.8, 16), pos: [0, 0, 0], rot: [0, 0, Math.PI / 2], color: 0x445566 },
                { id: 'hull-ring-3', name: 'Hull Section C', desc: 'Aft section. Engine room and reactor.', build: () => new THREE.CylinderGeometry(0.45, 0.45, 0.8, 16), pos: [-0.8, 0, 0], rot: [0, 0, Math.PI / 2], color: 0x445566 },
            ] },
            { id: 'tower', name: 'Conning Tower', desc: 'Houses periscopes, masts, and antennas.', group: 'Hull', build: () => JarvisGeometries.builders['tower'](), pos: [0.2, 0.55, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'sail-rails', name: 'Sail Rails', desc: 'Guide rails for fairwater planes.', build: () => new THREE.BoxGeometry(0.02, 0.5, 0.02), pos: [0.25, 0, 0.18], color: 0x444444 },
            ] },
            { id: 'ballast-f', name: 'Forward Ballast', desc: 'Compressed air blow system. 2000L capacity.', group: 'Buoyancy', build: () => JarvisGeometries.builders['ballast-f'](), pos: [1.0, -0.3, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'blow-valve', name: 'Blow Valve', desc: 'High-pressure air valve. Emergency blow capable.', build: () => new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), pos: [0.2, 0.3, 0], color: 0xff4444 },
            ] },
            { id: 'ballast-a', name: 'Aft Ballast', desc: 'Trim tanks for fine depth control.', group: 'Buoyancy', build: () => JarvisGeometries.builders['ballast-a'](), pos: [-1.0, -0.3, 0], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'prop-sub', name: 'Propulsor', desc: 'Pump-jet. Quieter than propeller. 5MW.', group: 'Propulsion', build: () => JarvisGeometries.builders['prop-sub'](), pos: [-1.6, 0, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'prop-motor', name: 'Electric Motor', desc: 'Permanent magnet motor. 5MW. Direct drive.', build: () => new THREE.CylinderGeometry(0.15, 0.15, 0.3, 12), pos: [0.3, 0, 0], rot: [0, 0, Math.PI / 2], color: 0x555555 },
            ] },
            { id: 'thruster-sub', name: 'Maneuvering Thrusters', desc: '6x tunnel thrusters for precise positioning.', group: 'Propulsion', build: () => JarvisGeometries.builders['thruster-sub'](), pos: [0.5, 0, 0.5], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'sonar', name: 'Sonar Array', desc: 'Spherical bow array. Active/passive. 100km range.', group: 'Sensors', build: () => JarvisGeometries.builders['sonar'](), pos: [1.5, 0, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'sonar-processor', name: 'Signal Processor', desc: 'Beam-forming DSP. 256 channels.', build: () => new THREE.BoxGeometry(0.1, 0.08, 0.1), pos: [0, -0.3, 0], color: 0x008866 },
            ] },
            { id: 'camera-sub', name: 'External Cameras', desc: '4K cameras with LED arrays. 360° coverage.', group: 'Sensors', build: () => JarvisGeometries.builders['camera-sub'](), pos: [0.6, 0.45, 0.2], rot: [0, 0, 0], scale: 1, children: [] },
        ]
    };

    // ════════ SPACE STATION ════════
    PROJECT_MODELS['proj-station'] = {
        parts: [
            { id: 'core', name: 'Core Module', desc: 'Central hub. Life support, navigation, crew quarters.', group: 'Core', build: () => JarvisGeometries.builders['core'](), pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'core-life', name: 'Life Support', desc: 'O₂ generation, CO₂ removal, water recycling. 93% efficient.', build: () => new THREE.BoxGeometry(0.2, 0.3, 0.2), pos: [0, 0, 0], color: 0x335533 },
                { id: 'core-nav', name: 'Navigation Computer', desc: 'Star tracker + IMU. Autonomous orbit maintenance.', build: () => new THREE.BoxGeometry(0.15, 0.1, 0.1), pos: [0.2, 0.3, 0], color: 0x111111 },
            ] },
            { id: 'lab', name: 'Science Lab', desc: 'Microgravity research. 20 experiment racks.', group: 'Modules', build: () => JarvisGeometries.builders['lab'](), pos: [0, 0, 1.2], rot: [0, 0, 0], scale: 1, children: [
                { id: 'lab-glovebox', name: 'Glovebox', desc: 'Sealed containment for hazardous experiments.', build: () => new THREE.BoxGeometry(0.15, 0.2, 0.1), pos: [0, 0, 0], color: 0xcccccc },
            ] },
            { id: 'node', name: 'Docking Node', desc: '6 docking ports. International spacecraft compatible.', group: 'Modules', build: () => JarvisGeometries.builders['node'](), pos: [0, 0, -1.0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'node-hatch', name: 'Pressure Hatch', desc: 'Circular hatch. 80cm diameter. Triple seal.', build: () => new THREE.CircleGeometry(0.12, 16), pos: [0, 0.22, 0], color: 0x888888 },
            ] },
            { id: 'arm', name: 'Robotic Arm', desc: '17m Canadarm3. 116-ton payload manipulation.', group: 'Systems', build: () => JarvisGeometries.builders['arm'](), pos: [0.5, 0.3, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'arm-latching', name: 'Latching End Effector', desc: 'Grapple fixture for payload capture.', build: () => new THREE.BoxGeometry(0.06, 0.06, 0.04), pos: [1.85, 0, 0], color: 0xaaaaaa },
            ] },
            { id: 'solar-station', name: 'Solar Wings', desc: '8 arrays. 240kW total. Sun-tracking.', group: 'Power', build: () => JarvisGeometries.builders['solar-station'](), pos: [2.0, 0, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'solar-sarj', name: 'Solar Alpha Joint', desc: 'Rotary joint. 360° rotation for sun tracking.', build: () => new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12), pos: [-1.0, 0, 0], color: 0x888888 },
            ] },
            { id: 'radiator-station', name: 'Radiator Panels', desc: 'Ammonia loop heat rejection. 70kW capacity.', group: 'Thermal', build: () => JarvisGeometries.builders['radiator-station'](), pos: [-0.6, -0.5, 0], rot: [0.3, 0, 0], scale: 1, children: [
                { id: 'radiator-pump', name: 'Ammonia Pump', desc: 'Circulates coolant through heat rejection system.', build: () => new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), pos: [0.45, 0, 0], color: 0x666666 },
            ] },
        ]
    };

    // ════════ BATTLE TANK ════════
    PROJECT_MODELS['proj-tank'] = {
        parts: [
            { id: 'turret', name: 'Turret', desc: 'Unmanned turret. 120mm smoothbore autoloader.', group: 'Firepower', build: () => JarvisGeometries.builders['turret'](), pos: [0, 0.55, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'autoloader', name: 'Autoloader', desc: 'Carousel type. 22 rounds ready. 10 rpm.', build: () => new THREE.CylinderGeometry(0.25, 0.25, 0.15, 12), pos: [0, -0.1, 0], color: 0x444444 },
                { id: 'turret-sight', name: 'Gunner Sight', desc: 'Thermal + day channel. 4x-12x zoom. Laser rangefinder.', build: () => new THREE.BoxGeometry(0.04, 0.04, 0.06), pos: [0.15, 0.22, 0.2], color: 0x111111 },
            ] },
            { id: 'barrel', name: 'Gun Barrel', desc: 'L/55 smoothbore. 1,750 m/s muzzle velocity.', group: 'Firepower', build: () => JarvisGeometries.builders['barrel'](), pos: [0.75, 0.55, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'bore-evac', name: 'Bore Evacuator', desc: 'Compressed air system. Clears propellant gases.', build: () => new THREE.CylinderGeometry(0.055, 0.055, 0.12, 12), pos: [-0.3, 0, 0], color: 0x445533 },
            ] },
            { id: 'hull-tank', name: 'Hull', desc: 'Composite armor. ERA tiles. STANAG Level 6.', group: 'Protection', build: () => JarvisGeometries.builders['hull-tank'](), pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'driver-station', name: 'Driver Station', desc: '3 periscopes. Joystick steering. Display panel.', build: () => new THREE.BoxGeometry(0.3, 0.2, 0.3), pos: [0.5, 0.25, 0], color: 0x334433 },
            ] },
            { id: 'reactive', name: 'Reactive Armor', desc: 'Explosive reactive tiles. Defeats HEAT and APFSDS.', group: 'Protection', build: () => JarvisGeometries.builders['reactive'](), pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'track-l', name: 'Left Track', desc: 'Rubber-padded. Hydrostatic drive. 70km/h road.', group: 'Mobility', build: () => JarvisGeometries.builders['track-l'](), pos: [0, -0.15, 0.55], rot: [0, 0, 0], scale: 1, children: [
                { id: 'track-tensioner', name: 'Track Tensioner', desc: 'Hydraulic adjuster. Maintains optimal tension.', build: () => new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), pos: [-0.6, 0, 0], color: 0x666666 },
            ] },
            { id: 'track-r', name: 'Right Track', desc: 'Independent drive. Pivot steering capable.', group: 'Mobility', build: () => JarvisGeometries.builders['track-r'](), pos: [0, -0.15, -0.55], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'engine-tank', name: 'Turbine Engine', desc: '1,500hp gas turbine. Multi-fuel capable.', group: 'Mobility', build: () => JarvisGeometries.builders['engine-tank'](), pos: [-0.5, 0.15, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'engine-trans', name: 'Transmission', desc: 'Hydrokinetic. 4 forward, 2 reverse gears.', build: () => new THREE.BoxGeometry(0.2, 0.15, 0.2), pos: [0.25, 0, 0], color: 0x555555 },
                { id: 'engine-air-filter', name: 'Air Filter', desc: 'Cyclonic pre-filter + HEPA. Desert rated.', build: () => new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8), pos: [0, 0.2, 0], color: 0x888888 },
            ] },
        ]
    };

    // ════════ STEALTH JET ════════
    PROJECT_MODELS['proj-plane'] = {
        parts: [
            { id: 'fuselage', name: 'Fuselage', desc: 'Radar-absorbing composite. Internal weapons bay.', group: 'Airframe', build: () => JarvisGeometries.builders['fuselage'](), pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'weapons-bay', name: 'Weapons Bay', desc: 'Internal bay. 4x AMRAAM or 2x JDAM capacity.', build: () => new THREE.BoxGeometry(0.8, 0.15, 0.25), pos: [0, -0.2, 0], color: 0x222233 },
                { id: 'fuel-fwd', name: 'Forward Fuel Cell', desc: 'Self-sealing. 2,000L capacity.', build: () => new THREE.BoxGeometry(0.4, 0.15, 0.2), pos: [0.6, 0, 0], color: 0x444455 },
            ] },
            { id: 'wing-l', name: 'Left Wing', desc: 'Blended wing-body. All-moving control surfaces.', group: 'Airframe', build: () => JarvisGeometries.builders['wing-l'](), pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'l-aileron', name: 'Left Aileron', desc: 'All-moving. Fly-by-wire. Differential control.', build: () => new THREE.BoxGeometry(0.4, 0.01, 0.25), pos: [-1.2, 0, -0.35], color: 0x555566 },
            ] },
            { id: 'wing-r', name: 'Right Wing', desc: 'Blended wing-body. Missile hardpoints internal.', group: 'Airframe', build: () => JarvisGeometries.builders['wing-r'](), pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'tail-v', name: 'Vertical Stabilizers', desc: 'Canted twin tails. Reduced radar cross-section.', group: 'Airframe', build: () => JarvisGeometries.builders['tail-v'](), pos: [-1.3, 0, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'tail-rudder', name: 'Ruddervators', desc: 'Combined rudder + elevator. 3-axis control.', build: () => new THREE.BoxGeometry(0.01, 0.3, 0.08), pos: [-0.02, 0.4, 0], color: 0x333344 },
            ] },
            { id: 'intake', name: 'Engine Intakes', desc: 'S-duct intakes hide compressor face from radar.', group: 'Propulsion', build: () => JarvisGeometries.builders['intake'](), pos: [0.3, -0.15, 0.2], rot: [0, 0, 0], scale: 1, children: [
                { id: 'intake-dsi', name: 'DSI Bump', desc: 'Diverterless supersonic inlet. Boundary layer removal.', build: () => new THREE.SphereGeometry(0.06, 8, 6), pos: [-0.35, 0.05, 0], color: 0x333344 },
            ] },
            { id: 'engine-jet', name: 'Turbofan Engines', desc: '2x afterburning turbofans. Supercruise Mach 1.8.', group: 'Propulsion', build: () => JarvisGeometries.builders['engine-jet'](), pos: [-0.4, -0.1, 0.15], rot: [0, 0, 0], scale: 1, children: [
                { id: 'jet-fadec', name: 'FADEC', desc: 'Full authority digital engine control.', build: () => new THREE.BoxGeometry(0.04, 0.03, 0.03), pos: [0.15, 0.1, 0], color: 0x222222 },
            ] },
            { id: 'nozzle', name: 'Thrust Vectoring', desc: '3D vectoring nozzles. ±20° pitch and yaw.', group: 'Propulsion', build: () => JarvisGeometries.builders['nozzle'](), pos: [-1.2, -0.1, 0.15], rot: [0, 0, 0], scale: 1, children: [] },
            { id: 'radar', name: 'AESA Radar', desc: 'Active electronically scanned array. 400km detection.', group: 'Avionics', build: () => JarvisGeometries.builders['radar'](), pos: [1.2, 0, 0], rot: [0, 0, Math.PI / 2], scale: 1, children: [
                { id: 'radar-proc', name: 'Signal Processor', desc: 'GaAs MMIC modules. 1,500 T/R elements.', build: () => new THREE.BoxGeometry(0.25, 0.06, 0.2), pos: [-0.03, -0.04, 0], color: 0x111111 },
            ] },
            { id: 'cockpit', name: 'Cockpit', desc: 'Helmet-mounted display. Voice control. Voice AI.', group: 'Avionics', build: () => JarvisGeometries.builders['cockpit'](), pos: [0.8, 0.25, 0], rot: [0, 0, 0], scale: 1, children: [
                { id: 'cockpit-mdi', name: 'MFD Displays', desc: '2x 8" multi-function displays. Touch + HOTAS.', build: () => new THREE.BoxGeometry(0.08, 0.06, 0.01), pos: [0, -0.05, 0.12], color: 0x004488 },
                { id: 'cockpit-hmcs', name: 'Helmet Mounted Cueing', desc: 'JHMCS II. Targets by looking.', build: () => new THREE.SphereGeometry(0.08, 8, 8), pos: [0, 0.05, -0.02], color: 0x333333 },
            ] },
        ]
    };

    // ═══════════════════════════════════════════════════════════
    // BUILD ASSEMBLED MODEL
    // ═══════════════════════════════════════════════════════════

    /**
     * Builds a complete 3D model with all parts positioned and tagged.
     * Every mesh has userData for raycasting.
     * Returns { group, flatParts } where flatParts is a list of all clickable meshes.
     */
    function buildAssembledModel(projectId) {
        const rootGroup = new THREE.Group();
        const flatParts = []; // All clickable meshes for raycasting
        const modelDef = PROJECT_MODELS[projectId];
        if (!modelDef) return { group: rootGroup, flatParts };

        function buildPartNode(node, parentGroup, depth) {
            if (!node.build) return;

            const geo = node.build();
            const color = node.color || 0x00d4ff;
            const mat = node.children && node.children.length > 0
                ? new THREE.MeshStandardMaterial({
                    color, metalness: 0.7, roughness: 0.3,
                    emissive: color, emissiveIntensity: 0.05,
                    transparent: true, opacity: 0.92,
                })
                : new THREE.MeshStandardMaterial({
                    color, metalness: 0.85, roughness: 0.25,
                    emissive: color, emissiveIntensity: 0.05,
                });

            const meshObj = new THREE.Mesh(geo, mat);

            // Position
            if (node.pos) meshObj.position.set(node.pos[0], node.pos[1], node.pos[2]);
            if (node.rot) meshObj.rotation.set(node.rot[0], node.rot[1], node.rot[2]);
            if (node.scale) meshObj.scale.setScalar(node.scale);

            // Tag for raycasting
            meshObj.userData = {
                partId: node.id,
                partName: node.name,
                partDesc: node.desc || '',
                partGroup: node.group || '',
                hasChildren: !!(node.children && node.children.length),
                depth: depth,
                childCount: node.children ? node.children.length : 0,
                originalColor: color,
            };

            parentGroup.add(meshObj);
            flatParts.push(meshObj);

            // Build children
            if (node.children && node.children.length) {
                node.children.forEach(child => {
                    buildPartNode(child, meshObj, depth + 1);
                });
            }
        }

        modelDef.parts.forEach(partDef => {
            buildPartNode(partDef, rootGroup, 0);
        });

        // Center and scale the model
        const box = new THREE.Box3().setFromObject(rootGroup);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
            const s = 4 / maxDim;
            rootGroup.scale.setScalar(s);
            const newBox = new THREE.Box3().setFromObject(rootGroup);
            const center = newBox.getCenter(new THREE.Vector3());
            rootGroup.position.sub(center);
        }

        return { group: rootGroup, flatParts };
    }

    /**
     * Get the part definition tree for a project (for side panel navigation)
     */
    function getPartTree(projectId) {
        const modelDef = PROJECT_MODELS[projectId];
        if (!modelDef) return [];
        return modelDef.parts;
    }

    // Export
    window.JarvisModelBuilder = {
        buildAssembledModel,
        getPartTree,
        PROJECT_MODELS,
    };
})();
