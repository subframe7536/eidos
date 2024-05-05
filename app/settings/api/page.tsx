import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/react-hook-form/form"

import {
  APIAgentFormValues,
  apiAgentFormSchema,
  useAPIConfigStore,
} from "./store"

// This can come from your database or API.
const defaultValues: Partial<APIAgentFormValues> = {
  url: "ws://localhost:3333",
  enabled: false,
}

export function APIAgentForm() {
  const { apiAgentConfig, setAPIAgentConfig } = useAPIConfigStore()

  const form = useForm<APIAgentFormValues>({
    resolver: zodResolver(apiAgentFormSchema),
    defaultValues: {
      ...defaultValues,
      ...apiAgentConfig,
    },
  })

  function onSubmit(data: APIAgentFormValues) {
    setAPIAgentConfig(data)
    toast({
      title: "API Agent settings updated.",
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Agent URL</FormLabel>
              <FormControl>
                <Input placeholder="wss://" autoComplete="off" {...field} />
              </FormControl>
              <FormDescription>The URL of your API Agent.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Enable</FormLabel>
              <FormControl>
                <div className="flex">
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </div>
              </FormControl>
              <FormDescription>
                When enabled, you can query data from Eidos Web APP through{" "}
                <a
                  href="https://github.com/mayneyao/eidos-api-agent-node"
                  className="text-blue-500"
                  target="_blank"
                >
                  API Agent
                </a>
                .
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Update</Button>
      </form>
    </Form>
  )
}

export default function APISettingsPage() {
  return <APIAgentForm />
}
