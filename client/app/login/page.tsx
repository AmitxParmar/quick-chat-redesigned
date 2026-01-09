"use client";
import React from "react";
import { useLogin } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginSchema } from "@/schemas/auth";
import { AxiosError } from "axios";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const DEMO_ACCOUNTS = [
  { waId: "919937320320", password: "demo123" },
  { waId: "911234567890", password: "demo123" },
];

interface ApiErrorResponse {
  message: string;
}

function LoginPage() {
  const router = useRouter();
  const { mutate: login, isPending, error, data } = useLogin();

  // handle default form values and form validations
  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { waId: "", password: "" },
  });

  // handle form submission
  const onSubmit = (values: LoginSchema) => {
    const cleaned = {
      waId: values.waId.replace(/\s+/g, ""),
      password: values.password.replace(/\s+/g, ""),
    };
    login(cleaned, {
      onSuccess: () => {
        router.push("/");
      },
    });
  };


  // handle demo account selection: add demo account to inputs and login
  const handleDemoClick = (demo: { waId: string; password: string }) => {
    form.setValue("waId", demo.waId);
    form.setValue("password", demo.password);

    // Clear any validation errors (e.g. from onBlur)
    form.clearErrors();

    // Automatically submit with valid demo credentials
    onSubmit(demo);
  };


  // get error message from axios.response.data object and return it.
  const getErrorMessage = () => {
    if (!error) return null;

    if (error instanceof AxiosError) {
      const errorData = error.response?.data as ApiErrorResponse;
      if (errorData?.message) {
        return errorData.message;
      }
    }
    return "Login failed";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background transition-colors">
      <div className="w-full max-w-sm bg-card rounded-xl shadow-lg p-8 flex flex-col items-center border border-border">
        <div className="flex items-center gap-2 mb-6">
          <div className="rounded-full p-2 bg-primary">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              className="w-8 h-8"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="16" cy="16" r="16" fill="#25D366" />
              <path
                d="M23.5 17.5c-.4-.2-2.3-1.1-2.6-1.2-.3-.1-.5-.2-.7.2-.2.4-.8 1.2-1 1.4-.2.2-.4.3-.8.1-.4-.2-1.7-.6-3.2-2-1.2-1.1-2-2.4-2.2-2.8-.2-.4 0-.6.2-.8.2-.2.4-.5.6-.7.2-.2.2-.4.3-.7.1-.2 0-.5-.1-.7-.1-.2-.7-1.7-1-2.3-.3-.6-.6-.5-.8-.5-.2 0-.5 0-.7 0-.2 0-.7.1-1.1.5-.4.4-1.4 1.3-1.4 3.1 0 1.8 1.4 3.5 1.6 3.7.2.2 2.7 4.1 6.6 5.6.9.3 1.6.5 2.1.6.9.1 1.7.1 2.3.1.7 0 2.3-.7 2.6-1.5.3-.8.3-1.5.2-1.6-.1-.1-.4-.2-.8-.4z"
                fill="#fff"
              />
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-tight text-primary">
            WhatsApp
          </span>
        </div>
        <h2 className="text-xl font-semibold mb-4 text-primary-foreground">
          Login
        </h2>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="w-full flex flex-col gap-4"
            autoComplete="off"
          >
            <FormField
              control={form.control}
              name="waId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WA ID</FormLabel>
                  <FormControl>
                    <Input placeholder="WA ID" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Logging in..." : "Login"}
            </Button>
            {error && (
              <div className="text-destructive text-sm text-center mt-1">
                {getErrorMessage()}
              </div>
            )}
            {data && data.success && (
              <div className="text-green-600 dark:text-green-400 text-sm text-center mt-1">
                Login successful!
              </div>
            )}
          </form>
        </Form>
        <div className="w-full mt-6">
          <div className="text-muted-foreground text-xs mb-2 text-center">
            Demo Accounts
          </div>
          <div className="flex flex-col gap-2">
            {DEMO_ACCOUNTS.map((demo) => (
              <button
                key={demo.waId}
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 border border-accent rounded bg-accent hover:bg-accent/80 text-accent-foreground text-sm transition"
                onClick={() => handleDemoClick(demo)}
              >
                <span>
                  <span className="font-medium">waId:</span> {demo.waId}
                </span>
                <span>
                  <span className="font-medium">password:</span> {demo.password}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="w-full mt-6 text-sm text-center text-muted-foreground">
          New to WhatsApp?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
