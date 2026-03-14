// Muscle Body SVG — anatomical front/back body visualization
// Each muscle group has a unique data-muscle attribute matching the display group keys
// from exercise-library.js: chest, back, shoulders, biceps, triceps, forearms,
// quads, hamstrings, glutes, calves, core

function getMuscleBodySvgFront(){
  return `<svg viewBox="0 0 200 440" xmlns="http://www.w3.org/2000/svg" class="muscle-body-svg" aria-hidden="true">
    <!-- Body base (non-muscle connective areas) -->
    <g class="muscle-body-base" fill="var(--muscle-base, #1a1a1e)" stroke="none">
      <ellipse cx="100" cy="32" rx="22" ry="28"/>
      <rect x="90" y="56" width="20" height="16" rx="4"/>
      <!-- Hip / pelvis connector -->
      <path d="M78,196 Q84,210 100,212 Q116,210 122,196 L122,208 Q116,222 100,224 Q84,222 78,208 Z"/>
      <!-- Upper arm connectors -->
      <rect x="38" y="106" width="14" height="10" rx="4"/>
      <rect x="148" y="106" width="14" height="10" rx="4"/>
      <!-- Knee connectors -->
      <ellipse cx="64" cy="326" rx="8" ry="6"/>
      <ellipse cx="136" cy="326" rx="8" ry="6"/>
    </g>

    <!-- SHOULDERS (front delts) -->
    <path data-muscle="shoulders" class="muscle-zone" d="
      M64,76 Q56,70 46,74 Q36,80 34,96 Q34,104 40,110
      L56,106 L64,98 Z"/>
    <path data-muscle="shoulders" class="muscle-zone" d="
      M136,76 Q144,70 154,74 Q164,80 166,96 Q166,104 160,110
      L144,106 L136,98 Z"/>

    <!-- CHEST -->
    <path data-muscle="chest" class="muscle-zone" d="
      M64,76 L98,70 L98,118 Q88,126 76,122 Q64,116 56,106 L64,98 Z"/>
    <path data-muscle="chest" class="muscle-zone" d="
      M136,76 L102,70 L102,118 Q112,126 124,122 Q136,116 144,106 L136,98 Z"/>

    <!-- CORE (abs) -->
    <path data-muscle="core" class="muscle-zone" d="
      M82,120 L118,120 L118,198 Q110,206 100,208 Q90,206 82,198 Z"/>

    <!-- BICEPS -->
    <path data-muscle="biceps" class="muscle-zone" d="
      M40,116 Q34,118 32,134 Q30,154 32,170 Q36,176 42,172
      Q48,160 48,142 Q48,128 44,116 Z"/>
    <path data-muscle="biceps" class="muscle-zone" d="
      M160,116 Q166,118 168,134 Q170,154 168,170 Q164,176 158,172
      Q152,160 152,142 Q152,128 156,116 Z"/>

    <!-- FOREARMS -->
    <path data-muscle="forearms" class="muscle-zone" d="
      M32,176 Q28,182 24,204 Q22,222 22,236 Q24,240 28,238
      Q34,224 38,204 Q40,190 38,176 Z"/>
    <path data-muscle="forearms" class="muscle-zone" d="
      M168,176 Q172,182 176,204 Q178,222 178,236 Q176,240 172,238
      Q166,224 162,204 Q160,190 162,176 Z"/>

    <!-- QUADS -->
    <path data-muscle="quads" class="muscle-zone" d="
      M80,210 Q72,208 66,218 Q58,246 56,278 Q56,306 58,322
      Q62,328 68,326 Q74,320 78,306 Q82,282 84,258 Q86,234 82,218 Z"/>
    <path data-muscle="quads" class="muscle-zone" d="
      M120,210 Q128,208 134,218 Q142,246 144,278 Q144,306 142,322
      Q138,328 132,326 Q126,320 122,306 Q118,282 116,258 Q114,234 118,218 Z"/>

    <!-- CALVES (front / tibialis) -->
    <path data-muscle="calves" class="muscle-zone" d="
      M58,332 Q54,344 54,364 Q54,384 56,400 Q58,412 64,416
      Q68,412 70,400 Q72,384 72,364 Q72,344 68,332 Z"/>
    <path data-muscle="calves" class="muscle-zone" d="
      M142,332 Q146,344 146,364 Q146,384 144,400 Q142,412 136,416
      Q132,412 130,400 Q128,384 128,364 Q128,344 132,332 Z"/>

    <!-- Hands -->
    <ellipse class="muscle-body-base" cx="24" cy="248" rx="7" ry="10" fill="var(--muscle-base, #1a1a1e)"/>
    <ellipse class="muscle-body-base" cx="176" cy="248" rx="7" ry="10" fill="var(--muscle-base, #1a1a1e)"/>
    <!-- Feet -->
    <ellipse class="muscle-body-base" cx="62" cy="428" rx="10" ry="8" fill="var(--muscle-base, #1a1a1e)"/>
    <ellipse class="muscle-body-base" cx="138" cy="428" rx="10" ry="8" fill="var(--muscle-base, #1a1a1e)"/>
  </svg>`;
}

function getMuscleBodySvgBack(){
  return `<svg viewBox="0 0 200 440" xmlns="http://www.w3.org/2000/svg" class="muscle-body-svg" aria-hidden="true">
    <!-- Body base -->
    <g class="muscle-body-base" fill="var(--muscle-base, #1a1a1e)" stroke="none">
      <ellipse cx="100" cy="32" rx="22" ry="28"/>
      <rect x="90" y="56" width="20" height="16" rx="4"/>
      <!-- Upper arm connectors -->
      <rect x="38" y="106" width="14" height="10" rx="4"/>
      <rect x="148" y="106" width="14" height="10" rx="4"/>
      <!-- Knee connectors -->
      <ellipse cx="66" cy="328" rx="8" ry="6"/>
      <ellipse cx="134" cy="328" rx="8" ry="6"/>
    </g>

    <!-- SHOULDERS (rear delts) -->
    <path data-muscle="shoulders" class="muscle-zone" d="
      M64,76 Q56,70 46,74 Q36,80 34,96 Q34,104 40,110
      L56,106 L64,98 Z"/>
    <path data-muscle="shoulders" class="muscle-zone" d="
      M136,76 Q144,70 154,74 Q164,80 166,96 Q166,104 160,110
      L144,106 L136,98 Z"/>

    <!-- BACK (upper back + lats) -->
    <path data-muscle="back" class="muscle-zone" d="
      M64,76 L98,70 L98,136 Q88,144 74,140 Q62,132 56,116 L64,98 Z"/>
    <path data-muscle="back" class="muscle-zone" d="
      M136,76 L102,70 L102,136 Q112,144 126,140 Q138,132 144,116 L136,98 Z"/>
    <!-- Lower back -->
    <path data-muscle="back" class="muscle-zone" d="
      M78,138 L122,138 L124,190 Q114,200 100,202 Q86,200 76,190 Z"/>

    <!-- TRICEPS -->
    <path data-muscle="triceps" class="muscle-zone" d="
      M40,116 Q34,118 32,134 Q30,154 32,170 Q36,176 42,172
      Q48,160 48,142 Q48,128 44,116 Z"/>
    <path data-muscle="triceps" class="muscle-zone" d="
      M160,116 Q166,118 168,134 Q170,154 168,170 Q164,176 158,172
      Q152,160 152,142 Q152,128 156,116 Z"/>

    <!-- FOREARMS -->
    <path data-muscle="forearms" class="muscle-zone" d="
      M32,176 Q28,182 24,204 Q22,222 22,236 Q24,240 28,238
      Q34,224 38,204 Q40,190 38,176 Z"/>
    <path data-muscle="forearms" class="muscle-zone" d="
      M168,176 Q172,182 176,204 Q178,222 178,236 Q176,240 172,238
      Q166,224 162,204 Q160,190 162,176 Z"/>

    <!-- GLUTES -->
    <path data-muscle="glutes" class="muscle-zone" d="
      M74,194 Q66,198 62,214 Q60,228 66,238 Q74,244 86,240
      Q96,236 98,224 L98,202 Q88,198 78,194 Z"/>
    <path data-muscle="glutes" class="muscle-zone" d="
      M126,194 Q134,198 138,214 Q140,228 134,238 Q126,244 114,240
      Q104,236 102,224 L102,202 Q112,198 122,194 Z"/>

    <!-- HAMSTRINGS -->
    <path data-muscle="hamstrings" class="muscle-zone" d="
      M62,242 Q58,248 56,268 Q54,292 54,312 Q56,322 60,328
      Q66,332 72,328 Q78,318 80,298 Q82,272 80,252 Q78,244 72,242 Z"/>
    <path data-muscle="hamstrings" class="muscle-zone" d="
      M138,242 Q142,248 144,268 Q146,292 146,312 Q144,322 140,328
      Q134,332 128,328 Q122,318 120,298 Q118,272 120,252 Q122,244 128,242 Z"/>

    <!-- CALVES (gastrocnemius) -->
    <path data-muscle="calves" class="muscle-zone" d="
      M58,332 Q54,344 54,364 Q54,384 56,400 Q58,412 64,416
      Q68,414 74,402 Q78,384 78,364 Q78,344 72,332 Z"/>
    <path data-muscle="calves" class="muscle-zone" d="
      M142,332 Q146,344 146,364 Q146,384 144,400 Q142,412 136,416
      Q132,414 126,402 Q122,384 122,364 Q122,344 128,332 Z"/>

    <!-- Hands -->
    <ellipse class="muscle-body-base" cx="24" cy="248" rx="7" ry="10" fill="var(--muscle-base, #1a1a1e)"/>
    <ellipse class="muscle-body-base" cx="176" cy="248" rx="7" ry="10" fill="var(--muscle-base, #1a1a1e)"/>
    <!-- Feet -->
    <ellipse class="muscle-body-base" cx="62" cy="428" rx="10" ry="8" fill="var(--muscle-base, #1a1a1e)"/>
    <ellipse class="muscle-body-base" cx="138" cy="428" rx="10" ry="8" fill="var(--muscle-base, #1a1a1e)"/>
  </svg>`;
}
