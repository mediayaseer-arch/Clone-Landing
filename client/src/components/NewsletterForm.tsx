import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertSubscriberSchema } from "@shared/schema";
import { useSubscribeNewsletter } from "@/hooks/use-newsletter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import Turnstile, { type BoundTurnstileObject } from "react-turnstile";

const MIN_FORM_FILL_MS = 1500;

export function NewsletterForm() {
  const { mutate, isPending } = useSubscribeNewsletter();
  const [botToken, setBotToken] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [formStartedAt, setFormStartedAt] = useState(() => Date.now());
  const [localError, setLocalError] = useState<string | null>(null);
  const turnstileRef = useRef<BoundTurnstileObject | null>(null);
  const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim();
  const turnstileEnabled = Boolean(turnstileSiteKey);

  const form = useForm<z.infer<typeof insertSubscriberSchema>>({
    resolver: zodResolver(insertSubscriberSchema),
    defaultValues: {
      email: "",
    },
  });

  function onSubmit(values: z.infer<typeof insertSubscriberSchema>) {
    setLocalError(null);

    if (website.trim().length > 0) {
      setLocalError("Security check failed. Please refresh and try again.");
      return;
    }

    if (Date.now() - formStartedAt < MIN_FORM_FILL_MS) {
      setLocalError("Please wait a moment and submit again.");
      return;
    }

    if (turnstileEnabled && !botToken) {
      setLocalError("Please complete the security verification.");
      return;
    }

    mutate(
      {
        ...values,
        botToken,
        website,
        formStartedAt,
        formContext: "newsletter",
      },
      {
        onSuccess: () => {
          form.reset();
          setWebsite("");
          setBotToken(null);
          setFormStartedAt(Date.now());
          turnstileRef.current?.reset();
        },
        onError: () => {
          setBotToken(null);
          setFormStartedAt(Date.now());
          turnstileRef.current?.reset();
        },
      },
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="newsletter-website">Leave this field empty</label>
            <input
              id="newsletter-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <Input 
                      placeholder="Enter your email address" 
                      {...field} 
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 pl-10 focus:ring-[hsl(var(--quest-yellow))] focus:border-[hsl(var(--quest-yellow))] h-12 rounded-full"
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-[hsl(var(--quest-yellow))]" />
              </FormItem>
            )}
          />
          <Button 
            type="submit" 
            disabled={isPending}
            className="bg-[hsl(var(--quest-yellow))] text-[hsl(var(--quest-purple))] hover:bg-white hover:text-[hsl(var(--quest-purple))] font-bold h-12 px-8 rounded-full transition-all duration-300"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "SUBSCRIBE"}
          </Button>

          {turnstileEnabled ? (
            <div className="w-full flex justify-center sm:justify-start">
              <Turnstile
                sitekey={turnstileSiteKey!}
                theme="auto"
                onLoad={(_widgetId, boundTurnstile) => {
                  turnstileRef.current = boundTurnstile;
                }}
                onVerify={(token) => {
                  setBotToken(token);
                  setLocalError(null);
                }}
                onExpire={() => setBotToken(null)}
                onError={() => setBotToken(null)}
              />
            </div>
          ) : null}

          {localError ? (
            <p className="w-full text-xs text-[hsl(var(--quest-yellow))]">{localError}</p>
          ) : null}
        </form>
      </Form>
    </div>
  );
}
