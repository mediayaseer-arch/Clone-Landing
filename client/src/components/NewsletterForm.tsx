import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertSubscriberSchema } from "@shared/schema";
import { useSubscribeNewsletter } from "@/hooks/use-newsletter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";

export function NewsletterForm() {
  const { mutate, isPending } = useSubscribeNewsletter();
  
  const form = useForm<z.infer<typeof insertSubscriberSchema>>({
    resolver: zodResolver(insertSubscriberSchema),
    defaultValues: {
      email: "",
    },
  });

  function onSubmit(values: z.infer<typeof insertSubscriberSchema>) {
    mutate(values, {
      onSuccess: () => {
        form.reset();
      }
    });
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row gap-3">
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
        </form>
      </Form>
    </div>
  );
}
