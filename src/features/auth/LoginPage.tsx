// src/features/auth/LoginPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { Building2, Globe, Lock, Phone } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/auth.store';
import { authApi } from '../../api/auth.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useSystemStore } from '../../store/system.store';

const loginSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Must be exactly 10 digits'),
  password: z.string().min(6, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ── Typewriter ────────────────────────────────────────────────────────────────
function useTypewriter(
  lines: string[],
  typingSpeed = 60,
  pauseDuration = 1800,
  deletingSpeed = 30,
) {
  const [displayed, setDisplayed] = useState('');
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const currentLine = lines[lineIndex];
    const tick = () => {
      if (!isDeleting) {
        if (charIndex < currentLine.length) {
          setDisplayed(currentLine.slice(0, charIndex + 1));
          setCharIndex((c) => c + 1);
          timeoutRef.current = setTimeout(tick, typingSpeed);
        } else {
          timeoutRef.current = setTimeout(() => setIsDeleting(true), pauseDuration);
        }
      } else {
        if (charIndex > 0) {
          setDisplayed(currentLine.slice(0, charIndex - 1));
          setCharIndex((c) => c - 1);
          timeoutRef.current = setTimeout(tick, deletingSpeed);
        } else {
          setIsDeleting(false);
          setLineIndex((i) => (i + 1) % lines.length);
          timeoutRef.current = setTimeout(tick, 300);
        }
      }
    };
    timeoutRef.current = setTimeout(tick, typingSpeed);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charIndex, isDeleting, lineIndex]);

  return displayed;
}

// ── Right panel — dark finance canvas (waves + nodes on blue) ────────────────
const RIGHT_WAVES = [
  { yFactor: 0.30, amp: 0.06,  freq: 0.0090, speed: 0.007,  color: 'rgba(255,255,255,0.10)', lw: 1.5 },
  { yFactor: 0.50, amp: 0.08,  freq: 0.0130, speed: 0.010,  color: 'rgba(147,197,253,0.13)', lw: 2   },
  { yFactor: 0.68, amp: 0.055, freq: 0.0070, speed: 0.006,  color: 'rgba(255,255,255,0.08)', lw: 1.5 },
  { yFactor: 0.82, amp: 0.040, freq: 0.0180, speed: 0.013,  color: 'rgba(167,243,208,0.10)', lw: 1   },
];

type RightDot = { x: number; y: number; vy: number; r: number; alpha: number };

function RightPanelBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const phases = RIGHT_WAVES.map((_, i) => (Math.PI * 2 * i) / RIGHT_WAVES.length);

    const makeDot = (): RightDot => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      vy:    -(Math.random() * 0.35 + 0.08),
      r:     Math.random() * 1.6 + 0.5,
      alpha: Math.random() * 0.30 + 0.08,
    });
    const dots: RightDot[] = Array.from({ length: 55 }, makeDot);

    const frame = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Wave lines
      for (let i = 0; i < RIGHT_WAVES.length; i++) {
        const w = RIGHT_WAVES[i];
        phases[i] += w.speed;
        ctx.beginPath();
        ctx.strokeStyle = w.color;
        ctx.lineWidth   = w.lw;
        const baseY = H * w.yFactor;
        for (let x = 0; x <= W; x += 3) {
          const y = baseY + Math.sin(x * w.freq + phases[i]) * H * w.amp;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Floating dots
      for (const d of dots) {
        d.y += d.vy;
        if (d.y < -8) { d.y = H + 8; d.x = Math.random() * W; d.alpha = Math.random() * 0.30 + 0.08; }
        ctx.save();
        ctx.globalAlpha = d.alpha;
        ctx.fillStyle   = '#ffffff';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    frame();
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
}

// ── Finance background — wave lines + floating data points ────────────────────
type DataDot = {
  x: number; y: number;
  vy: number;
  r: number;
  alpha: number;
  color: string;
};

const DOT_COLORS = ['#3B82F6', '#10B981', '#0EA5E9', '#6366F1', '#059669'];

// Four sine-wave layers: each simulates a different stock / indicator trend
const WAVE_LAYERS = [
  { yFactor: 0.52, amp: 0.075, freq: 0.0105, speed: 0.008,  color: 'rgba(59,130,246,0.25)',  lw: 2   },
  { yFactor: 0.63, amp: 0.060, freq: 0.0165, speed: 0.011,  color: 'rgba(16,185,129,0.20)',  lw: 1.5 },
  { yFactor: 0.74, amp: 0.048, freq: 0.0075, speed: 0.006,  color: 'rgba(99,102,241,0.18)',  lw: 1.5 },
  { yFactor: 0.41, amp: 0.038, freq: 0.0210, speed: 0.014,  color: 'rgba(14,165,233,0.14)',  lw: 1   },
];

function FinanceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Stagger wave phases so they don't all start in sync
    const phases = WAVE_LAYERS.map((_, i) => (Math.PI * 2 * i) / WAVE_LAYERS.length);

    // Floating data-point particles
    const makeDot = (): DataDot => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      vy:    -(Math.random() * 0.40 + 0.10),
      r:     Math.random() * 1.8 + 0.6,
      alpha: Math.random() * 0.40 + 0.15,
      color: DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)],
    });

    const dots: DataDot[] = Array.from({ length: 45 }, makeDot);

    const frame = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Faint graph-paper grid
      ctx.strokeStyle = 'rgba(148,163,184,0.07)';
      ctx.lineWidth   = 1;
      const G = 52;
      for (let x = 0; x < W; x += G) { ctx.beginPath(); ctx.moveTo(x, 0);    ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += G) { ctx.beginPath(); ctx.moveTo(0, y);    ctx.lineTo(W, y); ctx.stroke(); }

      // Animated wave lines
      for (let i = 0; i < WAVE_LAYERS.length; i++) {
        const w = WAVE_LAYERS[i];
        phases[i] += w.speed;

        ctx.beginPath();
        ctx.strokeStyle = w.color;
        ctx.lineWidth   = w.lw;
        const baseY = H * w.yFactor;
        for (let x = 0; x <= W; x += 3) {
          const y = baseY + Math.sin(x * w.freq + phases[i]) * H * w.amp;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Floating data points
      for (const d of dots) {
        d.y += d.vy;
        if (d.y < -8) {
          d.y     = H + 8;
          d.x     = Math.random() * W;
          d.vy    = -(Math.random() * 0.40 + 0.10);
          d.alpha = Math.random() * 0.40 + 0.15;
        }
        ctx.save();
        ctx.globalAlpha = d.alpha;
        ctx.fillStyle   = d.color;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    frame();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const VENDOR_LOGO = 'https://sandhyasofttech.com/navlogo.png';

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [shakeCard, setShakeCard] = useState(false);

  const navigate = useNavigate();
  const setAuth  = useAuthStore((state) => state.setAuth);
  const branding = useSystemStore((state) => state.branding);

  const typedText = useTypewriter([
    'Built for Every Collection.',
    'Trusted for Every Transaction.',
    'Empowering Microfinance Teams.',
    'Secure. Scalable. Reliable.',
  ]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setIsLoading(true);
      const res = await authApi.login(data.phone, data.password);
      setAuth(res.data.user, res.data.accessToken);
      toast.success(`Welcome back, ${res.data.user.name}`);
      if (res.data.user.role === 'superadmin') {
        navigate('/superadmin/dashboard', { replace: true });
      } else if (res.data.user.role === 'admin') {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/agent/dashboard', { replace: true });
      }
    } catch (error: any) {
      setShakeCard(true);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Unable to connect to server. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const appName = branding?.institution?.name || import.meta.env.VITE_APP_NAME || 'Finance System';

  return (
    <>
      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.93) translateY(16px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(22px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; } 50% { opacity: 0; }
        }
        @keyframes orbFloat {
          0%, 100% { transform: translateY(0)     scale(1);    }
          50%       { transform: translateY(-30px)  scale(1.05); }
        }
        @keyframes orbFloatReverse {
          0%, 100% { transform: translateY(0)    scale(1);    }
          50%       { transform: translateY(26px)  scale(0.96); }
        }
        @keyframes btnRipple {
          0%   { box-shadow: 0 0 0 0    rgba(59,130,246,0.55); }
          70%  { box-shadow: 0 0 0 14px rgba(59,130,246,0);    }
          100% { box-shadow: 0 0 0 0    rgba(59,130,246,0);    }
        }
        @keyframes shakeX {
          0%,100% { transform: translateX(0);    }
          15%      { transform: translateX(-9px);  }
          30%      { transform: translateX(9px);   }
          45%      { transform: translateX(-6px);  }
          60%      { transform: translateX(5px);   }
          78%      { transform: translateX(-3px);  }
        }

        .card-enter    { animation: scaleIn     0.55s cubic-bezier(0.34,1.4,0.64,1) both; }
        .card-shake    { animation: shakeX      0.45s ease; }
        .fade-up       { animation: fadeUp      0.5s  ease both; }
        .fade-in-right { animation: fadeInRight 0.6s  ease both; }

        .d-1 { animation-delay: 0.05s; }
        .d-2 { animation-delay: 0.15s; }
        .d-3 { animation-delay: 0.25s; }
        .d-4 { animation-delay: 0.35s; }
        .d-5 { animation-delay: 0.45s; }
        .d-6 { animation-delay: 0.55s; }
        .d-7 { animation-delay: 0.65s; }
        .d-8 { animation-delay: 0.75s; }

        .orb-a { animation: orbFloat        9s  ease-in-out infinite; }
        .orb-b { animation: orbFloatReverse 11s ease-in-out infinite; }

        .typewriter-cursor {
          display: inline-block;
          width: 2px; height: 1.1em;
          background: rgba(255,255,255,0.85);
          margin-left: 3px;
          vertical-align: middle;
          border-radius: 1px;
          animation: blink 0.85s step-start infinite;
        }

        .btn-animated {
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .btn-animated:hover:not(:disabled) {
          transform: scale(1.025) translateY(-2px);
          animation: btnRipple 0.85s ease-out;
        }
        .btn-animated:active:not(:disabled) {
          transform: scale(0.975) translateY(0);
        }
      `}</style>

      <div className="flex min-h-screen flex-col lg:flex-row bg-white overflow-hidden">

        {/* ── Left Section ─────────────────────────────────────────────────────── */}
        <div className="relative flex w-full lg:w-[42%] flex-col justify-center px-5 py-10 sm:px-8 lg:px-16 xl:px-24 overflow-hidden">

          {/* Finance wave + data-point background */}
          <FinanceBackground />

          {/* Soft center spotlight so the card stays crisp */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(255,255,255,0.78) 100%)',
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 mx-auto w-full max-w-md">

            {/* Sandhya Soft vendor brand — above card */}
            <div className="fade-up d-1 mb-8 flex flex-col items-center text-center">
              <img
                src={VENDOR_LOGO}
                alt="Sandhya Soft Technologies"
                className="h-16 w-auto object-contain drop-shadow-sm"
              />
              <p className="mt-2 text-xl font-bold tracking-tight text-slate-800">
                Sandhya Soft Technologies
              </p>
              <p className="mt-0.5 text-xs font-medium tracking-[0.18em] uppercase text-slate-400">
                Microfinance Solutions
              </p>
            </div>

            {/* Login Card */}
            <div
              className={`card-enter rounded-3xl bg-white/92 backdrop-blur-sm border border-slate-200/70 shadow-[0_20px_60px_rgba(15,23,42,0.11)] p-8 sm:p-10 ${shakeCard ? 'card-shake' : ''}`}
              onAnimationEnd={(e) => { if (e.animationName === 'shakeX') setShakeCard(false); }}
            >

              {/* Institution header */}
              <div className="mb-8 fade-up d-2">
                <div className="flex items-center gap-4 mb-5">
                  {branding?.institution?.logoUrl ? (
                    <img
                      src={branding.institution.logoUrl}
                      alt="Logo"
                      className="h-14 w-14 rounded-2xl object-cover shadow-md border border-slate-200 bg-white p-1"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
                      <Building2 className="h-7 w-7 text-blue-700" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">{appName}</h1>
                    <p className="text-sm text-slate-500">Microfinance Management System</p>
                  </div>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                  Sign in to your account
                </h2>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                <div className="fade-up d-3">
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-900">
                    Phone Number
                  </label>
                  <div className="mt-2">
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter your 10-digit phone number"
                      icon={<Phone className="h-4 w-4" />}
                      error={errors.phone?.message}
                      {...register('phone')}
                      disabled={isLoading}
                      maxLength={10}
                    />
                  </div>
                </div>

                <div className="fade-up d-4">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-900">
                    Password
                  </label>
                  <div className="mt-2">
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      icon={<Lock className="h-4 w-4" />}
                      error={errors.password?.message}
                      {...register('password')}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="pt-2 fade-up d-5">
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-semibold shadow-lg shadow-blue-500/30 btn-animated"
                    isLoading={isLoading}
                  >
                    Sign in
                  </Button>
                </div>
              </form>
            </div>

            {/* Mobile vendor mark */}
            <div className="mt-8 text-center lg:hidden fade-up d-6">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">Powered By</p>
              <img src={VENDOR_LOGO} alt="Sandhya Soft" className="h-8 object-contain mx-auto" />
              <p className="mt-1 text-sm font-semibold text-slate-600">Sandhya Soft Technologies</p>
            </div>
          </div>
        </div>

        {/* ── Right Branding Section ────────────────────────────────────────────── */}
        <div className="relative hidden lg:flex flex-1 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-blue-800 to-blue-950 shadow-2xl">

            <RightPanelBackground />

            <div className="orb-a absolute top-10 right-10 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />
            <div className="orb-b absolute bottom-10 left-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.07]">
              <img src="/logo.png" alt="" className="w-[420px] xl:w-[520px] object-contain" />
            </div>

            {/* Content */}
            <div className="relative flex h-full items-center justify-center px-10 xl:px-16">
              <div className="max-w-lg w-full text-center">

                {/* ── Vendor block — top ── */}
                <div className="fade-in-right d-1">
                  <p className="text-[10px] tracking-[0.35em] uppercase text-white/60 mb-3">
                    Powered By
                  </p>
                  <img
                    src={VENDOR_LOGO}
                    alt="Sandhya Soft Technologies"
                    className="h-20 xl:h-24 object-contain brightness-0 invert mx-auto"
                  />
                  <p className="mt-3 text-xl xl:text-2xl font-bold text-white tracking-tight">
                    Sandhya Soft Technologies
                  </p>
                  <p className="mt-0.5 text-xs text-white/70 tracking-[0.22em] uppercase">
                    Microfinance Solutions
                  </p>
                </div>

                {/* Thin divider */}
                <div className="fade-in-right d-2 my-8 mx-auto w-16 h-px bg-white/20 rounded-full" />

                {/* ── Typewriter ── */}
                <h1 className="fade-in-right d-3 text-2xl xl:text-3xl font-bold leading-snug text-white min-h-[3.5rem] flex items-center justify-center">
                  <span>{typedText}</span>
                  <span className="typewriter-cursor" aria-hidden="true" />
                </h1>

                {/* Description — smaller */}
                <p className="fade-in-right d-4 mt-5 text-sm xl:text-base leading-7 text-white/80 max-w-sm mx-auto">
                  Secure, reliable, and scalable digital platform for
                  microfinance operations, collections, lending,
                  and customer management.
                </p>

                {/* Support — equal-width row */}
                <div className="fade-up d-5 mt-10">
                  <p className="text-[10px] tracking-[0.35em] uppercase text-white/60 mb-4">Support</p>
                  <div className="flex flex-col w-full gap-3">
                    <a
                      href="tel:9689974617"
                      className="flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-white px-4 py-3 text-sm text-black transition-all duration-200 hover:bg-slate-100"
                    >
                      <Phone className="h-4 w-4 text-black shrink-0" />
                      <span className="font-semibold tracking-wide">9689974617</span>
                    </a>
                    <a
                      href="https://sandhyasofttech.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-2.5 rounded-2xl bg-white px-4 py-3 text-sm text-black transition-all duration-200 hover:bg-slate-100"
                    >
                      <Globe className="h-4 w-4 text-black shrink-0" />
                      <span className="font-semibold tracking-wide">sandhyasofttech.com</span>
                    </a>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
