import type { UseImageOptions } from '@vueuse/core'
import CSSMatrix from '@thednp/dommatrix'
import { useElementBounding, useImage } from '@vueuse/core'

export function useCanvasMatrix(
  container: MaybeRefOrGetter<HTMLElement | null | undefined>,
  content: MaybeRefOrGetter<{ naturalWidth: number, naturalHeight: number } | null | undefined>,
) {
  const transformMatrix = shallowRef(new CSSMatrix())
  const box = useElementBounding(container)

  function getContentSize() {
    const size = toValue(content)
    const w = size?.naturalWidth || 0
    const h = size?.naturalHeight || 0
    return w && h ? { w, h } : null
  }

  function zoom(scaleFactor: number, options?: { x?: number, y?: number }) {
    const size = getContentSize()

    if (!size) {
      return
    }

    const x = options?.x ?? (size.w / 2)
    const y = options?.y ?? (size.h / 2)

    transformMatrix.value = transformMatrix.value
      .translate(x, y)
      .scale(scaleFactor)
      .translate(-x, -y)
  }

  function rotate(deg: number, options?: { x?: number, y?: number }) {
    const size = getContentSize()

    if (!size) {
      return
    }

    const x = options?.x ?? (size.w / 2)
    const y = options?.y ?? (size.h / 2)

    transformMatrix.value = transformMatrix.value
      .translate(x, y)
      .rotate(deg)
      .translate(-x, -y)
  }

  function rotateExact(deg: number, options?: { x?: number, y?: number }) {
    const size = getContentSize()

    if (!size) {
      return
    }

    const x = options?.x ?? (size.w / 2)
    const y = options?.y ?? (size.h / 2)

    transformMatrix.value = transformMatrix.value
      .translate(x, y)
      .rotate(-Math.atan2(transformMatrix.value.b, transformMatrix.value.a) * (180 / Math.PI))
      .rotate(deg)
      .translate(-x, -y)
  }

  function center(padding?: number) {
    const size = getContentSize()

    if (!size) {
      transformMatrix.value = new CSSMatrix()
      return
    }

    const scale = Math.min(
      (box.width.value - (padding ?? 0)) / size.w,
      (box.height.value - (padding ?? 0)) / size.h,
    )

    transformMatrix.value = new CSSMatrix()
      .translate(box.width.value / 2, box.height.value / 2)
      .scale(scale)
      .translate(-size.w / 2, -size.h / 2)
  }

  return {
    matrix: transformMatrix,
    transform: () => {},

    zoom,
    rotate,
    rotateExact,
    center,
  }
}

export function useImageViewer(
  container: MaybeRefOrGetter<HTMLElement | null | undefined>,
  options: MaybeRefOrGetter<UseImageOptions>,
) {
  const transformMatrix = shallowRef(new CSSMatrix())
  const { state } = useImage(options)
  const box = useElementBounding(container)
  const computedNaturalWidth = computed(() => state.value?.naturalWidth || 0)
  const computedNaturalHeight = computed(() => state.value?.naturalHeight || 0)

  return {
    width: computedNaturalWidth,
    height: computedNaturalHeight,
    transformMatrix: readonly(transformMatrix),
  }
}
