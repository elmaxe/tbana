import * as THREE from 'three';

// The light underground. A station is lit by its own lamps: rows of fluorescent tubes along the
// platforms and down the middle of the halls' ceilings, and the tunnels between by a lamp on the
// wall every ten metres or so. So the platform is brightest under its row of lights, the walls and
// the vault darker the further they are from it, and the tunnels mostly dark. The sky's light
// (the scene's hemisphere and sun, see src/main.ts) is turned down underground, to the little
// that would get there.
//
// Every lamp is a strip: a straight row of tubes, or a single fitting (a short strip). Each
// surface gets the analytic irradiance of the strips near the camera (a Lambertian line light,
// clipped to the surface's horizon, as the cars' interiors are lit in
// src/rolling-stock/cabin-light.ts), a highlight from the point on the strip its reflection sees,
// and a little light bounced off whatever is round the strip. There are no shadows: a strip lights
// only the space between its floor and its top, out to its reach, so a hall's lamps don't light
// the platform under it through the floor.
//
// The builders (src/station.ts, src/network.ts, src/stations.ts) add their lamps as they build
// their pieces and take them away when they drop them; each frame the strips nearest the camera
// are handed to the shaders.

export interface Lamp {
  a: THREE.Vector3; b: THREE.Vector3; // the strip's ends
  power: number;                      // light per metre of strip
  color: THREE.Color;
  reach: number;                      // it lights nothing further away than this
  floor: number; top: number;         // the heights of the space it lights
  down: number;                       // 1: it shines down (a ceiling's lights); 0: all round
}

// Lamp colours: the platforms' and halls' white tubes, the tunnels' warmer bulbs.
export const TUBE = new THREE.Color(0xfff3e0);
export const BULB = new THREE.Color(0xffd9a0);

// The other lights (src/main.ts): the sky's (a hemisphere light) and the sun's, and the head light
// round the player, out in the open and underground, where only a little of the sky's light gets in
// and the head light is dimmer.
export const DAYLIGHT = { sky: 1.7, sun: 0.9, head: 9 };
export const UNDERGROUND = { sky: 0.25, sun: 0, head: 1.2 };
export function setDaylight(outdoor: number, sky: THREE.Light, sun: THREE.Light, head: THREE.Light) {
  sky.intensity = THREE.MathUtils.lerp(UNDERGROUND.sky, DAYLIGHT.sky, outdoor);
  sun.intensity = THREE.MathUtils.lerp(UNDERGROUND.sun, DAYLIGHT.sun, outdoor);
  head.intensity = THREE.MathUtils.lerp(UNDERGROUND.head, DAYLIGHT.head, outdoor);
}

// how far away from the camera a strip still lights what can be seen through the fog
const RANGE = 130;
// of the light that falls round a strip, how much is bounced back into the space
const FILL = 0.08;

const owners = new Map<object, Lamp[]>();

export function addLamps(owner: object, lamps: Lamp[]) {
  if (lamps.length) owners.set(owner, lamps);
}
export function removeLamps(owner: object) {
  owners.delete(owner);
}

// A row of lamps along `points` (a polyline) as strips, each as long as the row runs straight
// (within 0.25 m).
export function stripLamps(points: THREE.Vector3[], lamp: Omit<Lamp, 'a' | 'b'>, out: Lamp[] = []) {
  const off = new THREE.Vector3(), d = new THREE.Vector3();
  let i0 = 0;
  for (let i = 2; i <= points.length; i++) {
    // does the row still run straight from points[i0] to points[i]?
    let straight = i < points.length;
    if (straight) {
      const a = points[i0], b = points[i];
      d.subVectors(b, a);
      const len2 = d.lengthSq();
      for (let k = i0 + 1; k < i && straight; k++) {
        off.subVectors(points[k], a);
        const t = len2 > 0 ? THREE.MathUtils.clamp(off.dot(d) / len2, 0, 1) : 0;
        straight = off.addScaledVector(d, -t).lengthSq() < 0.25 * 0.25;
      }
    }
    if (!straight) {
      out.push({ ...lamp, a: points[i0].clone(), b: points[i - 1].clone() });
      i0 = i - 1;
    }
  }
  if (points.length === 1) out.push({ ...lamp, a: points[0].clone(), b: points[0].clone() });
  return out;
}

// ---------------------------------------------------------------- the strips near the camera
const uniforms = {
  lampFrom: { value: [] as THREE.Vector4[] },  // xyz: one end; w: reach
  lampTo: { value: [] as THREE.Vector4[] },    // xyz: the other end; w: how much it shines down
  lampLight: { value: [] as THREE.Vector4[] }, // rgb: colour × light per metre; w: unused
  lampSpace: { value: [] as THREE.Vector2[] }, // the floor and top of the space it lights
  lampCount: { value: 0 },
  lampFill: { value: FILL },
};
let slots = 0;

// Lights every standard material (every lit surface of the world but the cars' interiors, which
// have lights of their own) with the `count` strips nearest the camera; with `highlights`, their
// highlights on shiny surfaces too.
export function lightWithLamps(count: number, highlights = true) {
  slots = count;
  for (let i = 0; i < count; i++) {
    uniforms.lampFrom.value.push(new THREE.Vector4());
    uniforms.lampTo.value.push(new THREE.Vector4());
    uniforms.lampLight.value.push(new THREE.Vector4());
    uniforms.lampSpace.value.push(new THREE.Vector2());
  }
  THREE.MeshStandardMaterial.prototype.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.defines = { ...shader.defines, LAMPS: count, ...(highlights ? { LAMP_HIGHLIGHTS: '' } : {}) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>\n${FRAGMENT}`);
  };
}

const _p = new THREE.Vector3(), _d = new THREE.Vector3();
// the strips nearest the camera, nearest first, and one more
const near: Lamp[] = [], nearD: number[] = [];

// Hands the strips nearest `pos` to the shaders. The furthest of them fade out as others come
// nearer, so none of them goes out at once.
export function updateLamps(pos: THREE.Vector3) {
  if (!slots) return;
  let m = 0;
  for (const lamps of owners.values()) {
    for (const lamp of lamps) {
      const d = distanceTo(lamp, pos);
      if (d >= RANGE || (m > slots && d >= nearD[slots])) continue;
      // in among the nearest
      let k = Math.min(m, slots);
      for (; k > 0 && nearD[k - 1] > d; k--) { near[k] = near[k - 1]; nearD[k] = nearD[k - 1]; }
      near[k] = lamp; nearD[k] = d;
      if (m <= slots) m++;
    }
  }
  const n = Math.min(slots, m);
  // where the strips stop being handed on
  const cut = m > slots ? nearD[slots] : RANGE;
  for (let i = 0; i < n; i++) {
    const lamp = near[i];
    const k = lamp.power * (1 - THREE.MathUtils.smoothstep(nearD[i], cut * 0.7, cut));
    uniforms.lampFrom.value[i].set(lamp.a.x, lamp.a.y, lamp.a.z, lamp.reach);
    uniforms.lampTo.value[i].set(lamp.b.x, lamp.b.y, lamp.b.z, lamp.down);
    uniforms.lampLight.value[i].set(lamp.color.r * k, lamp.color.g * k, lamp.color.b * k, 0);
    uniforms.lampSpace.value[i].set(lamp.floor, lamp.top);
  }
  uniforms.lampCount.value = n;
}

// from p to the nearest point of the strip
function distanceTo({ a, b }: Lamp, p: THREE.Vector3) {
  _d.subVectors(b, a);
  const len2 = _d.lengthSq();
  const t = len2 > 0 ? THREE.MathUtils.clamp(_p.subVectors(p, a).dot(_d) / len2, 0, 1) : 0;
  return _p.copy(a).addScaledVector(_d, t).distanceTo(p);
}

const FRAGMENT_PARS = /* glsl */`
uniform vec4 lampFrom[ LAMPS ];
uniform vec4 lampTo[ LAMPS ];
uniform vec4 lampLight[ LAMPS ];
uniform vec2 lampSpace[ LAMPS ];
uniform int lampCount;
uniform float lampFill;
`;

// Runs in the standard material's lighting, after the scene's lights and environment. In world
// space: the view matrix's inverse is its transpose and the camera's position.
const FRAGMENT = /* glsl */`
{
	vec3 P = ( vec4( geometryPosition, 0.0 ) * viewMatrix ).xyz + cameraPosition;
	vec3 N = ( vec4( geometryNormal, 0.0 ) * viewMatrix ).xyz;
	vec3 V = ( vec4( geometryViewDir, 0.0 ) * viewMatrix ).xyz;
	vec3 R = reflect( - V, N );
	float alpha = pow2( material.roughness );
	vec3 diffuse = vec3( 0.0 ), specular = vec3( 0.0 ), fill = vec3( 0.0 );

	for ( int i = 0; i < LAMPS; i ++ ) {
		if ( i >= lampCount ) break;
		vec2 space = lampSpace[ i ];
		if ( P.y < space.x || P.y > space.y ) continue;
		vec3 L0 = lampFrom[ i ].xyz - P, L1 = lampTo[ i ].xyz - P;
		vec3 Ld = L1 - L0;
		float dd = max( dot( Ld, Ld ), 1e-4 );
		// the nearest point of the strip: nothing beyond its reach is lit, and it fades out
		// towards it
		vec3 Lc = L0 + clamp( - dot( L0, Ld ) / dd, 0.0, 1.0 ) * Ld;
		float dc = length( Lc ), reach = lampFrom[ i ].w;
		if ( dc >= reach ) continue;
		vec3 light = lampLight[ i ].rgb * pow2( saturate( 1.0 - pow4( dc / reach ) ) );
		// light leaving the strip towards the surface: a ceiling's bare tubes most of it down, the
		// rest all round
		float emit = mix( 1.0, 0.35 + 0.65 * saturate( Lc.y / max( dc, 1e-3 ) ), lampTo[ i ].w );
		// what is bounced round it reaches every surface near it, whichever way it faces
		fill += light * ( 0.5 + 0.5 * emit ) * min( sqrt( dd ), 10.0 ) / ( 2.0 + dc );

		// keep the part of the strip above the surface's horizon
		float n0 = dot( N, L0 ), n1 = dot( N, L1 );
		if ( n0 <= 0.0 && n1 <= 0.0 ) continue;
		if ( n0 < 0.0 ) { L0 = mix( L0, L1, n0 / ( n0 - n1 ) ); n0 = 0.0; }
		else if ( n1 < 0.0 ) { L1 = mix( L1, L0, n1 / ( n1 - n0 ) ); n1 = 0.0; }
		Ld = L1 - L0;
		dd = max( dot( Ld, Ld ), 1e-4 );
		float l0 = length( L0 ), l1 = length( L1 );

		// diffuse: the irradiance of a line light, ∫ cos θ / r² along it, with a little width so it
		// stays finite next to it
		float E = sqrt( dd ) * ( n0 / max( l0, 1e-4 ) + n1 / max( l1, 1e-4 ) ) / ( l0 * l1 + dot( L0, L1 ) + 0.05 );
		diffuse += light * emit * max( E, 0.0 );

		#ifdef LAMP_HIGHLIGHTS
		// specular: the point on the strip closest to the reflected ray, as a light as bright as a
		// metre of the strip, its highlight widened by the strip's width
		float RoLd = dot( R, Ld );
		vec3 Lr = L0 + clamp( ( dot( R, L0 ) * RoLd - dot( L0, Ld ) ) / max( dd - RoLd * RoLd, 1e-4 ), 0.0, 1.0 ) * Ld;
		float dr = max( length( Lr ), 0.05 );
		vec3 Ldir = Lr / dr;
		float a2 = saturate( alpha + 0.1 / dr );
		specular += light * emit * saturate( dot( N, Ldir ) ) / ( dr * dr ) * ( alpha / a2 ) * BRDF_GGX( Ldir, V, N, material );
		#endif
	}

	reflectedLight.directDiffuse += diffuse * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += specular;
	irradiance += fill * lampFill;
}
`;
