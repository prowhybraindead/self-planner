"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Lock, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { loginSchema, type LoginValues } from "@/lib/types";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand/brand-mark";

export default function LoginPage() {
  const { signIn, user } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // If already logged in, redirect to dashboard
  React.useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const onSubmit = async (values: LoginValues) => {
    const { error } = await signIn(values.email, values.password);
    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Đăng nhập thành công!");
    router.push("/dashboard");
  };

  return (
    <>
      <AnimatedBackground />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-5xl"
        >
          <div className="grid items-stretch gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.section
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.45 }}
              className="glass hidden rounded-2xl p-8 lg:flex lg:flex-col lg:justify-between"
            >
              <div>
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-purple/15 ring-1 ring-sky-300/25">
                  <BrandMark className="h-9 w-9" compact />
                </div>
                <h1 className="text-3xl font-semibold text-white">SelfPlanner</h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-dark-300">
                  Plan payments, events, and personal milestones in one calm workspace with realtime insights.
                </p>
              </div>

              <div className="mt-8 space-y-3">
                {[
                  { icon: BarChart3, title: "Realtime Insights", desc: "Exchange rates and monthly outlook at a glance" },
                  { icon: ShieldCheck, title: "Private by Design", desc: "Supabase RLS keeps every row scoped to your account" },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-white/8 p-2">
                        <item.icon className="h-4 w-4 text-sky-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        <p className="text-xs text-dark-300">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>

            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              onSubmit={handleSubmit(onSubmit)}
              className="glass-strong rounded-2xl p-8"
              noValidate
            >
              <div className="mb-8 text-center lg:text-left">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-purple/15 ring-1 ring-sky-300/25 lg:mx-0 lg:hidden">
                  <BrandMark className="h-9 w-9" compact />
                </div>
                <h2 className="text-2xl font-semibold text-white">Đăng nhập</h2>
                <p className="mt-2 text-sm text-dark-300">Welcome back, continue your personal planning flow.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-dark-300">Email</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    icon={<Mail className="h-4 w-4" />}
                    autoComplete="email"
                    {...register("email")}
                  />
                  {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-dark-300">Mật khẩu</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    icon={<Lock className="h-4 w-4" />}
                    autoComplete="current-password"
                    {...register("password")}
                  />
                  {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
                </div>
              </div>

              <Button
                type="submit"
                className="mt-6 w-full"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    Đăng nhập
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="mt-4 text-center text-xs text-dark-400">
                Dự án cá nhân — Deep black starfield UI
              </p>
            </motion.form>
          </div>
        </motion.div>
      </div>
    </>
  );
}
