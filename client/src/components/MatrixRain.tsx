// client/src/components/MatrixRain.tsx
//
// Canvas-based matrix rain background animation.
// Retro 80s × Matrix aesthetic: falling katakana + ASCII + digits
// on a pure-black background, 85% matrix green / 15% neon orange.
// Rendered as a fixed full-screen canvas behind all content.

import { useEffect, useRef } from "react";

// Katakana half-width + common ASCII for authentic matrix feel
const CHARS =
  "ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>[]{}|\\/:;";

const FONT_SIZE = 14;
const INTERVAL_MS = 50;

interface MatrixRainProps {
  /** Opacity of the entire canvas (0–1). Default: 0.07 */
  opacity?: number;
}

export function MatrixRain({ opacity = 0.07 }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: ReturnType<typeof setInterval>;

    const setSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setSize();
    window.addEventListener("resize", setSize);

    const columns = Math.ceil(window.innerWidth / FONT_SIZE);
    // Each column tracks how far down its current raindrop has fallen
    const drops: number[] = Array.from({ length: columns }, () =>
      Math.floor(Math.random() * -50),
    );

    const draw = () => {
      // Fade trail — semi-transparent black fill creates the trailing effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${FONT_SIZE}px 'JetBrains Mono', monospace`;

      for (let i = 0; i < drops.length; i++) {
        const y = drops[i] * FONT_SIZE;
        if (y < 0) {
          drops[i]++;
          continue;
        }

        // Pick a random character
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];

        // Lead character: bright white-green (the "head" of the drop)
        if (drops[i] * FONT_SIZE > 0 && drops[i] * FONT_SIZE < canvas.height) {
          // 15% chance of orange accent drop for visual variety
          const isOrange = Math.random() < 0.15;

          if (y === drops[i] * FONT_SIZE) {
            // Bright head
            ctx.fillStyle = isOrange
              ? "rgba(255, 120, 0, 0.95)"
              : "rgba(180, 255, 180, 0.95)";
          } else {
            ctx.fillStyle = isOrange
              ? "rgba(255, 80, 0, 0.55)"
              : "rgba(0, 255, 65, 0.55)";
          }

          ctx.fillText(char, i * FONT_SIZE, y);
        }

        // Reset drop when it goes off-screen
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    animationId = setInterval(draw, INTERVAL_MS);

    return () => {
      clearInterval(animationId);
      window.removeEventListener("resize", setSize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ opacity }}
      aria-hidden="true"
    />
  );
}
