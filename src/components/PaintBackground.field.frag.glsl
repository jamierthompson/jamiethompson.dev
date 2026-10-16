#version 300 es
// Pass 1 of 2, the field: how much light is on each place, which way the
// air is moving there, and how much a ripple is glowing. This is the
// expensive shader, so it does not run per screen pixel: it renders into a
// small texture with one texel per character cell across and two down, and
// the glyph pass reads that texture, smoothly interpolated, to light the
// characters.
//
// The picture is wind over dark water. The page is dark; gusts of light
// travel across it in one direction all visit long, surging and slackening,
// changing shape as they go, and the characters catch the light as a gust
// passes. A click is a blow: a ring runs out, slows, and shoves the air
// outward, lighting what it passes with a glow. A moving pointer warms the
// air where it goes, and warm air shows its characters wind or no wind.
precision highp float;
precision highp int;

uniform vec2 u_fieldSize;    // the texture's size in texels: columns, rows * 2
uniform vec2 u_sampleCss;    // CSS px from one texel to the next: a cell's width, half its height
uniform float u_time;        // the paint's own clock, seconds: only advances while the paint moves
uniform float u_now;         // the wall clock, seconds, for taps and wakes
uniform float u_reveal;      // 0 to 1 over the first seconds, so the gusts fade in
uniform uint u_seed;         // this visit's seed; every hash takes it
uniform vec4 u_wind;         // heading (radians, y down), speed (CSS px/s), gust length, gust width (px)
uniform int u_tapCount;
uniform vec4 u_taps[6];      // x, y (CSS px), start time, force; negative force is a heart
uniform int u_wakeCount;
uniform vec4 u_wakes[32];    // x, y of a stretch of the pointer's path, its warmth, 1 / reach²
uniform vec4 u_ways[32];     // the stretch's direction (unit) and half its length
out vec4 o;                  // light, direction x, direction y (both 0..1), glow

const float TAU = 6.2831853;
// Tuning. LEVEL is the water line: how high the field must rise to light
// up, so higher means less of the page lit. BAND is how soft a gust's edge
// is. STREAK is how much thin quick streaks break a gust up. CURL is how far
// eddies bend a gust's outline. MORPH is how fast gusts change shape.
const float LEVEL = 0.42;
const float BAND = 0.09;
const float STREAK = 0.4;
const float CURL = 0.6;
const float MORPH = 3.0;

// ---- Hashing and noise ------------------------------------------------------
// Everything random here is a hash of integers: the same place and seed
// always give the same number, so the field is consistent from frame to
// frame and from texel to texel without storing anything.

uint hash(uint x) {
  x ^= x >> 16; x *= 0x7feb352du;
  x ^= x >> 15; x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float unit(uint h) { return float(h >> 8u) * (1.0 / 16777216.0); }   // 0 to 1
uint corner(ivec3 c, uint salt) {
  return hash(hash(hash(uint(c.x) ^ u_seed ^ salt) + uint(c.y)) + uint(c.z));
}
vec3 fade(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

// Value noise: a random height at every lattice point, blended between.
// Soft blobs, -1 to 1. Used for anything that should drift slowly.
float vnoise(vec3 p, uint salt) {
  vec3 fl = floor(p);
  vec3 f = fade(p - fl);
  ivec3 i = ivec3(fl);
  float c000 = unit(corner(i, salt)),                   c100 = unit(corner(i + ivec3(1, 0, 0), salt));
  float c010 = unit(corner(i + ivec3(0, 1, 0), salt)),  c110 = unit(corner(i + ivec3(1, 1, 0), salt));
  float c001 = unit(corner(i + ivec3(0, 0, 1), salt)),  c101 = unit(corner(i + ivec3(1, 0, 1), salt));
  float c011 = unit(corner(i + ivec3(0, 1, 1), salt)),  c111 = unit(corner(i + ivec3(1, 1, 1), salt));
  float v = mix(mix(mix(c000, c100, f.x), mix(c010, c110, f.x), f.y),
                mix(mix(c001, c101, f.x), mix(c011, c111, f.x), f.y), f.z);
  return v * 2.0 - 1.0;
}

// Gradient noise: a random slope at every lattice point instead of a
// height, so the value crosses zero between every pair of points. Ridges
// and troughs, no blobs: the shape of a gust. About -1 to 1.
vec3 slope(uint h) {
  return vec3(float(h & 1023u), float((h >> 10u) & 1023u), float((h >> 20u) & 1023u)) * (2.0 / 1023.0) - 1.0;
}
float gnoise(vec3 p, uint salt) {
  vec3 fl = floor(p);
  vec3 d = p - fl;
  vec3 f = fade(d);
  ivec3 i = ivec3(fl);
  float n000 = dot(slope(corner(i, salt)), d);
  float n100 = dot(slope(corner(i + ivec3(1, 0, 0), salt)), d - vec3(1.0, 0.0, 0.0));
  float n010 = dot(slope(corner(i + ivec3(0, 1, 0), salt)), d - vec3(0.0, 1.0, 0.0));
  float n110 = dot(slope(corner(i + ivec3(1, 1, 0), salt)), d - vec3(1.0, 1.0, 0.0));
  float n001 = dot(slope(corner(i + ivec3(0, 0, 1), salt)), d - vec3(0.0, 0.0, 1.0));
  float n101 = dot(slope(corner(i + ivec3(1, 0, 1), salt)), d - vec3(1.0, 0.0, 1.0));
  float n011 = dot(slope(corner(i + ivec3(0, 1, 1), salt)), d - vec3(0.0, 1.0, 1.0));
  float n111 = dot(slope(corner(i + ivec3(1, 1, 1), salt)), d - vec3(1.0));
  return 1.5 * mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
                   mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

// ---- The gusts --------------------------------------------------------------
// In the wind's own frame (x along it, y across), three sizes of gradient
// noise, each longer along the wind than across it and each slowly
// changing shape, weighted so the result stays about -1 to 1.
float gusts(vec2 q) {
  vec2 size = vec2(u_wind.z, u_wind.w);
  float sum = 0.0;
  float weight = 1.0;
  float norm = 0.0;
  for (int i = 0; i < 3; i++) {
    float k = float(i);
    sum += weight * gnoise(vec3(q / size, u_time * MORPH * (0.03 + 0.02 * k) + 7.0 * k), 0x10u + uint(i));
    norm += weight * weight;
    weight *= 0.55;
    size *= vec2(0.5, 0.6);
  }
  return sum * inversesqrt(norm);
}

// ---- The heart ----------------------------------------------------------
// The outline as a radius per direction about its center, from the
// library's heartProfile: the farthest point lies at 1. Dividing a point's
// distance by the radius in its direction turns rings into nested hearts
// that grow from the click, just as a circle's rings do.
uniform sampler2D u_heart;
// How far out `away` lies, as a share of the ring's radius `r`: 1 on the outline.
float reachOf(vec2 away, float r, float heart) {
  float d = length(away);
  if (heart < 0.5) return d / r;
  float turn = atan(-away.y, away.x) / TAU;   // y up, and the texture wraps around
  return d / (r * textureLod(u_heart, vec2(turn, 0.5), 0.0).r);
}

void main() {
  // This texel's place on the page in CSS pixels, y down like the DOM.
  // gl_FragCoord counts texels from the bottom, so the row is flipped.
  vec2 p = vec2(gl_FragCoord.x, u_fieldSize.y - gl_FragCoord.y) * u_sampleCss;
  vec2 pane = u_fieldSize * u_sampleCss;
  vec2 heading = vec2(cos(u_wind.x), sin(u_wind.x));
  vec2 across = vec2(-heading.y, heading.x);
  // How far the wind has carried everything so far; it surges and slackens.
  float carried = u_wind.y * (u_time + 1.0 * vnoise(vec3(u_time * 0.09, 3.7, 0.0), 0x01u));

  // ---- What the hand has done here ----
  vec2 push = vec2(0.0);   // the air shoved outward by a ripple, CSS px
  float crest = 0.0;       // a ripple's ring raising the field
  float rouse = 0.0;       // how stirred the air is, which curls it further
  float glow = 0.0;        // the ring's color and its afterlight
  float warm = 0.0;        // how warm the pointer has left the air
  if (u_tapCount + u_wakeCount > 0) {
    // Read a little off true, so a ripple's outline is never a drawn circle.
    vec2 near = p + 20.0 * vec2(
      vnoise(vec3(p / 90.0, u_now * 0.1), 0x20u),
      vnoise(vec3(p / 90.0 + 9.0, u_now * 0.1 + 4.0), 0x21u));
    for (int i = 0; i < 6; i++) {
      if (i >= u_tapCount) break;
      vec4 tap = u_taps[i];
      float age = u_now - tap.z;
      vec2 away = near - tap.xy;
      float d = max(length(away), 1.0);
      float front = 600.0 * (1.0 - exp(-age / 1.2));     // the ring runs out and slows
      float behind = front - reachOf(away, front, tap.w < 0.0 ? 1.0 : 0.0) * front;   // px inside the ring
      float width = 80.0 + 60.0 * age;
      float ring = smoothstep(-16.0, 10.0, behind) * exp(-behind * behind / (width * width));
      float swell = abs(tap.w) * exp(-age / 1.5) * ring;
      push += away / d * 44.0 * swell;
      crest += 1.9 * swell * (0.25 + 0.75 * cos(behind * TAU / 130.0));   // a trough and weaker crests behind
      rouse += swell;
      float trail = smoothstep(0.0, 70.0, behind) * exp(-max(behind, 0.0) / 260.0);
      glow += abs(tap.w) * (exp(-age) * ring + 0.7 * exp(-age / 1.3) * trail);
    }
    float warmth = 0.0;
    for (int i = 0; i < 32; i++) {
      if (i >= u_wakeCount) break;
      vec4 wake = u_wakes[i];
      vec3 way = u_ways[i].xyz;
      // The nearest point on the stretch, not just its middle, so the
      // quickest stroke still leaves one unbroken trail.
      vec2 away = near - wake.xy;
      away -= way.xy * clamp(dot(away, way.xy), -way.z, way.z);
      warmth += wake.z * exp(-dot(away, away) * wake.w);
    }
    warm = 1.0 - exp(-1.5 * warmth);   // however hard it is stirred, only so warm
    crest += 0.25 * warm;
    rouse += 0.05 * warm;
  }

  // ---- The air ----
  // Pushed air shows what was over there. The wind's path bends slowly on
  // a large scale, and eddies curl every outline, more where it is roused.
  vec2 from = p - push;
  vec2 bend = vec2(
    vnoise(vec3(from / 380.0, u_time * 0.04), 0x30u),
    vnoise(vec3(from / 380.0 + 17.0, u_time * 0.04 + 5.0), 0x31u));
  vec2 bent = from + 80.0 * bend;
  vec2 q = vec2(dot(bent, heading) - carried, dot(bent, across));
  float eddySize = 1.15 * u_wind.w;
  vec2 eddy = vec2(
    gnoise(vec3(q / eddySize, u_time * 0.12), 0x40u),
    gnoise(vec3(q / eddySize + 31.0, u_time * 0.12 + 3.0), 0x41u));
  vec2 folded = (q + CURL * 0.9 * u_wind.w * eddy) / (0.38 * u_wind.w);
  vec2 fine = vec2(
    gnoise(vec3(folded, u_time * 0.18), 0x42u),
    gnoise(vec3(folded + 13.0, u_time * 0.18 + 7.0), 0x43u));
  vec2 curled = q + CURL * (1.0 + 0.9 * min(rouse, 1.5)) * u_wind.w * (0.9 * eddy + 0.3 * fine);
  vec2 blows = normalize(heading + 0.5 * bend + push / 14.0
    + CURL * ((0.45 * eddy.x + 0.25 * fine.x) * heading + (0.45 * eddy.y + 0.25 * fine.y) * across));

  // ---- The field ----
  // Gusts, gathered on long swells about one to the pane so they arrive in
  // groups and the page is seldom full or empty, plus whatever the hand did.
  float span = 0.58 * (abs(heading.x) * pane.x + abs(heading.y) * pane.y);
  float drift = 0.5 * span * vnoise(vec3(u_time * 0.045, curled.y / (2.5 * u_wind.w), 7.0), 0x50u);
  float swell = 0.3 * cos((curled.x + drift) * TAU / span);
  float field = gusts(curled) + swell + crest;

  // ---- The light ----
  float light = 0.0;
  float streaks = 0.0;
  bool blowing = field > LEVEL - BAND;
  if (blowing || warm > 0.0) {
    // Thin quick streaks within a gust, as wind draws on water.
    float thread = vnoise(vec3(curled.x / 140.0, curled.y / 30.0, u_time * 0.16), 0x60u);
    streaks = 1.0 - smoothstep(0.0, 0.5, abs(thread));
  }
  if (blowing) {
    float lit = smoothstep(LEVEL - BAND, LEVEL + BAND, field);
    float broad = lit * lit * mix(0.45, 1.0, clamp((field - LEVEL) / 0.45, 0.0, 1.0)) * (0.82 + 0.18 * fine.y);
    light = broad * mix(1.0, 0.25 + 0.95 * streaks, STREAK);
  }
  if (warm > 0.0) {
    // Warm air shows its characters in the air's own fine grain, wind or not.
    float grain = 0.55 * fine.y + 0.3 * (streaks - 0.4);
    light = 1.0 - (1.0 - light) * (1.0 - 0.85 * warm * smoothstep(-0.5, 0.25, grain));
  }
  // What the hand does shows at once, however little of the wind has arrived.
  float shown = max(u_reveal, min(1.0, 2.0 * rouse + warm));
  o = vec4(light * shown, blows * 0.5 + 0.5, min(1.0, glow));
}
