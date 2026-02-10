# Auto Cron UI Styling Guidelines

Design system and styling conventions for the Auto Cron brand. Based on the Swiss Typographic Style with a warm, editorial character.

Reference implementation: `apps/web/app/20/page.tsx`

---

## Aesthetic Direction

**Swiss Modern** — Clean grid-based layouts, bold typographic hierarchy, restrained color palette with a single strong accent. The design communicates precision and reliability while feeling warm rather than cold.

Key principles:

- **Intentional hierarchy** — Every element has a clear visual weight. Nothing is ambiguous.
- **Generous negative space** — Sections breathe. Density is used deliberately, not by default.
- **Restraint with accent** — Gold is used sparingly and purposefully. When everything is highlighted, nothing is.
- **Typography-first** — Type does the heavy lifting. Decorative elements support, never compete.

---

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| **Navy** | `#14213D` | Primary text, dark backgrounds, borders, rules |
| **Parchment** | `#F7F3ED` | Page background, light text on dark surfaces |
| **Gold** | `#FCA311` | Accent color, CTAs, highlights, interactive states |
| **Warm** | `#D4CCC0` | Subtle borders, muted UI elements, dividers |

### Usage Rules

- **Navy** is the default text color. Never use pure black (`#000`).
- **Parchment** is the default background. Never use pure white (`#fff`).
- **Gold** is reserved for:
  - Primary call-to-action buttons
  - Active/highlighted states
  - Section numbers and accent text
  - Hover states on interactive elements
  - The brand dot in the logo
- **Warm** is for low-emphasis dividers, non-highlighted feature markers, and subtle borders.
- Use hex alpha notation for transparency (e.g., `#14213D18` for a 10% navy border, `#FCA31140` for 25% gold).

### Opacity Scale for Text

| Purpose | Opacity |
|---------|---------|
| Primary text | `1.0` |
| Body copy | `0.65 - 0.7` |
| Secondary/description text | `0.55` |
| Tertiary labels | `0.35` |
| Ghost/watermark text | `0.025 - 0.04` |

---

## Typography

Three font families form the type system. All loaded via `next/font/google` with CSS variable binding.

### Font Stack

| Font | Variable | Role | Weights |
|------|----------|------|---------|
| **Bebas Neue** | `--font-bebas` | Display headlines, section numbers, CTA titles | 400 |
| **Outfit** | `--font-outfit` | Body text, UI elements, subheadings | 300-800 |
| **Cutive Mono** | `--font-cutive` | Technical labels, navigation, meta text | 400 |

### CSS Classes

```css
.display { font-family: var(--font-bebas), Impact, sans-serif; }
.mono    { font-family: var(--font-cutive), "Courier New", monospace; }
/* Body uses Outfit by default via the <body> font-family */
```

### Type Scale

| Element | Font | Size | Weight | Extra |
|---------|------|------|--------|-------|
| Hero title | Bebas Neue | `clamp(7rem, 17vw, 18rem)` | 400 | `line-height: 0.9`, uppercase |
| Section number (01, 02...) | Bebas Neue | `clamp(5rem, 10vw, 10rem)` | 400 | Gold color, `text-shadow` glow |
| CTA title ("Begin.") | Bebas Neue | `clamp(5rem, 14vw, 16rem)` | 400 | `line-height: 0.9` |
| Section heading | Outfit | `clamp(1.3rem, 2.2vw, 2rem)` | 700 | Uppercase, `letter-spacing: 0.06em` |
| Feature name | Outfit | `clamp(1.05rem, 1.6vw, 1.3rem)` | 700 | — |
| Body text | Outfit | `15-16px` | 400 | `line-height: 1.75-1.85`, opacity 0.65 |
| Nav links | Cutive Mono | `11px` | 400 | Uppercase, `letter-spacing: 0.15em` |
| Meta labels | Cutive Mono | `10px` | 400 | Uppercase, `letter-spacing: 0.2em` |
| Fine print | Cutive Mono | `10px` | 400 | Uppercase, opacity 0.25 |

### Typography Rules

- All headings use `text-wrap: balance`.
- Display text (Bebas Neue) is always uppercase.
- Mono text (Cutive Mono) is always uppercase with wide letter-spacing.
- Body copy maxes out at `480-580px` line width for readability.
- Use `clamp()` for all responsive font sizes — no breakpoint-based size changes.
- Numbers in pricing use `font-variant-numeric: tabular-nums` for alignment.

---

## Layout

### Container

```css
.s-wrap {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 clamp(24px, 5vw, 80px);
}
```

### Grid System

A 12-column grid is visible as a subtle background overlay (3% opacity navy lines). Content is not rigidly snapped to this grid but uses it as a visual rhythm guide.

Common grid patterns:

| Pattern | Columns | Usage |
|---------|---------|-------|
| `1fr 2fr` | Two-column editorial | Manifesto, content sections |
| `80px 1fr 1.4fr` | Three-column with number | Feature rows |
| `repeat(4, 1fr)` | Four equal columns | Process steps |
| `repeat(3, 1fr)` | Three equal columns | Pricing cards |
| `1fr auto` | Content + visualization | Hero section |

### Section Spacing

All section padding uses fluid values:

```css
padding: clamp(80px, 10vh, 160px) 0;
```

Spacing between section header and content:

```css
margin-bottom: clamp(40px, 5vw, 72px);
```

### Dividers

Thick 2px navy rules (`.rule-thick`) separate major sections. Registration marks (`+` symbols) appear at the ends of primary dividers in gold at 40% opacity.

Within sections, lighter dividers use opacity:
- First row divider: `opacity: 1`
- Subsequent row dividers: `opacity: 0.15`

---

## Buttons

### Primary (Gold)

```css
.btn-gold {
  background: #FCA311;
  color: #14213D;
  font-family: var(--font-outfit);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 16px 48px;
}
```

Hover: Navy fill slides in from the left (`translateX`), text becomes parchment. Uses a `::before` pseudo-element with `cubic-bezier(0.19, 1, 0.22, 1)` easing.

### Secondary (Outline)

```css
.btn-outline {
  background: transparent;
  border: 2px solid #14213D;
  color: #14213D;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 15px 40px;
}
```

Hover: Border and text transition to gold.

### Text Link (Pricing)

Underline-style link with a 2px navy bottom border. Hover transitions border and text to gold.

---

## Interactive States

### Hover Patterns

- **Nav links**: Gold color + animated underline that expands from left (`width: 0` to `width: 100%`).
- **Feature rows**: Gold left border scales in from top, background gains a subtle gold gradient from left, row shifts right by 20px. Feature number turns gold.
- **Process steps**: Slight upward lift (`translateY(-2px)`), subtle gold background tint. Node circle fills with gold.
- **Pricing cards**: Lift upward (`translateY(-4px)`). Pro card starts elevated at `-8px` and lifts to `-12px`.
- **Footer links**: Opacity transitions from 0.45 to 0.8.

### Transition Defaults

- **Duration**: `0.4s` for most interactions, `0.5s` for more dramatic effects.
- **Easing**: `cubic-bezier(0.22, 1, 0.36, 1)` for reveals, `cubic-bezier(0.19, 1, 0.22, 1)` for slides and fills.
- Simple color/opacity changes use `ease`.

### Focus

```css
:focus-visible {
  outline: 2px solid #FCA311;
  outline-offset: 3px;
}
```

### Selection

```css
::selection {
  background: #FCA311;
  color: #14213D;
}
```

---

## Animation

### Scroll Reveals

Elements with `data-reveal` start hidden and animate in when they enter the viewport:

```css
[data-reveal] {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1),
              transform 0.9s cubic-bezier(0.22, 1, 0.36, 1);
}
[data-reveal].revealed {
  opacity: 1;
  transform: translateY(0);
}
```

Triggered via `IntersectionObserver` with `threshold: 0.08` and `rootMargin: "0px 0px -40px 0px"`. Stagger delays by adding `transitionDelay` inline (e.g., `${idx * 0.07}s`).

### Hero Entrance Sequence

| Element | Animation | Delay |
|---------|-----------|-------|
| Nav | `fadeIn` | 0s |
| Title line 1 | `clipUp` | 0.2s |
| Title line 2 | `clipUp` | 0.4s |
| Gold rule | `lineExpand` | 0.7s |
| Tagline | `fadeUp` | 0.9s |
| CTA buttons | `fadeUp` | 1.1s |
| Schedule grid | `fadeIn` | 0.6s |

### Keyframes Available

- `clipUp` — Clip-path reveal from bottom with upward translate.
- `lineExpand` — Scale from 0 to 1 on X-axis (for decorative lines).
- `fadeUp` — Opacity 0 to 1 with upward translate.
- `fadeIn` — Simple opacity transition.
- `gridPulse` — Subtle opacity oscillation for schedule grid blocks.
- `glowPulse` — Scale and opacity pulse for radial glow effects.

### Reduced Motion

All animations and transitions collapse to `0.01ms` when `prefers-reduced-motion: reduce` is active. The spotlight effect is hidden. All `data-reveal` elements are shown immediately.

---

## Decorative Elements

### Grain Texture

A fixed SVG `feTurbulence` filter covers the entire viewport at 3.2% opacity. This adds subtle texture to the parchment background.

```html
<svg style="position: fixed; inset: 0; opacity: 0.032; pointer-events: none; z-index: 9998;">
  <filter id="grain-f">
    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" />
    <feColorMatrix type="saturate" values="0" />
  </filter>
  <rect width="100%" height="100%" filter="url(#grain-f)" />
</svg>
```

### Grid Overlay

A 12-column repeating linear gradient on `.swiss-page::before` at 2.5% navy opacity.

### Spotlight

A 600px radial gradient circle in gold (4.5% opacity) follows the mouse cursor with eased movement. Hidden on mobile and when reduced motion is preferred.

### Registration Marks

`+` symbols in gold at 40% opacity placed at the edges of major dividers via `::before` and `::after` pseudo-elements.

### Rotated Labels

Vertical text labels on the left edge of sections (`transform: rotate(-90deg)`), set in Cutive Mono at 10px, 30% opacity.

### Ghost Watermarks

Large background text at 2-4% opacity (e.g., "AC", "GO", section numbers) using Bebas Neue. The hero watermark has a parallax scroll effect at 12% of scroll position.

### Gold Glow

Section numbers use `text-shadow: 0 0 60px #FCA31118` for a subtle warm glow.

---

## Dark Sections

The CTA and footer use a navy background with inverted text colors:

- Text: Parchment (`#F7F3ED`)
- Accent: Gold remains gold
- Subtle grid overlay: `1px` parchment lines at 2% opacity, 60px spacing
- Borders between sections: `1px solid #F7F3ED10`
- Footer link headings: Gold at 60% opacity
- Footer body links: Parchment at 45% opacity, hover to 80%

---

## Pricing Cards

### Standard Card

- Border: `1.5px solid #14213D18`
- Background: Parchment
- Hover: `translateY(-4px)`

### Highlighted (Pro) Card

- Border: `2px solid #FCA311`
- Background: `linear-gradient(180deg, #FCA31108, #F7F3ED)`
- Default position: `translateY(-8px)`
- Shadow: `0 20px 60px rgba(252, 163, 17, 0.15), 0 4px 16px rgba(20, 33, 61, 0.08)`
- Hover: `translateY(-12px)` with stronger shadow
- Includes a "Most Popular" gold banner at the top

### Feature List Style

Features are listed with `+` markers. On the Pro card, markers are gold. On standard cards, markers use the warm color. Items are separated by `1px solid #14213D08` borders.

---

## Responsive Behavior

Breakpoint at `900px`:

| Component | Desktop | Mobile |
|-----------|---------|--------|
| Hero grid viz | Visible | Hidden |
| Hero title | `clamp(7rem, 17vw, 18rem)` | `clamp(4.5rem, 18vw, 12rem)` |
| Manifesto | Two columns | Single column |
| Feature rows | Three columns | Single column |
| Process steps | Four columns with connector | Single column, stacked |
| Pricing grid | Three columns | Single column |
| Nav links | Visible | Hidden |
| Spotlight | Active | Hidden |
| CTA title | Full size | `clamp(4rem, 16vw, 12rem)` |

### Fluid Sizing

All sizing uses `clamp()` for smooth scaling between breakpoints rather than abrupt changes:

```css
/* Pattern: clamp(minimum, preferred, maximum) */
font-size: clamp(1.3rem, 2.2vw, 2rem);
padding: clamp(80px, 10vh, 160px) 0;
gap: clamp(16px, 3vw, 48px);
```

---

## Cursor

The page uses `cursor: crosshair` as the default cursor (Swiss design convention). Links and buttons override to `cursor: pointer`.

---

## Accessibility

- All decorative elements have `aria-hidden="true"`.
- Navigation uses `aria-label="Main navigation"`.
- Focus states use a visible 2px gold outline with 3px offset.
- Reduced motion preferences are fully respected.
- Text contrast meets WCAG AA requirements (navy on parchment, parchment on navy).
- Interactive elements use `touch-action: manipulation` to prevent double-tap zoom delays on mobile.
