"use client";
import React from "react";
import { useRegister } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterSchema } from "@/schemas/auth";
import { isAxiosAuthError, type AxiosAuthError } from "@/types";
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

function RegisterPage() {
  const router = useRouter();
  const { mutate: register, isPending, error, data } = useRegister();

  // handle default form values and form validations
  const form = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    defaultValues: { waId: "", name: "", password: "" },
    mode: "onTouched",
  });

  // handle form submission
  const onSubmit = (values: RegisterSchema) => {
    const payload = {
      waId: values.waId.replace(/\s+/g, ""),
      name: values.name,
      password: values.password.replace(/\s+/g, ""),
    };
    register(payload, {
      onSuccess: () => {
        router.push("/");
      },
    });
  };

  // get error message from axios.response.data object and return it.
  const getErrorMessage = () => {
    if (!error) return null;

    if (isAxiosAuthError(error)) {
      const errorData = (error as AxiosAuthError).response?.data;
      if (errorData?.message) {
        return errorData.message;
      }
    }
    return "Registration failed";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background transition-colors">
      <div className="w-full max-w-sm bg-card shadow-md rounded-xl p-8 flex flex-col items-center ">
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
          Create account
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" {...field} />
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
              {isPending ? "Creating..." : "Create account"}
            </Button>
            {error && (
              <div className="text-destructive text-sm text-center mt-1">
                {getErrorMessage()}
              </div>
            )}
            {data && (
              <div className="text-green-600 dark:text-green-400 text-sm text-center mt-1">
                Account created!
              </div>
            )}
          </form>
        </Form>
        <div className="w-full mt-6 text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
