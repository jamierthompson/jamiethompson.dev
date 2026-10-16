#version 300 es
// Pass 2 of 2, the glyphs: runs only inside the ink boxes the vertex shader
// kept. It reads the character's coverage from the atlas and the light,
// direction and glow at this pixel from the field, interpolated between
// samples so a gust's edge is smooth across a cell. A stroke that faces
// into the wind catches more of it than one lying along it, which is what
// makes the characters read as things the wind is passing over.
precision highp float;

in vec2 v_uv;
flat in vec4 v_cell;
uniform sampler2D u_atlas;      // glyph coverage, white on black, pixel for pixel
uniform sampler2D u_field;      // light, direction x, direction y, glow
uniform vec2 u_buffer;          // the canvas size in device pixels
uniform vec2 u_gridDevice;      // the whole grid's size in device pixels (at least the canvas)
uniform vec2 u_atlasSize;       // the atlas texture's size in pixels
uniform vec3 u_bg;              // the page background (--background), 0 to 1 per channel
uniform vec3 u_ink;             // the color of a lit character (--paint-ink)
uniform vec3 u_glow;            // the color a ripple lights it (--paint-glow)
uniform float u_base;           // how strong the ink is in plain light, 0 to 1
uniform float u_cap;            // and at the height of a glow
uniform float u_friction;       // how much a stroke's facing matters, 0 to 1
out vec4 o;

float inkAt(vec2 uv) {
  return texture(u_atlas, clamp(uv, v_cell.xy, v_cell.zw)).r;
}

void main() {
  float ink = inkAt(v_uv);
  if (ink <= 0.0) discard;
  // This pixel with y down, then the field's v with y up again.
  vec2 down = vec2(gl_FragCoord.x, u_buffer.y - gl_FragCoord.y);
  vec4 f = texture(u_field, vec2(down.x, u_gridDevice.y - down.y) / u_gridDevice);
  vec2 blows = f.gb * 2.0 - 1.0;

  // Which way the stroke's edge faces: the slope of the coverage. A face
  // toward where the wind comes from is a face to the wind.
  vec2 texel = 1.0 / u_atlasSize;
  vec2 rise = vec2(
    inkAt(v_uv + vec2(texel.x, 0.0)) - inkAt(v_uv - vec2(texel.x, 0.0)),
    inkAt(v_uv + vec2(0.0, texel.y)) - inkAt(v_uv - vec2(0.0, texel.y)));
  float steep = length(rise);
  float facing = steep > 0.02 ? max(0.0, dot(rise / steep, blows)) : 0.35;
  float caught = mix(1.0, 0.45 + 1.1 * facing, u_friction);

  float lit = min(1.0, f.r * caught);
  // The glow color comes in whole and goes out quickly: halfway between it
  // and the ink is only mud.
  float tint = smoothstep(0.04, 0.3, f.a);
  float amount = ink * min(1.0, lit * mix(u_base, u_cap, tint) + 0.3 * f.a);
  o = vec4(mix(u_bg, mix(u_ink, u_glow, tint), amount), 1.0);
}
