#version 300 es
// Pass 2 of 2, the glyphs. Every cell of the grid is one quad of six
// vertices, and this shader runs once per vertex with nothing but the vertex
// number: which cell it belongs to, which corner it is. It decides which
// character the cell shows right now, looks up that character's ink box in
// the atlas, and reads the light on the cell from the field texture. A cell
// with no ink, or no light or glow on it or next to it, is thrown off screen
// so the fragment shader never runs for it. At rest that is most of the page.
precision highp float;
precision highp int;

uniform ivec2 u_grid;                // cells: columns, rows
uniform ivec2 u_cell;                // a cell's size in device pixels
uniform vec2 u_buffer;               // the canvas size in device pixels
uniform vec2 u_atlasSize;            // the atlas texture's size in pixels
uniform uint u_seed;                 // this visit's seed
uniform float u_time;                // the paint's clock, for the flicker
uniform float u_flick;               // how many characters a second a cell steps through, about
uniform int u_count;                 // how many glyphs the sequence holds
uniform highp usampler2D u_sequence; // the glyphs a cell steps through, in order
uniform highp usampler2D u_boxes;    // one texel per glyph: its ink box x, y, w, h in its atlas cell
uniform highp sampler2D u_field;     // light, direction, glow: one texel per cell across and two down

out vec2 v_uv;                       // where in the atlas this vertex is
flat out vec4 v_cell;                // the atlas cell's bounds in uv, so a neighbor's ink is never read

const ivec2 CORNER[6] = ivec2[6](
  ivec2(0, 0), ivec2(1, 0), ivec2(0, 1),
  ivec2(0, 1), ivec2(1, 0), ivec2(1, 1)
);

uint hash(uint x) {
  x ^= x >> 16; x *= 0x7feb352du;
  x ^= x >> 15; x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float unit(uint h) { return float(h >> 8u) * (1.0 / 16777216.0); }

void none() {
  gl_Position = vec4(2.0, 2.0, 0.0, 1.0);   // outside clip space: culled
  v_uv = vec2(0.0);
  v_cell = vec4(0.0);
}

void main() {
  int id = gl_VertexID / 6;
  ivec2 cell = ivec2(id % u_grid.x, id / u_grid.x);

  // The field's rows count from the bottom; the cell's two samples and the
  // ring of samples around them, since the fragment shader interpolates.
  ivec2 fieldLast = ivec2(u_grid.x, u_grid.y * 2) - 1;
  ivec2 sample0 = ivec2(cell.x, (u_grid.y - 1 - cell.y) * 2);
  float light = 0.0;
  for (int dy = -1; dy <= 2; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec4 f = texelFetch(u_field, clamp(sample0 + ivec2(dx, dy), ivec2(0), fieldLast), 0);
      light = max(light, max(f.r, f.a));
    }
  }
  if (light == 0.0) {
    none();
    return;
  }

  // Which character: each cell walks the sequence at its own pace from its
  // own place in it, and a cell a ripple is passing hurries on.
  uint h = hash((uint(cell.x) * 0x9e3779b9u) ^ hash(uint(cell.y) ^ u_seed));
  float pace = 0.6 + 0.8 * unit(hash(h));
  float roused = texelFetch(u_field, sample0, 0).a;
  int steps = int(floor(u_time * u_flick * pace + unit(hash(h ^ 0x55u)) + 6.0 * roused));
  int start = int(h & 0xffffu);
  int glyph = int(texelFetch(u_sequence, ivec2((start + steps) % u_count, 0), 0).r);

  uvec4 box = texelFetch(u_boxes, ivec2(glyph, 0), 0);
  if (box.z == 0u) {
    none();
    return;
  }
  ivec2 corner = CORNER[gl_VertexID - id * 6];
  ivec2 inkOrigin = ivec2(box.xy);
  ivec2 inkSize = ivec2(box.zw);
  // The quad covers only the ink box, in device pixels with y down.
  ivec2 px = cell * u_cell + inkOrigin + corner * inkSize;
  ivec2 atlasCell = ivec2(glyph & 15, glyph >> 4) * u_cell;
  v_uv = vec2(atlasCell + inkOrigin + corner * inkSize) / u_atlasSize;
  v_cell = vec4(vec2(atlasCell) + 0.5, vec2(atlasCell + u_cell) - 0.5) / u_atlasSize.xyxy;
  vec2 ndc = vec2(px) / u_buffer * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}
