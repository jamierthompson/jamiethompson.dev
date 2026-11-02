---
title: A background that knows when to stop
description: The animated background of this site is a page of code the wind blows light across, drawn on the GPU. The interesting part is not how it moves but how it decides not to. 25 frames a second while the paint drifts, 60 during a ripple, none once you leave it alone.
pubDate: 2026-11-02
category: "Engineering"
---

Leave this page open in a tab and come back in ten minutes. The background
will have stopped. Not paused mid-gust, with a frozen streak of light across
the characters, but settled: the light eased off over a few seconds, the
last frame was drawn, and nothing has been drawn since. Touch the page and it
comes back the same way, easing in over a few seconds from exactly where it
left off.

That is the whole design. A background is decoration, and the first duty of
decoration is to cost nothing when nobody is looking at it. An animated
background that runs forever is a fan spinning in an empty room. Most of
what is interesting about this one is the set of rules for when it does not
run, so that is what this piece is about. The rendering comes first, but only
because the stopping rules do not make sense without it.

## What you are looking at

The picture is wind over dark water. The page is covered in characters, the
ones code is made of, set in the same monospace face as the code blocks on
this site. Gusts of light travel across the page in one direction for the
whole visit, surging and slackening and changing shape as they go, and a
character lights up as a gust passes over it. A click is a blow: a ring runs
out from it, slows, shoves the air outward, and lights what it passes with a
glow. Every third click is a heart. A mouse moving quickly warms the air
where it goes, and warm air shows its characters whether the wind is there
or not.

Each visit has its own wind. A seed is drawn when the page loads, and from it
come the wind's heading, somewhere between 15 and 40 degrees off horizontal
in one of four directions, its speed, and how long and wide a gust is. The
same seed drives every random number the shaders draw, as a hash of the
place being drawn and the time. Nothing is stored between frames. The same
place at the same moment always gives the same number, so the field holds
together from frame to frame without a buffer to hold it in.

## Two passes, and most cells are thrown away

It is drawn with WebGL in two passes, so the expensive part never runs per
pixel.

The first pass is the field. It works out three things at each place on the
page: how much light is there, which way the air is moving, and how much a
ripple is glowing. That is the costly shader, with three octaves of noise
for the gusts, eddies that curl their outlines, thin streaks inside them,
and the ripples and wakes on top. It runs into a small texture with one
sample per character cell across and two per cell down, so on a laptop
screen it is a few thousand samples rather than a few million pixels.

The second pass draws the characters. The grid is one quad per cell, and a
vertex shader works out everything about a cell from nothing but its vertex
number: which character it shows right now, where that character's ink lies
in a glyph atlas, and how much light the field has on it. Then it looks at
the light. A cell with no light on it or next to it, or whose character has
no ink, is thrown off screen before any pixel is shaded. At rest, that is
most of the page. The fragment shader only ever runs inside the ink boxes of
lit characters, where it reads the field texture, interpolated between
samples so the edge of a gust is smooth across a cell, and colors the ink.

One small thing in that second pass does more for the picture than anything
else. The slope of a character's coverage says which way each edge of a
stroke faces, and a stroke facing into the wind catches more light than one
lying along it. That is what makes the characters read as things the wind
is passing over, rather than a pattern of light with text on top.

The atlas is built once, every character drawn white on black at the cell's
size on a 2D canvas. Cells are whole device pixels, so a glyph's pixels land
on pixels and the text is as crisp as the real text beside it. The first
atlas can be drawn before the monospace font has loaded and use the
fallback, so it is drawn again once the font arrives.

## The clock that stops

Here is the part the title is about. The paint has a clock of its own,
separate from the wall clock, and the whole trick is in how that clock is
advanced.

Each frame measures the real time elapsed and asks a budget how much of it
the paint should get. The budget has three numbers.

| Number | Value | What it does                                           |
| ------ | ----- | ------------------------------------------------------ |
| Budget | 180 s | How long the paint keeps moving after the last touch   |
| Settle | 8 s   | How long it takes to ease from full speed to a stop    |
| Resume | 3 s   | How long it takes to come back when touched while calm |

The budget returns an energy from 0 to 1, and the paint's clock advances by
the elapsed time times that energy. At full energy the paint moves in real
time. As the budget runs out, energy eases down over the settle time and
the gusts slow to a stop without a cut. When it reaches 0 the paint is calm,
and the loop is not scheduled again. A touch while calm sets the energy
easing back up over the resume time, from the same clock value it stopped
at. Because the clock is scaled rather than skipped, stopping and starting
never jumps the paint. It is the same field, picked up where it was.

A touch is anything that says someone is here: a click, a key, a scroll, or
the pointer moving. Each one restarts the three minutes. Nobody reading a
page for three minutes without scrolling or moving the mouse is looking at
the background.

Ripples and wakes run on the wall clock, not the paint's. They are a
response to the hand, and a response has to happen now, so a click on a calm
page draws its ring at once while the gusts are still easing back in. The
field shader treats them separately for the same reason.

## How often it draws

The frame rate is chosen by what is moving, not fixed.

| While                               | Frames per second                         |
| ----------------------------------- | ----------------------------------------- |
| The paint drifts                    | 25                                        |
| A ripple is running                 | 60                                        |
| Three minutes since the last touch  | 0                                         |
| The window is behind another        | 0                                         |
| The tab is hidden                   | 0                                         |
| The reader asked for reduced motion | One, redrawn on resize or a scheme change |

Twenty-five is enough for the gusts. They move at a few dozen pixels a
second and nothing in them has an edge sharp enough to strobe. A ripple is
different: it is a ring moving hundreds of pixels a second with the reader's
eye on it, so for the few seconds a ripple is alive the loop runs at the
display rate, and drops back when the last one fades.

The window has to be in front. The loop checks both that the document is
visible and that the window has focus, because a visible tab in a window
behind the one you are typing into is still nobody looking. When the window
comes back to the front a calm page wakes as if touched, and a moving one
carries on.

Reduced motion is honored in full. The gusts are drawn once, fully revealed,
so the page has its texture, and then nothing moves. Clicks leave no ripple
and the pointer leaves no wake, because those are motion too. The one
exception is a ripple already under way when the setting changes, which is
allowed to play out rather than freeze mid-ring.

## When it does not run at all

Some machines should never start it. The context is requested with the
low-power preference and with a flag that refuses a context the browser
would have to emulate. If there is no WebGL2 the canvas stays blank and the
page looks as it does without the paint, which is a perfectly good page. If
there is a context but the renderer reports itself as software, which is
what a headless browser, a machine with no GPU, or a machine with
acceleration switched off will say, the paint declines too. Even the cheap
passes stall a page on a software renderer, and a stalled page is a worse
background than none.

The browser can also take the GPU away later, after a long time in the
background or a driver reset, and give it back. Both events are handled.
Loss stops everything and asks the browser to restore; restoration rebuilds
the programs, the textures and the atlas from scratch and starts again.

## The small rules

A few rules are there so the paint never gets in the way of the page.

The canvas sits at a negative z-index, takes no pointer events, and is
hidden from assistive technology. A click on a link, a button, or any other
control does what the control does and leaves no ripple under it. A finger
on a touch screen is not a hand passing over the page, so only a mouse
leaves wakes.

The colors are the page's own tokens. The ink is the muted text color and
the glow is a blue the scheme can carry, both written in oklch, which the
shader cannot read. So the script paints one pixel of each color on a 2D
canvas and reads it back as RGB. When the scheme toggles, it reads them
again and redraws, which is why the paint changes with the page instead of a
beat after it.

And one rule for me. Every number above lives in one place at the top of the
script, with a comment saying what it is in plain words. The frame rates,
the three budget times, the ink strength, how much a stroke's facing
matters. A background like this is tuned by feel, and feel is only possible
when changing a number is a one-line edit.

## The point

Nothing here is hard. The two-pass rendering is a standard trick, the
budget is forty lines, and the rules about focus and reduced motion are
things every animation on the web should do. What took the time was
deciding that the background's job was to be absent most of the time, and
then making sure that absence was graceful: a slow ease rather than a
freeze, a pickup from where it left off rather than a reset, one still frame
rather than nothing for the reader who asked for stillness.

A finish is what you notice when it is wrong and never when it is right. The
best thing this one does is stop.
