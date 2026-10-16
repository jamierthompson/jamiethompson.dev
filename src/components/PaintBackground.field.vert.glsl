#version 300 es
// Pass 1 of 2, the field. The vertex shader makes one triangle large enough
// to cover the whole target from the vertex number alone, so there is no
// vertex buffer: ids 0, 1, 2 become (-1,-1), (3,-1), (-1,3) in clip space,
// and the overhang past the -1..1 square is clipped away.
void main() {
  vec2 corner = vec2(float((gl_VertexID & 1) * 4), float((gl_VertexID & 2) * 2));
  gl_Position = vec4(corner - 1.0, 0.0, 1.0);
}
