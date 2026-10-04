import * as THREE from 'three';

// Lighting for the passenger interiors. The cars are lit by their own ceiling lights, modelled as
// strips running the length of the saloon: each surface gets the analytic irradiance of every
// strip (a Lambertian line light, clipped to the surface's horizon), a highlight from the point on
// the strip its reflection sees (Karis' representative point), and a soft fill for the light
// bouncing round the car. Seats and fittings shade what is under and behind them: a height map of
// the car seen from above is marched from each surface towards each strip. Outside light (sun, sky,
// reflections of the environment) only gets in through the windows and doors, so it is turned
// down on surfaces inside the car.
//
// Everything is in car coordinates (+x forward, +y up from the rail, +z right), the space the
// interior geometry is built in, so cars made from one template share their materials.

// A pair of light strips at ±z, height y, running along the saloon. `facing` is the direction the
// strip on the +z side shines in, as [y, z] (the one on −z is mirrored). `power` is the light per
// metre of strip.
export interface LightStrip { y: number; z: number; facing: [number, number]; power: number }
export interface CabinLights {
  strips: LightStrip[];
  color: THREE.ColorRepresentation;
  // light bounced round the car (irradiance), reaching every surface
  fill: number;
}

// How much outside light gets into the cars, shared by every train. `direct`: the sun and other
// direct lights (fine where they cast shadows, so the sun only comes in through the windows; set
// it to 0 for lights that don't); `ambient`: sky and environment light; `reflections`: the
// environment seen in shiny surfaces.
const outside = new THREE.Vector3(1, 0.08, 0.25);
export function setOutsideLight({ direct = outside.x, ambient = outside.y, reflections = outside.z }: { direct?: number; ambient?: number; reflections?: number }) {
  outside.set(direct, ambient, reflections);
}

// The height of the highest surface above each point of the floor between y0 and y1, from x0 to x1
// and z = −w to w, as a texture. Triangles wholly above y1 (ceiling, overhead rails) are left out,
// and vertical faces don't show from above. The meshes must be in car coordinates.
export interface CabinShadows { texture: THREE.DataTexture; x0: number; x1: number; w: number; y0: number; y1: number }

export function cabinShadows(meshes: THREE.Mesh[], { x0, x1, w, y0, y1, cell = 0.03 }: { x0: number; x1: number; w: number; y0: number; y1: number; cell?: number }): CabinShadows {
  const nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((2 * w) / cell);
  const top = new Float32Array(nx * nz).fill(-Infinity);
  const u = [0, 0, 0], v = [0, 0, 0], y = [0, 0, 0];
  for (const m of meshes) {
    const pos = m.geometry.getAttribute('position'), index = m.geometry.index;
    const count = index ? index.count : pos.count;
    for (let i = 0; i + 2 < count; i += 3) {
      for (let k = 0; k < 3; k++) {
        const j = index ? index.getX(i + k) : i + k;
        u[k] = (pos.getX(j) - x0) / cell - 0.5;
        v[k] = (pos.getZ(j) + w) / cell - 0.5;
        y[k] = pos.getY(j);
      }
      if (Math.min(y[0], y[1], y[2]) > y1) continue;
      const area = (u[1] - u[0]) * (v[2] - v[0]) - (u[2] - u[0]) * (v[1] - v[0]);
      if (Math.abs(area) < 1e-6) continue;
      const c0 = Math.max(0, Math.ceil(Math.min(u[0], u[1], u[2]))), c1 = Math.min(nx - 1, Math.floor(Math.max(u[0], u[1], u[2])));
      const r0 = Math.max(0, Math.ceil(Math.min(v[0], v[1], v[2]))), r1 = Math.min(nz - 1, Math.floor(Math.max(v[0], v[1], v[2])));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          // barycentric weights of the cell centre
          const b1 = ((c - u[0]) * (v[2] - v[0]) - (u[2] - u[0]) * (r - v[0])) / area;
          const b2 = ((u[1] - u[0]) * (r - v[0]) - (c - u[0]) * (v[1] - v[0])) / area;
          const b0 = 1 - b1 - b2;
          if (b0 < -1e-4 || b1 < -1e-4 || b2 < -1e-4) continue;
          const h = Math.min(y1, b0 * y[0] + b1 * y[1] + b2 * y[2]);
          const at = r * nx + c;
          if (h > top[at]) top[at] = h;
        }
      }
    }
  }
  const data = new Uint8Array(nx * nz);
  for (let i = 0; i < data.length; i++) data[i] = Math.round(THREE.MathUtils.clamp((top[i] - y0) / (y1 - y0), 0, 1) * 255);
  const texture = new THREE.DataTexture(data, nx, nz, THREE.RedFormat, THREE.UnsignedByteType);
  texture.unpackAlignment = 1;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, x0, x1, w, y0, y1 };
}

// Lights interior materials (changing them in place) with strips running from xa to xb, shaded
// by `shadows`. With `door`, only faces looking into the car are lit (door leaves are painted
// inside and out).
export function lightCabin(materials: Iterable<THREE.Material>, lights: CabinLights,
  { xa, xb, shadows, door = false }: { xa: number; xb: number; shadows: CabinShadows; door?: boolean }) {
  const n = lights.strips.length * 2;
  const from: THREE.Vector3[] = [], to: THREE.Vector3[] = [], facing: THREE.Vector4[] = [];
  for (const s of lights.strips) {
    const len = Math.hypot(...s.facing);
    for (const side of [1, -1]) {
      from.push(new THREE.Vector3(xa, s.y, side * s.z));
      to.push(new THREE.Vector3(xb, s.y, side * s.z));
      facing.push(new THREE.Vector4(0, s.facing[0] / len, (side * s.facing[1]) / len, s.power));
    }
  }
  const sh = shadows;
  const uniforms = {
    cabinFrom: { value: from },
    cabinTo: { value: to },
    cabinFacing: { value: facing },
    cabinColor: { value: new THREE.Color(lights.color) },
    cabinFill: { value: lights.fill },
    cabinOutside: { value: outside },
    cabinHeight: { value: sh.texture },
    cabinHeightBox: { value: new THREE.Vector4(sh.x0, -sh.w, 1 / (sh.x1 - sh.x0), 1 / (2 * sh.w)) },
    cabinHeightRange: { value: new THREE.Vector2(sh.y0, sh.y1 - sh.y0) },
  };
  for (const m of materials) {
    if (!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.defines = { ...shader.defines, CABIN_STRIPS: n, ...(door ? { CABIN_DOOR: '' } : {}) };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
        .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
        .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>\n${FRAGMENT}`);
    };
    m.customProgramCacheKey = () => `cabin${n}${door ? 'd' : ''}`;
    m.needsUpdate = true;
  }
}

const VERTEX_PARS = /* glsl */`
varying vec3 vCabinPos;
#ifdef CABIN_DOOR
varying float vCabinInside;
#endif
`;

const VERTEX = /* glsl */`
vCabinPos = transformed;
#ifdef CABIN_DOOR
// door leaves: the inside face looks towards the car's centre line
vCabinInside = step( transformed.z * objectNormal.z, 0.0 );
#endif
`;

const FRAGMENT_PARS = /* glsl */`
uniform mat4 modelViewMatrix;
uniform vec3 cabinFrom[ CABIN_STRIPS ];
uniform vec3 cabinTo[ CABIN_STRIPS ];
uniform vec4 cabinFacing[ CABIN_STRIPS ];
uniform vec3 cabinColor;
uniform float cabinFill;
uniform vec3 cabinOutside;
uniform sampler2D cabinHeight;
uniform vec4 cabinHeightBox;
uniform vec2 cabinHeightRange;
varying vec3 vCabinPos;
#ifdef CABIN_DOOR
varying float vCabinInside;
#endif

// light leaving a strip towards direction d (from the strip): mostly out of its face, some sideways
float cabinEmit( vec3 facing, vec3 d ) {
	return saturate( 0.15 + 0.85 * dot( facing, d ) );
}

// the top of whatever stands at (x, z), or below the floor where nothing does
float cabinTop( vec2 xz ) {
	vec2 uv = ( xz - cabinHeightBox.xy ) * cabinHeightBox.zw;
	if ( uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ) return - 1.0;
	return cabinHeightRange.x + texture2D( cabinHeight, uv ).r * cabinHeightRange.y;
}

// How much of the light from a strip at height ys, z = zs gets to p past the seats and fittings:
// steps up the ray towards the strip and checks whether it passes under something.
float cabinLit( vec3 p, float ys, float zs ) {
	float lit = 1.0, rise = max( ys - p.y, 0.1 );
	for ( int k = 0; k < 4; k ++ ) {
		float dh = k == 0 ? 0.05 : k == 1 ? 0.2 : k == 2 ? 0.45 : 0.85;
		float h = p.y + dh;
		float top = cabinTop( vec2( p.x, p.z + ( zs - p.z ) * dh / rise ) );
		lit = min( lit, 1.0 - smoothstep( h - 0.03, h + 0.03, top ) );
	}
	return lit;
}
`;

// Runs in the standard material's lighting, after the scene's lights and environment.
const FRAGMENT = /* glsl */`
{
	float inside = 1.0;
	#ifdef CABIN_DOOR
	inside = vCabinInside;
	#endif
	// how open the space above is: less light bounces in under the seats
	float open = inside > 0.5 ? 0.45 + 0.55 * cabinLit( vCabinPos, vCabinPos.y + 1.0, vCabinPos.z ) : 1.0;
	vec3 keep = mix( vec3( 1.0 ), cabinOutside * vec3( 1.0, open, open ), inside );
	reflectedLight.directDiffuse *= keep.x;
	reflectedLight.directSpecular *= keep.x;
	irradiance *= keep.y;
	iblIrradiance *= keep.y;
	radiance *= keep.z;

	if ( inside > 0.5 ) {
		vec3 P = geometryPosition, N = geometryNormal, V = geometryViewDir;
		vec3 R = reflect( - V, N );
		mat3 toView = mat3( modelViewMatrix );
		float alpha = pow2( material.roughness );
		vec3 diffuse = vec3( 0.0 ), specular = vec3( 0.0 );

		for ( int i = 0; i < CABIN_STRIPS; i ++ ) {
			vec3 L0 = ( modelViewMatrix * vec4( cabinFrom[ i ], 1.0 ) ).xyz - P;
			vec3 L1 = ( modelViewMatrix * vec4( cabinTo[ i ], 1.0 ) ).xyz - P;
			vec3 facing = normalize( toView * cabinFacing[ i ].xyz );
			float power = cabinFacing[ i ].w;

			// keep the part of the strip above the surface's horizon
			float n0 = dot( N, L0 ), n1 = dot( N, L1 );
			if ( n0 <= 0.0 && n1 <= 0.0 ) continue;
			if ( n0 < 0.0 ) { L0 = mix( L0, L1, n0 / ( n0 - n1 ) ); n0 = 0.0; }
			else if ( n1 < 0.0 ) { L1 = mix( L1, L0, n1 / ( n1 - n0 ) ); n1 = 0.0; }
			vec3 Ld = L1 - L0;
			float l0 = length( L0 ), l1 = length( L1 ), dd = max( dot( Ld, Ld ), 1e-6 );
			float lit = power * cabinLit( vCabinPos, cabinFrom[ i ].y, cabinFrom[ i ].z );

			// diffuse: the irradiance of a line light, ∫ cos θ / r² along it, with the strip's own
			// spread taken at its closest point and a little width so it stays finite next to it
			vec3 Lc = L0 + clamp( - dot( L0, Ld ) / dd, 0.0, 1.0 ) * Ld;
			float E = sqrt( dd ) * ( n0 / max( l0, 1e-4 ) + n1 / max( l1, 1e-4 ) ) / ( l0 * l1 + dot( L0, L1 ) + 0.02 );
			diffuse += lit * cabinEmit( facing, - normalize( Lc ) ) * max( E, 0.0 );

			// specular: the point on the strip closest to the reflected ray, as a small sphere light
			float RoLd = dot( R, Ld );
			vec3 Lr = L0 + clamp( ( dot( R, L0 ) * RoLd - dot( L0, Ld ) ) / max( dd - RoLd * RoLd, 1e-6 ), 0.0, 1.0 ) * Ld;
			float dr = max( length( Lr ), 0.05 );
			vec3 Ldir = Lr / dr;
			float a2 = saturate( alpha + 0.06 / dr );
			float NoL = saturate( dot( N, Ldir ) );
			specular += lit * cabinEmit( facing, - Ldir ) * 0.12 / ( dr * dr ) * NoL * pow2( alpha / a2 ) * BRDF_GGX( Ldir, V, N, material );
		}

		// light bounced off the floor, walls and ceiling: a bit more from above than below
		float up = dot( N, normalize( toView * vec3( 0.0, 1.0, 0.0 ) ) );
		vec3 fill = vec3( cabinFill * ( 0.85 + 0.15 * up ) * open );

		reflectedLight.directDiffuse += cabinColor * diffuse * BRDF_Lambert( material.diffuseColor );
		reflectedLight.directSpecular += cabinColor * specular;
		reflectedLight.indirectDiffuse += cabinColor * fill * BRDF_Lambert( material.diffuseColor );
	}
}
`;
