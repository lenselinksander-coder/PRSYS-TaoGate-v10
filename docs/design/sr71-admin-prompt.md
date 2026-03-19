# SR-71 Admin Console Redesign — Replit Prompt

Pas de ORFHEUSS Beheer Console v2.0 sidebar en kleurthema aan.
Vervang het matrix-groene thema met een SR-71 Blackbird cockpit esthetiek:
donker, mat, amber instrumentverlichting, rustig voor langdurig gebruik.

## 1. CSS Custom Properties (design tokens)

Voeg toe aan je root of theme file:

```css
:root {
  /* Basis — titanium matzwart */
  --bg-primary:       #0d0d0f;
  --bg-surface:       #161618;
  --bg-elevated:      #1e1e24;
  --border:           #2a2a32;

  /* Tekst */
  --text-primary:     #c8c8d0;
  --text-secondary:   #6b6b76;
  --text-muted:       #3d3d47;

  /* Instrumenten */
  --amber:            #d4a017;
  --amber-dim:        #8b6914;
  --amber-glow:       rgba(212, 160, 23, 0.08);
}
```

## 2. Sidebar achtergrond en tekst

Vervang alle groene kleuren (#00ff00, lime, green, etc.) in de sidebar:

- Sidebar achtergrond: `var(--bg-surface)`
- Menu-item tekst: `var(--text-primary)`
- Menu-item hover achtergrond: `var(--bg-elevated)`
- Iconen: `var(--text-secondary)`

## 3. Actief item

Vervang de groene filled bar met:

```css
.sidebar-item.active {
  color: var(--amber);
  background: transparent;
  border-left: 2px solid var(--amber);
  padding-left: calc(original-padding - 2px);
}
```

Geen filled achtergrond. Alleen een dunne amber lijn links + amber tekst.

## 4. Menu groepering

Herstructureer de platte lijst van 13 items in 5 secties.
Voeg section headers toe boven elke groep:

```html
<div class="sidebar-section">
  <span class="sidebar-section-label">BEHEER</span>
  <!-- Dashboard, Organisaties, Scopes, Register -->
</div>

<div class="sidebar-section">
  <span class="sidebar-section-label">DATA</span>
  <!-- Import, Ingest, Connectors -->
</div>

<div class="sidebar-section">
  <span class="sidebar-section-label">BEWAKING</span>
  <!-- ARGOS, Gateway Logs, Vectoren -->
</div>

<div class="sidebar-section">
  <span class="sidebar-section-label">SYSTEEM</span>
  <!-- Castra, OLYMPIA -->
</div>

<div class="sidebar-section">
  <span class="sidebar-section-label">INTERFACE</span>
  <!-- CVI Voorkant -->
</div>
```

Section header styling:

```css
.sidebar-section-label {
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  color: var(--amber-dim);
  text-transform: uppercase;
  padding: 1.2rem 1rem 0.3rem;
  display: block;
}

.sidebar-section + .sidebar-section {
  border-top: 1px solid var(--border);
}
```

## 5. Header bar

- Logo tekst "ORFHEUSS": `var(--text-primary)`
- "ADMIN" badge: `var(--text-secondary)` met `border: 1px solid var(--border)`
- "BEHEER CONSOLE v2.0" subtekst: `var(--text-muted)`
- Status badge "6 ORG · 6 SCOPE": `border-color: var(--amber-dim)`, tekst `var(--amber)`

## 6. Zoekbalk

```css
.search-input {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-primary);
}
.search-input:focus {
  border-color: var(--amber);
  outline: none;
}
```

## 7. CVI Voorkant (onderaan)

Vervang de oranje/groene border met:

```css
.cvi-link {
  border: 1px solid var(--amber-dim);
  color: var(--amber);
}
.cvi-link:hover {
  border-color: var(--amber);
  background: var(--bg-elevated);
}
```

## Wat NIET wijzigt

- Monospace font behouden
- Iconen behouden (alleen kleur aanpassen)
- Functionaliteit en routing ongewijzigd
- Alleen kleur, groepering en spacing
