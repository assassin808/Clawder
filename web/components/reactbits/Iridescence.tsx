"use client";

import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';

interface IridescenceProps {
  color?: [number, number, number];
  speed?: number;
  amplitude?: number;
  mouseReact?: boolean;
  className?: string;
}

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uColor;
uniform vec3 uResolution;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uSpeed;

varying vec2 vUv;

void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;

  uv += (uMouse - vec2(0.5)) * uAmplitude;

  float d = -uTime * 0.2 * uSpeed;
  float a = 0.0;
  for (float i = 0.0; i < 6.0; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  d += uTime * 0.1 * uSpeed;
  
  // Create a watery mix of brand colors - more visible but still airy
  vec3 color1 = vec3(0.439, 0.631, 1.0);   // #70A1FF (Secondary)
  vec3 color2 = vec3(1.0, 0.498, 0.549);   // #FF7F8C (Primary)
  vec3 color3 = vec3(0.95, 0.95, 0.95);    // Very light gray for depth
  
  // Fluid movement with more color variation
  float mixFactor = cos(a * 0.25 + d * 0.15) * 0.5 + 0.5;
  vec3 baseCol = mix(color1, color2, mixFactor);
  baseCol = mix(baseCol, color3, cos(d * 0.5) * 0.3 + 0.3);
  
  // Add a "water light" shimmer effect - small scale, higher contrast
  float shimmer = cos(uv.x * 6.0 + d) * cos(uv.y * 6.0 + a) * 0.15 + 0.85;
  vec3 col = baseCol * shimmer;
  
  // Blend with white but keep enough saturation to be visible
  col = mix(vec3(1.0), col, 0.5) * uColor;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export function Iridescence({
  color = [1, 1, 1],
  speed = 1.0,
  amplitude = 0.1,
  mouseReact = true,
  className,
  ...rest
}: IridescenceProps) {
  const ctnDom = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (!ctnDom.current) return;
    const ctn = ctnDom.current;
    const renderer = new Renderer({ alpha: true });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    let program: Program;

    function resize() {
      const scale = 1;
      renderer.setSize(ctn.offsetWidth * scale, ctn.offsetHeight * scale);
      if (program) {
        program.uniforms.uResolution.value = new Color(
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / gl.canvas.height
        );
      }
    }
    window.addEventListener('resize', resize, false);
    resize();

    const geometry = new Triangle(gl);
    program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Color(...color) },
        uResolution: {
          value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height)
        },
        uMouse: { value: new Float32Array([mousePos.current.x, mousePos.current.y]) },
        uAmplitude: { value: amplitude },
        uSpeed: { value: speed }
      }
    });

    const mesh = new Mesh(gl, { geometry, program });
    let animateId: number;

    function update(t: number) {
      animateId = requestAnimationFrame(update);
      program.uniforms.uTime.value = t * 0.001;
      renderer.render({ scene: mesh });
    }
    animateId = requestAnimationFrame(update);
    ctn.appendChild(gl.canvas);

    function handleMouseMove(e: MouseEvent) {
      const rect = ctn.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      mousePos.current = { x, y };
      program.uniforms.uMouse.value[0] = x;
      program.uniforms.uMouse.value[1] = y;
    }
    if (mouseReact) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      cancelAnimationFrame(animateId);
      window.removeEventListener('resize', resize);
      if (mouseReact) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      if (ctn.contains(gl.canvas)) {
        ctn.removeChild(gl.canvas);
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [color, speed, amplitude, mouseReact]);

  return <div ref={ctnDom} className={className} {...rest} />;
}
