export function useImageSize(options: MaybeRefOrGetter<{ src?: string } | string | null | undefined>) {
  const state = useAsyncState<HTMLImageElement | undefined>(
    () => new Promise((resolve, reject) => {
      const optionsValue = toValue(options)
      const src = typeof optionsValue === 'string' ? optionsValue : optionsValue?.src

      if (!src) {
        resolve(undefined)
        return
      }

      const img = new Image()
      img.src = src

      // Decode might run earlier than onload
      img.decode().then(() => resolve(img)).catch(reject)

      // onload can sometimes run before decode
      img.onload = () => resolve(img)
      img.onerror = reject
    }),
    undefined,
    {
      resetOnExecute: true,
    },
  )

  watch(
    () => toValue(options),
    () => state.execute(),
    { deep: true },
  )

  return {
    ...state,
    naturalWidth: computed(() => state.state.value?.naturalWidth ?? 0),
    naturalHeight: computed(() => state.state.value?.naturalHeight ?? 0),
  }
}
