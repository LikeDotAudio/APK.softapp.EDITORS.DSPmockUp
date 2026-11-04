// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { STAGE_TYPES } from './dspModel.js';

export function renderDspSignalChainSvg(model, options = {}) {
  const { selectedStageId = null } = options;

  const nodeWidth = 120;
  const nodeHeight = 80;
  const nodeGap = 35;
  const startX = 140;
  const startY = 80;

  const totalWidth = startX + model.stages.length * (nodeWidth + nodeGap) + 160;
  const totalHeight = 240;

  // Render input header block
  let inputsSvg = `
    <g class="dsp-io-terminal" transform="translate(20, ${startY - 15})">
      <rect width="90" height="${nodeHeight + 30}" rx="6" fill="#121A2F" stroke="#4A9EFF" stroke-width="1.5"/>
      <text x="45" y="22" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#4A9EFF">INPUTS</text>
      <text x="45" y="42" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="10" fill="#F0F4F8">${model.inputs.length} Ch</text>
      <text x="45" y="60" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="9" fill="#8B9BB4">Analog + Dante</text>
    </g>
    <!-- Wire connecting input to first stage -->
    <path d="M 110 ${startY + nodeHeight / 2} L ${startX} ${startY + nodeHeight / 2}" fill="none" stroke="#4A9EFF" stroke-width="2.5"/>
  `;

  // Render stages
  const stagesSvg = model.stages.map((stg, idx) => {
    const isSelected = stg.id === selectedStageId;
    const def = STAGE_TYPES[stg.type] || STAGE_TYPES.PEQ;
    const x = startX + idx * (nodeWidth + nodeGap);
    const y = startY;

    // Connect to next stage or output
    const nextX = x + nodeWidth + nodeGap;
    const wireSvg = `
      <path d="M ${x + nodeWidth} ${y + nodeHeight / 2} L ${nextX} ${y + nodeHeight / 2}" fill="none" stroke="${stg.bypassed ? '#4D5E80' : def.color}" stroke-width="${stg.bypassed ? 1.5 : 2.5}" stroke-dasharray="${stg.bypassed ? '4,4' : 'none'}"/>
    `;

    return `
      <g class="dsp-stage-node" data-stage-id="${stg.id}" transform="translate(${x}, ${y})" style="cursor: pointer;">
        <!-- Card Body -->
        <rect width="${nodeWidth}" height="${nodeHeight}" rx="6"
          fill="${isSelected ? '#1E2A45' : '#121A2F'}"
          stroke="${isSelected ? '#F4902C' : stg.bypassed ? '#4D5E80' : def.color}"
          stroke-width="${isSelected ? 2.5 : 1.5}"
          filter="drop-shadow(0 2px 5px rgba(0,0,0,0.5))"
          opacity="${stg.bypassed ? 0.6 : 1.0}"
        />
        <!-- Stage Type Icon & Label -->
        <text x="12" y="24" font-size="14">${def.icon}</text>
        <text x="${nodeWidth - 12}" y="20" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="9" fill="#8B9BB4">#${idx + 1}</text>
        <text x="12" y="44" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#F0F4F8" clip-path="url(#text-clip)">${stg.label}</text>
        
        <!-- Status indicator pill -->
        <rect x="12" y="54" width="${stg.bypassed ? 48 : 42}" height="16" rx="3" fill="${stg.bypassed ? '#2D3D60' : 'rgba(16, 185, 129, 0.2)'}"/>
        <text x="16" y="66" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="600" fill="${stg.bypassed ? '#8B9BB4' : '#10B981'}">
          ${stg.bypassed ? 'BYPASS' : 'ACTIVE'}
        </text>
      </g>
      ${wireSvg}
    `;
  }).join('');

  // Render output terminal block
  const outX = startX + model.stages.length * (nodeWidth + nodeGap);
  let outputsSvg = `
    <g class="dsp-io-terminal" transform="translate(${outX}, ${startY - 15})">
      <rect width="90" height="${nodeHeight + 30}" rx="6" fill="#121A2F" stroke="#22C55E" stroke-width="1.5"/>
      <text x="45" y="22" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="11" font-weight="700" fill="#22C55E">OUTPUTS</text>
      <text x="45" y="42" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="10" fill="#F0F4F8">${model.outputs.length} Ch</text>
      <text x="45" y="60" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="9" fill="#8B9BB4">PA / Aux / Rec</text>
    </g>
  `;

  return `
    <svg id="dsp-canvas-svg" width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#080C16"/>
      ${inputsSvg}
      ${stagesSvg}
      ${outputsSvg}
    </svg>
  `;
}
