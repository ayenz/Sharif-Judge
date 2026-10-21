import type { Form } from '@nuxt/ui'

/**
 * Submits a form to an API endpoint and maps server validation errors back onto
 * the form fields. `onSuccess` receives the response.
 */
export function useApiForm<T extends object, R = unknown>(
  url: string | (() => string),
  state: T,
  options: { method?: 'POST' | 'PUT' | 'DELETE', onSuccess?: (res: R) => unknown, successToast?: string } = {},
) {
  const form = useTemplateRef<Form<T>>('form')
  const loading = ref(false)
  const error = ref('')
  const toast = useToast()

  async function submit() {
    loading.value = true
    error.value = ''
    try {
      const request = $fetch as unknown as (url: string, opts: object) => Promise<R>
      const res = await request(typeof url === 'function' ? url() : url, { method: options.method ?? 'POST', body: state })
      if (options.successToast)
        toast.add({ title: options.successToast, color: 'success', icon: 'i-lucide-check' })
      await options.onSuccess?.(res)
    }
    catch (e) {
      const { message, fields } = apiError(e)
      const fieldErrors = Object.entries(fields).filter(([name]) => name !== '_')
      if (fieldErrors.length)
        form.value?.setErrors(fieldErrors.map(([name, message]) => ({ name, message })))
      else
        error.value = message
    }
    finally {
      loading.value = false
    }
  }

  return { submit, loading, error }
}
