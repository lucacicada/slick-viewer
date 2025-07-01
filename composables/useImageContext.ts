import type { MaybeRefOrGetter } from '@vueuse/core'
import { shallowRef, toValue } from 'vue'

export function useImageViewerContext(
  target: MaybeRefOrGetter<HTMLImageElement | null | undefined>,
) {
  const transformMatrix = shallowRef<DOMMatrix>(typeof DOMMatrix === 'undefined' ? undefined as unknown as DOMMatrix : new DOMMatrix())

  function getSize() {
    const rect = toValue(target)?.getBoundingClientRect()

    const i = null as unknown as HTMLImageElement | null

    if (!transformMatrix.value || !i || !rect || !i.naturalWidth || !i.naturalHeight) {
      return null
    }

    return {
      container: rect,
      image: i,
    }
  }

  function zoom(scaleFactor: number, pivot?: { x: number, y: number }) {
    const size = getSize()

    if (!size) {
      return
    }

    if (scaleFactor < 1) {
      const matrix = transformMatrix.value
      const currentScale = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b)

      // Get the size of the image after scaling
      const currentWidth = Math.abs(currentScale * size.image.naturalWidth)
      const currentHeight = Math.abs(currentScale * size.image.naturalHeight)

      // Prevent zooming out too much
      if (Math.max(currentWidth, currentHeight) < 50) {
        return
      }
    }

    const x = pivot?.x ?? size.image.naturalWidth / 2
    const y = pivot?.y ?? size.image.naturalHeight / 2

    transformMatrix.value = transformMatrix.value
      .translate(x, y)
      .scale(scaleFactor)
      .translate(-x, -y)
  }

  function zoomAtMousePoint(scaleFactor: number, event: MouseEvent) {
    const size = getSize()

    if (!size) {
      return
    }

    const rect = size.container
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    const inv = transformMatrix.value.inverse()
    const pointInImageCoords = inv.transformPoint(new DOMPoint(mouseX, mouseY))

    zoom(scaleFactor, {
      x: pointInImageCoords.x,
      y: pointInImageCoords.y,
    })
  }

  function rotate(deg: number, pivot?: { x: number, y: number }) {
    const size = getSize()

    if (!size) {
      return
    }

    const x = pivot?.x ?? size.image.naturalWidth / 2
    const y = pivot?.y ?? size.image.naturalHeight / 2

    transformMatrix.value = transformMatrix.value
      .translate(x, y)
      .rotate(deg)
      .translate(-x, -y)
  }

  function rotateAtMousePoint(deg: number, event: MouseEvent) {
    const size = getSize()

    if (!size) {
      return
    }

    const inv = transformMatrix.value.inverse()
    const rect = size.container
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    const pointInImageCoords = inv.transformPoint(new DOMPoint(mouseX, mouseY))

    rotate(deg, {
      x: pointInImageCoords.x,
      y: pointInImageCoords.y,
    })
  }

  function rotateExact(deg: number) {
    const size = getSize()

    if (!size) {
      return
    }

    transformMatrix.value = transformMatrix.value
      .translate(size.image.naturalWidth / 2, size.image.naturalHeight / 2)
    // FIXME: subtract the current rotation works, but we may hit float point precision issues thus the rotation is set to -0.00000000001
      .rotate(-Math.atan2(transformMatrix.value.b, transformMatrix.value.a) * (180 / Math.PI))
      .rotate(deg)
      .translate(-size.image.naturalWidth / 2, -size.image.naturalHeight / 2)
  }

  function centerImage(padding: number = 40) {
    const size = getSize()

    if (!size) {
      return
    }

    const scale = Math.min(
      (size.container.width - padding) / size.image.naturalWidth,
      (size.container.height - padding) / size.image.naturalHeight,
    )

    transformMatrix.value = new DOMMatrix()
      .translate(size.container.width / 2, size.container.height / 2)
      .scale(scale)
      .translate(-size.image.naturalWidth / 2, -size.image.naturalHeight / 2)
  }

  /**
   * Pad in screen coordinates.
   * Useful to drag the image around with the mouse.
   */
  function pad(x: number, y: number) {
    const size = getSize()

    if (!size) {
      return
    }

    const inv = transformMatrix.value.inverse()
    const origin = inv.transformPoint(new DOMPoint(0, 0))
    const moved = inv.transformPoint(new DOMPoint(x, y))

    const localDeltaX = moved.x - origin.x
    const localDeltaY = moved.y - origin.y

    transformMatrix.value = transformMatrix.value.translate(localDeltaX, localDeltaY)
  }

  // FIXME: the selection is wrong, we need to take the image offset into account
  function select(area: { x: number, y: number, w: number, h: number }) {
    const size = getSize()

    if (!size) {
      return
    }

    const m = new DOMMatrix(transformMatrix.value as any)

    const scale = Math.min(size.container.width / area.w, size.container.height / area.h)
    m.scaleSelf(scale, scale)

    m.translateSelf(-area.x, -area.y)

    transformMatrix.value = m
  }

  const context = {
    zoom,
    zoomAtMousePoint,
    rotate,
    rotateAtMousePoint,
    rotateExact,
    centerImage,
    pad,
    select,
  }

  return context
}
