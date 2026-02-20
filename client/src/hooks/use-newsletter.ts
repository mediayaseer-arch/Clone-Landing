import { useMutation } from "@tanstack/react-query";
import { api, type SubscribeInput, type SubscribeResponse } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useSubscribeNewsletter() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: SubscribeInput) => {
      const res = await fetch(api.newsletter.subscribe.path, {
        method: api.newsletter.subscribe.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to subscribe");
      }

      return api.newsletter.subscribe.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      toast({
        title: "Subscribed!",
        description: "You have successfully subscribed to our newsletter.",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
