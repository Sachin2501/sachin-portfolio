import React, { useEffect, useRef, memo } from 'react';

/**
 * SectionTechBackground renders a high-performance, interactive, and dynamic
 * technical background tailored for software engineering and AI/ML portfolios.
 *
 * Types:
 * - 'home': Quantum Neural Mesh, floating technical glyphs & interactive particle constellation
 * - 'about': Cybernetic Printed Circuit Board (PCB) traces & logic gate blueprint
 * - 'experience': Distributed microservice topology, data packet telemetry & pipeline traces
 * - 'education': Geometric matrix lattice, coordinate axes & calculus vector wave harmonics
 * - 'certifications': Cryptographic guilloche waves, security rosette seals & verified watermark grid
 * - 'skills': Multi-layer AI neural network synapses & tensor weight connections
 * - 'projects': IDE terminal dot matrix, software architecture schematic & crosshair telemetry
 * - 'github': Topological commit graph, branching splines & pulsating commit nodes
 * - 'contact': Global satellite radar beacon, concentric signal waves & geographic telemetry
 */

// Dedicated section background images attached by the user
export const SECTION_BG_IMAGES = {
  home: '/assets/aistudio/hero-bg_bda27889.png',
  about: '/assets/aistudio/about-bg_1565d958.png',
  experience: '/assets/aistudio/experience-bg_17909b7b.png',
  education: '/assets/aistudio/education-bg_97508a8e.png',
  certifications: '/assets/aistudio/certifications-bg_e6dbc24b.png',
  skills: '/assets/aistudio/skills-bg_710d8f28.png',
  projects: '/assets/aistudio/projects-bg_f9111c06.png',
  github: '/assets/aistudio/github-contribs-bg_407a01a1.png',
  contact: '/assets/aistudio/certifications-bg_e6dbc24b.png',
};

export const SectionTechBackground = memo(({ type = 'home' }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const isVisibleRef = useRef(false);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });
  const bgImage = SECTION_BG_IMAGES[type] || SECTION_BG_IMAGES.home;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;

    // Track mouse on section container
    const parentSection = container.closest('section') || container;

    const handlePointerMove = (e) => {
      const rect = parentSection.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseRef.current = { x, y, active: true };

      // Update CSS variables for radial spotlight glow
      const xPercent = (x / rect.width) * 100;
      const yPercent = (y / rect.height) * 100;
      container.style.setProperty('--spotlight-x', `${xPercent.toFixed(1)}%`);
      container.style.setProperty('--spotlight-y', `${yPercent.toFixed(1)}%`);
    };

    const handlePointerLeave = () => {
      mouseRef.current.active = false;
      container.style.setProperty('--spotlight-x', '50%');
      container.style.setProperty('--spotlight-y', '50%');
    };

    parentSection.addEventListener('pointermove', handlePointerMove, { passive: true });
    parentSection.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    // Handle high DPI resizing
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);
    resizeCanvas();

    // Section Visibility Observer (save CPU when not on screen)
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisibleRef.current = entry.isIntersecting;
        });
      },
      { threshold: 0.05 }
    );
    visibilityObserver.observe(parentSection);

    // ==========================================
    // THEME-SPECIFIC GENERATORS & DATA STRUCTURES
    // ==========================================
    const isDarkMode = () => document.body.classList.contains('dark-mode');

    // 1. Home: Constellation Particles & Tech Glyphs
    const particles = Array.from({ length: 42 }, () => ({
      x: Math.random() * (width || 1200),
      y: Math.random() * (height || 700),
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radius: Math.random() * 2 + 1.2,
      glyph: ['{ }', '01', '</>', 'AI', 'λ', '0x1F', 'ML', 'const'][Math.floor(Math.random() * 8)],
      showGlyph: Math.random() > 0.65,
    }));

    // 2. About: Circuit Traces & Microchips
    const circuitLines = Array.from({ length: 14 }, (_, i) => {
      const startX = (i / 14) * (width || 1200) + (Math.random() * 40 - 20);
      return {
        x: startX,
        y: 0,
        turnY: Math.random() * 300 + 80,
        turnX: startX + (Math.random() > 0.5 ? 60 : -60),
        pulseProgress: Math.random(),
        speed: 0.003 + Math.random() * 0.004,
      };
    });

    // 3. Experience: Microservice Bus & Flow Packets
    const experienceNodes = Array.from({ length: 8 }, (_, i) => ({
      x: ((i + 1) / 9) * (width || 1200),
      y: (height || 600) * (0.2 + (i % 3) * 0.25),
      pulse: Math.random(),
    }));

    // 4. Skills: Neural Network Layers
    const neuralLayers = [
      Array.from({ length: 4 }, (_, i) => ({ xRel: 0.15, yRel: 0.2 + i * 0.2 })),
      Array.from({ length: 6 }, (_, i) => ({ xRel: 0.38, yRel: 0.15 + i * 0.14 })),
      Array.from({ length: 6 }, (_, i) => ({ xRel: 0.62, yRel: 0.15 + i * 0.14 })),
      Array.from({ length: 3 }, (_, i) => ({ xRel: 0.85, yRel: 0.25 + i * 0.25 })),
    ];

    // 5. GitHub: Commit Nodes & Branch Lines
    const gitNodes = Array.from({ length: 24 }, (_, i) => ({
      x: ((i + 1) / 25) * (width || 1200),
      branch: i % 3, // 0: main, 1: dev, 2: feature
      pulse: Math.random() * Math.PI * 2,
    }));

    // 6. Contact: Radar Beacon Angle & Waves
    let radarAngle = 0;
    const radarWaves = [0.1, 0.35, 0.6, 0.85];

    let time = 0;

    // ==========================================
    // RENDER LOOP
    // ==========================================
    const render = () => {
      if (!isVisibleRef.current) {
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      const dark = isDarkMode();
      const mouse = mouseRef.current;

      // Color paletting for technical elegance
      const primaryLineColor = dark ? 'rgba(56, 189, 248, 0.13)' : 'rgba(59, 130, 246, 0.08)';
      const secondaryLineColor = dark ? 'rgba(139, 92, 246, 0.11)' : 'rgba(99, 102, 241, 0.06)';
      const accentNodeColor = dark ? '#38bdf8' : '#3b82f6';
      const nodeAlpha = dark ? 0.35 : 0.22;

      // ----------------------------------------------------
      // SECTION 1: HOME (Quantum Neural Constellation & Code)
      // ----------------------------------------------------
      if (type === 'home') {
        // Draw constellation connections
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          // Interactive mouse gravity repel
          if (mouse.active) {
            const dx = mouse.x - p.x;
            const dy = mouse.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 140) {
              p.x -= (dx / dist) * 0.9;
              p.y -= (dy / dist) * 0.9;
            }
          }

          // Node circle
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.45)';
          ctx.fill();

          // Technical text token
          if (p.showGlyph) {
            ctx.font = '10px monospace';
            ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.35)';
            ctx.fillText(p.glyph, p.x + 6, p.y + 3);
          }

          // Connective lines
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 110) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = dark
                ? `rgba(255, 255, 255, ${0.15 * (1 - dist / 110)})`
                : `rgba(255, 255, 255, ${0.22 * (1 - dist / 110)})`;
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }
        }
      }

      // ----------------------------------------------------
      // SECTION 2: ABOUT (Cybernetic PCB Traces & Logic Gates)
      // ----------------------------------------------------
      else if (type === 'about') {
        // Subtle blueprint crosshairs at 120px grid
        ctx.strokeStyle = primaryLineColor;
        ctx.lineWidth = 0.7;

        for (let x = 60; x < width; x += 140) {
          for (let y = 60; y < height; y += 140) {
            ctx.beginPath();
            ctx.moveTo(x - 5, y);
            ctx.lineTo(x + 5, y);
            ctx.moveTo(x, y - 5);
            ctx.lineTo(x, y + 5);
            ctx.stroke();
          }
        }

        // Circuit board traces with pulses
        circuitLines.forEach((trace) => {
          trace.pulseProgress = (trace.pulseProgress + trace.speed) % 1;

          ctx.beginPath();
          ctx.moveTo(trace.x, 0);
          ctx.lineTo(trace.x, trace.turnY);
          ctx.lineTo(trace.turnX, trace.turnY + 80);
          ctx.lineTo(trace.turnX, height);
          ctx.strokeStyle = secondaryLineColor;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Circuit node pad
          ctx.beginPath();
          ctx.arc(trace.turnX, trace.turnY + 80, 2.8, 0, Math.PI * 2);
          ctx.fillStyle = accentNodeColor;
          ctx.globalAlpha = nodeAlpha;
          ctx.fill();
          ctx.globalAlpha = 1;

          // Glowing pulse packet
          const totalY = height;
          const currentY = trace.pulseProgress * totalY;
          let currentX = trace.x;
          if (currentY > trace.turnY && currentY <= trace.turnY + 80) {
            const ratio = (currentY - trace.turnY) / 80;
            currentX = trace.x + (trace.turnX - trace.x) * ratio;
          } else if (currentY > trace.turnY + 80) {
            currentX = trace.turnX;
          }

          ctx.beginPath();
          ctx.arc(currentX, currentY, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = accentNodeColor;
          ctx.shadowColor = accentNodeColor;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      }

      // ----------------------------------------------------
      // SECTION 3: EXPERIENCE (System Telemetry & Data Bus)
      // ----------------------------------------------------
      else if (type === 'experience') {
        // Horizontal server bus lines
        const busY1 = height * 0.32;
        const busY2 = height * 0.68;

        ctx.strokeStyle = primaryLineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, busY1);
        ctx.lineTo(width, busY1);
        ctx.moveTo(0, busY2);
        ctx.lineTo(width, busY2);
        ctx.stroke();

        // Traveling data packets along bus
        const packetX1 = ((time * 65) % (width + 100)) - 50;
        const packetX2 = width - (((time * 55) % (width + 100)) - 50);

        ctx.fillStyle = accentNodeColor;
        ctx.shadowColor = accentNodeColor;
        ctx.shadowBlur = 10;
        ctx.fillRect(packetX1, busY1 - 2.5, 18, 5);
        ctx.fillRect(packetX2, busY2 - 2.5, 18, 5);
        ctx.shadowBlur = 0;

        // Experience nodes with radiating pulse rings
        experienceNodes.forEach((node) => {
          node.pulse = (node.pulse + 0.02) % 1;

          ctx.beginPath();
          ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = dark ? 'rgba(56, 189, 248, 0.4)' : 'rgba(59, 130, 246, 0.3)';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(node.x, node.y, 4 + node.pulse * 18, 0, Math.PI * 2);
          ctx.strokeStyle = dark
            ? `rgba(56, 189, 248, ${0.35 * (1 - node.pulse)})`
            : `rgba(59, 130, 246, ${0.25 * (1 - node.pulse)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }

      // ----------------------------------------------------
      // SECTION 4: EDUCATION (Algorithmic Coordinate Mesh)
      // ----------------------------------------------------
      else if (type === 'education') {
        // Isometric lattice triangles / diamond grid
        const step = 85;
        ctx.strokeStyle = primaryLineColor;
        ctx.lineWidth = 0.65;

        for (let x = 0; x < width + step; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x - height * 0.5, height);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + height * 0.5, height);
          ctx.stroke();
        }

        // Sinusoidal wave harmonics
        ctx.beginPath();
        ctx.strokeStyle = secondaryLineColor;
        ctx.lineWidth = 1.2;
        for (let x = 0; x <= width; x += 15) {
          const y = height * 0.5 + Math.sin(x * 0.012 + time) * 38;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // ----------------------------------------------------
      // SECTION 5: CERTIFICATIONS (Cryptographic Guilloche Waves)
      // ----------------------------------------------------
      else if (type === 'certifications') {
        const centerY = height * 0.5;
        const wavesCount = 5;

        for (let w = 0; w < wavesCount; w++) {
          const freq = 0.008 + w * 0.003;
          const phase = time * 0.8 + w * 1.2;
          const amp = 30 + w * 12;

          ctx.beginPath();
          ctx.strokeStyle = w % 2 === 0 ? primaryLineColor : secondaryLineColor;
          ctx.lineWidth = 0.85;

          for (let x = 0; x <= width; x += 12) {
            const y = centerY + Math.sin(x * freq + phase) * Math.cos(x * 0.003) * amp;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        // Cryptographic verified rosette mark in corner
        const sealX = width - 110;
        const sealY = 90;
        if (sealX > 0 && sealY > 0) {
          ctx.beginPath();
          ctx.arc(sealX, sealY, 32, 0, Math.PI * 2);
          ctx.strokeStyle = dark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.15)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // ----------------------------------------------------
      // SECTION 6: SKILLS (AI Synaptic Neural Network Matrix)
      // ----------------------------------------------------
      else if (type === 'skills') {
        // Draw synaptic connections between adjacent layers
        for (let l = 0; l < neuralLayers.length - 1; l++) {
          const layerA = neuralLayers[l];
          const layerB = neuralLayers[l + 1];

          layerA.forEach((nodeA) => {
            const xA = nodeA.xRel * width;
            const yA = nodeA.yRel * height;

            layerB.forEach((nodeB) => {
              const xB = nodeB.xRel * width;
              const yB = nodeB.yRel * height;

              // Distance to mouse for interactive synapse highlight
              let highlight = 0;
              if (mouse.active) {
                const midX = (xA + xB) / 2;
                const midY = (yA + yB) / 2;
                const d = Math.hypot(mouse.x - midX, mouse.y - midY);
                if (d < 160) highlight = 1 - d / 160;
              }

              ctx.beginPath();
              ctx.moveTo(xA, yA);
              ctx.lineTo(xB, yB);
              ctx.strokeStyle = highlight > 0
                ? (dark ? `rgba(56, 189, 248, ${0.15 + highlight * 0.35})` : `rgba(59, 130, 246, ${0.1 + highlight * 0.25})`)
                : primaryLineColor;
              ctx.lineWidth = highlight > 0 ? 1.4 : 0.65;
              ctx.stroke();
            });
          });
        }

        // Draw neuron nodes
        neuralLayers.forEach((layer) => {
          layer.forEach((node) => {
            const nx = node.xRel * width;
            const ny = node.yRel * height;

            ctx.beginPath();
            ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = dark ? '#38bdf8' : '#3b82f6';
            ctx.globalAlpha = dark ? 0.45 : 0.25;
            ctx.fill();
            ctx.globalAlpha = 1;
          });
        });
      }

      // ----------------------------------------------------
      // SECTION 7: PROJECTS (Terminal Grid & Architecture Frames)
      // ----------------------------------------------------
      else if (type === 'projects') {
        const gridSize = 55;
        ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';

        for (let x = gridSize; x < width; x += gridSize) {
          for (let y = gridSize; y < height; y += gridSize) {
            ctx.fillRect(x - 1, y - 1, 2, 2);
          }
        }

        // Blueprint technical brackets
        ctx.strokeStyle = primaryLineColor;
        ctx.lineWidth = 1;
        const bSize = 25;
        // Top-left bracket
        ctx.strokeRect(35, 35, bSize, bSize);
        // Bottom-right bracket
        ctx.strokeRect(width - 60, height - 60, bSize, bSize);
      }

      // ----------------------------------------------------
      // SECTION 8: GITHUB (Topological Git Commit Mesh)
      // ----------------------------------------------------
      else if (type === 'github') {
        const branchHeights = [height * 0.35, height * 0.5, height * 0.65];

        // Draw 3 horizontal git branch lines
        branchHeights.forEach((by, idx) => {
          ctx.beginPath();
          ctx.moveTo(0, by);
          ctx.lineTo(width, by);
          ctx.strokeStyle = idx === 0 ? primaryLineColor : secondaryLineColor;
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        // Draw commit nodes with connecting branch curves
        gitNodes.forEach((node) => {
          const ny = branchHeights[node.branch];
          node.pulse = (node.pulse + 0.03) % (Math.PI * 2);

          ctx.beginPath();
          ctx.arc(node.x, ny, 3, 0, Math.PI * 2);
          ctx.fillStyle = accentNodeColor;
          ctx.globalAlpha = 0.35;
          ctx.fill();
          ctx.globalAlpha = 1;

          // Pulse wave
          const ringRadius = 3 + Math.sin(node.pulse) * 4;
          if (ringRadius > 3) {
            ctx.beginPath();
            ctx.arc(node.x, ny, ringRadius, 0, Math.PI * 2);
            ctx.strokeStyle = accentNodeColor;
            ctx.globalAlpha = 0.2;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        });
      }

      // ----------------------------------------------------
      // SECTION 9: CONTACT (Global Satellite Radar Beacon)
      // ----------------------------------------------------
      else if (type === 'contact') {
        const radarCenter = {
          x: width * 0.85,
          y: height * 0.5,
        };
        const maxRadius = Math.min(width, height) * 0.65;

        // Concentric radar waves
        radarWaves.forEach((wave, idx) => {
          radarWaves[idx] = (wave + 0.0035) % 1;
          const r = radarWaves[idx] * maxRadius;

          ctx.beginPath();
          ctx.arc(radarCenter.x, radarCenter.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = dark
            ? `rgba(56, 189, 248, ${0.25 * (1 - radarWaves[idx])})`
            : `rgba(59, 130, 246, ${0.18 * (1 - radarWaves[idx])})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        // Sweeping radar scan line
        radarAngle = (radarAngle + 0.015) % (Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(radarCenter.x, radarCenter.y);
        ctx.lineTo(
          radarCenter.x + Math.cos(radarAngle) * maxRadius,
          radarCenter.y + Math.sin(radarAngle) * maxRadius
        );
        ctx.strokeStyle = dark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(59, 130, 246, 0.14)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      parentSection.removeEventListener('pointermove', handlePointerMove);
      parentSection.removeEventListener('pointerleave', handlePointerLeave);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, [type]);

  return (
    <div
      ref={containerRef}
      className={`section-tech-bg section-tech-${type}`}
      aria-hidden="true"
    >
      {/* Dedicated Section Background Image */}
      {bgImage && (
        <div
          className="section-tech-img-layer"
          style={{ backgroundImage: `url("${bgImage}")` }}
        />
      )}

      {/* Cybernetic depth scrim to preserve readability & visual hierarchy */}
      <div className="section-tech-scrim" />

      {/* Interactive cursor spotlight layer */}
      <div className="section-tech-spotlight" />

      {/* Cybernetic telemetry watermark / coordinate markers */}
      <div className="section-tech-telemetry">
        <span className="tech-coord-tl">[0x00:{type.toUpperCase()}]</span>
        <span className="tech-coord-tr">SEC_SYS://STATUS:OK</span>
      </div>

      {/* Dynamic 60fps canvas renderer */}
      <canvas ref={canvasRef} className="section-tech-canvas" />
    </div>
  );
});

export default SectionTechBackground;
