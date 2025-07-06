export function useMediaSize(target: MaybeRefOrGetter<HTMLImageElement | HTMLMediaElement | null | undefined>) {
  const width = ref(0)
  const height = ref(0)

  function computeDimensions(el: EventTarget | null | undefined) {
    if (typeof HTMLImageElement !== 'undefined' && el instanceof HTMLImageElement) {
      width.value = el.naturalWidth
      height.value = el.naturalHeight
    }
    else if (typeof HTMLVideoElement !== 'undefined' && el instanceof HTMLVideoElement) {
      width.value = el.videoWidth
      height.value = el.videoHeight
    }
    else {
      width.value = 0
      height.value = 0
    }
  }

  watch(() => toValue(target), (el) => {
    computeDimensions(el)

    // Special case, there is no `decoded` event for images,
    // so we need to decode the image manually.
    if (typeof HTMLImageElement !== 'undefined' && el instanceof HTMLImageElement) {
      el.decode().then(() => computeDimensions(el))
    }
  }, {
    immediate: true,
  })

  useEventListener(target, 'load', (e) => {
    computeDimensions(e.target)
  }, {
    passive: true,
  })

  useEventListener(target, 'loadedmetadata', (e) => {
    computeDimensions(e.target)
  }, {
    passive: true,
  })

  return {
    width,
    height,
  }
}
