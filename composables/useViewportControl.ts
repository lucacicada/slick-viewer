import { useResizeObserver } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'

interface UseViewportControlOptions {
  padding?: number
}

export function useViewportControl(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  content: MaybeRefOrGetter<HTMLImageElement | HTMLMediaElement | null | undefined>,
  options?: MaybeRefOrGetter<UseViewportControlOptions>,
) {
  const transformMatrix = shallowRef<DOMMatrix | undefined>(typeof DOMMatrix === 'undefined' ? undefined as unknown as DOMMatrix : new DOMMatrix())
  const transform = computed(() => transformMatrix.value ? String(transformMatrix.value) : 'matrix(1, 0, 0, 1, 0, 0)')

  const area = shallowRef<{ x: number, y: number, w: number, h: number } | null>(null)

  const targetRect = useElementBounding(target)

  const _ContentWidth = ref(0)
  const _ContentHeight = ref(0)

  let suppressContextMenu = false

  // #region Determine the size of the image or video content.

  function computeDimensions(el: EventTarget | null | undefined) {
    if (typeof HTMLImageElement !== 'undefined' && el instanceof HTMLImageElement) {
      _ContentWidth.value = el.naturalWidth
      _ContentHeight.value = el.naturalHeight
    }
    else if (typeof HTMLVideoElement !== 'undefined' && el instanceof HTMLVideoElement) {
      _ContentWidth.value = el.videoWidth
      _ContentHeight.value = el.videoHeight
    }
    else {
      _ContentWidth.value = 0
      _ContentHeight.value = 0
    }
  }

  watch(() => unrefElement(content), (el) => {
    computeDimensions(el)

    // Special case, there is no `decoded` event for images,
    // so we need to decode the image manually.
    if (typeof HTMLImageElement !== 'undefined' && el instanceof HTMLImageElement) {
      el.decode().then(() => computeDimensions(el))
    }
  }, {
    immediate: true,
  })

  useEventListener(content, 'load', (e) => {
    computeDimensions(e.target)
  }, {
    passive: true,
  })

  useEventListener(content, 'loadedmetadata', (e) => {
    computeDimensions(e.target)
  }, {
    passive: true,
  })

  // #endregion

  // #region Control the transform matrix of the viewport.

  function getContextData() {
    const matrix = transformMatrix.value

    const rect = toValue(target)?.getBoundingClientRect()
    const containerTop = rect?.top ?? 0
    const containerLeft = rect?.left ?? 0
    const containerWidth = rect?.width ?? 0
    const containerHeight = rect?.height ?? 0

    const contentWidth = _ContentWidth.value ?? 0
    const contentHeight = _ContentHeight.value ?? 0

    if (!matrix || !containerWidth || !containerHeight || !contentWidth || !contentHeight) {
      return null
    }

    return {
      matrix,
      container: {
        top: containerTop,
        left: containerLeft,
        width: containerWidth,
        height: containerHeight,
      },
      content: {
        width: contentWidth,
        height: contentHeight,
      },
    }
  }

  function zoom(scaleFactor: number, pivot?: { x: number, y: number }) {
    const ctx = getContextData()

    if (!ctx) {
      return
    }

    const matrix = ctx.matrix

    if (scaleFactor < 1) {
      const currentScale = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b)

      // Get the size of the image after scaling
      const currentWidth = Math.abs(currentScale * ctx.content.width)
      const currentHeight = Math.abs(currentScale * ctx.content.height)

      // Prevent zooming out too much
      if (Math.max(currentWidth, currentHeight) < 50) {
        return
      }
    }

    const x = pivot?.x ?? ctx.content.width / 2
    const y = pivot?.y ?? ctx.content.height / 2

    transformMatrix.value = matrix
      .translate(x, y)
      .scale(scaleFactor)
      .translate(-x, -y)
  }

  function zoomAtMousePoint(scaleFactor: number, event: MouseEvent | WheelEvent) {
    const ctx = getContextData()

    if (!ctx) {
      return
    }

    const mouseX = event.clientX - ctx.container.left
    const mouseY = event.clientY - ctx.container.top

    const inv = ctx.matrix.inverse()
    const pointInImageCoords = inv.transformPoint(new DOMPoint(mouseX, mouseY))

    zoom(scaleFactor, {
      x: pointInImageCoords.x,
      y: pointInImageCoords.y,
    })
  }

  function rotate(deg: number, pivot?: { x: number, y: number }) {
    const ctx = getContextData()

    if (!ctx) {
      return
    }

    const x = pivot?.x ?? ctx.content.width / 2
    const y = pivot?.y ?? ctx.content.height / 2

    transformMatrix.value = ctx.matrix
      .translate(x, y)
      .rotate(deg)
      .translate(-x, -y)
  }

  function rotateAtMousePoint(deg: number, event: MouseEvent | WheelEvent) {
    const ctx = getContextData()

    if (!ctx) {
      return
    }

    const inv = ctx.matrix.inverse()
    const mouseX = event.clientX - ctx.container.left
    const mouseY = event.clientY - ctx.container.top

    const pointInImageCoords = inv.transformPoint(new DOMPoint(mouseX, mouseY))

    rotate(deg, {
      x: pointInImageCoords.x,
      y: pointInImageCoords.y,
    })
  }

  function rotateExact(deg: number) {
    const ctx = getContextData()

    if (!ctx) {
      return
    }

    transformMatrix.value = ctx.matrix
      .translate(ctx.content.width / 2, ctx.content.height / 2)
      // FIXME: subtract the current rotation works, but we may hit float point precision issues thus the rotation is set to -0.00000000001
      .rotate(-Math.atan2(ctx.matrix.b, ctx.matrix.a) * (180 / Math.PI))
      .rotate(deg)
      .translate(-ctx.content.width / 2, -ctx.content.height / 2)
  }

  function centerImage(padding?: number) {
    const ctx = getContextData()

    if (!ctx) {
      return
    }

    padding = padding ?? toValue(options)?.padding ?? 0

    const scale = Math.min(
      (ctx.container.width - padding) / ctx.content.width,
      (ctx.container.height - padding) / ctx.content.height,
    )

    transformMatrix.value = new DOMMatrix()
      .translate(ctx.container.width / 2, ctx.container.height / 2)
      .scale(scale)
      .translate(-ctx.content.width / 2, -ctx.content.height / 2)
  }

  /**
   * Pad in screen coordinates.
   * Useful to drag the image around with the mouse.
   */
  function pad(x: number, y: number) {
    const ctx = getContextData()

    if (!ctx) {
      return
    }

    const inv = ctx.matrix.inverse()
    const origin = inv.transformPoint(new DOMPoint(0, 0))
    const moved = inv.transformPoint(new DOMPoint(x, y))

    const localDeltaX = moved.x - origin.x
    const localDeltaY = moved.y - origin.y

    transformMatrix.value = ctx.matrix.translate(localDeltaX, localDeltaY)
  }

  // FIXME: the selection is wrong, we need to take the image offset into account
  function select(area: { x: number, y: number, w: number, h: number }) {
    const ctx = getContextData()

    if (!ctx) {
      return
    }

    const m = new DOMMatrix(transformMatrix.value as any)

    const scale = Math.min(ctx.container.width / area.w, ctx.container.height / area.h)
    m.scaleSelf(scale, scale)

    m.translateSelf(-area.x, -area.y)

    transformMatrix.value = m
  }

  // #endregion

  useShortcuts({
    ' ': () => centerImage(),
    'Escape': () => rotateExact(0),
    'ArrowUp': () => pad(0, -10),
    'ArrowDown': () => pad(0, 10),
    'ArrowLeft': () => pad(-10, 0),
    'ArrowRight': () => pad(10, 0),
    'Home': () => centerImage(20),
    'End': () => centerImage(0),
    '+': () => zoom(1.1),
    '-': () => zoom(0.9),
  })

  function mouseInOuterBounds(event: MouseEvent) {
    const m = 60
    const x = event.clientX - targetRect.left.value
    const y = event.clientY - targetRect.top.value

    return x >= m && x <= targetRect.width.value - m && y >= m && y <= targetRect.height.value - m
  }

  usePointerAction(target, {
    pan: {
      down: ({ event }) => {
        if (event.shiftKey || event.ctrlKey) {
          return
        }

        if (event.button === 1) {
          return true
        }

        if (event.button === 0) {
          return mouseInOuterBounds(event)
        }
      },
      move: ({ delta }) => {
        pad(delta.x, delta.y)
      },
    },
    rotate: {
      down: ({ event }) => {
        if (event.shiftKey || event.ctrlKey) {
          return
        }

        if (event.button === 0) {
          return !mouseInOuterBounds(event)
        }
      },
      move: ({ delta, event }) => {
        const ROTATE_POINTER_SENSITIVITY = 1 / 100

        let rx = delta.x * ROTATE_POINTER_SENSITIVITY
        let ry = delta.y * ROTATE_POINTER_SENSITIVITY

        // position aware rotation
        if (event.clientY > targetRect.height.value) {
          rx *= -1
        }

        if (event.clientX < targetRect.width.value) {
          ry *= -1
        }

        rotate(rx + ry)
      },
    },
    area: {
      down: ({ event }) => {
        if (event.shiftKey || event.ctrlKey) {
          return
        }

        if (event.button === 2) {
          return true
        }
      },
      move: (event) => {
        const top = event.startY - targetRect.top.value
        const left = event.startX - targetRect.left.value
        const width = event.x - event.startX
        const height = event.y - event.startY

        const MIN_AREA = 12

        if (Math.abs(width) < MIN_AREA || Math.abs(height) < MIN_AREA) {
          area.value = null
          return
        }

        suppressContextMenu = true

        area.value = {
          x: Math.min(left, left + width),
          y: Math.min(top, top + height),
          w: Math.abs(width),
          h: Math.abs(height),
        }
      },
      up: () => {
        if (area.value) {
          select(area.value)
        }

        area.value = null
      },
    },
  })

  useEventListener(target, 'wheel', (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()

    if (e.buttons === 2) {
      suppressContextMenu = true
    }

    // Rotate instead of zooming under the cursor
    if (e.shiftKey || e.buttons === 2) {
      const angle = Math.sign(e.deltaY) * 15 // Rotate 15 degrees per scroll step
      rotateAtMousePoint(angle, e)
    }
    else {
      zoomAtMousePoint(e.deltaY < 0 ? 1.1 : 0.9, e)
    }
  })

  useEventListener(target, 'contextmenu', (event) => {
    if (event.shiftKey) {
      return
    }

    if (suppressContextMenu) {
      suppressContextMenu = false

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }
  }, {
    capture: true,
    passive: false,
  })

  // #region Reset the viewport to the initial state.

  function reset() {
    centerImage()
  }

  watch(() => [toValue(_ContentWidth), toValue(_ContentHeight)], () => {
    reset()
  }, {
    immediate: true,
  })

  const { stop } = useResizeObserver(target, () => {
    reset()
    stop()
  })

  // #endregion

  return {
    transformMatrix,
    transform,
    //
    width: _ContentWidth,
    height: _ContentHeight,
    area,
    //
    zoom,
    zoomAtMousePoint,
    rotate,
    rotateAtMousePoint,
    rotateExact,
    centerImage,
    pad,
    select,
  }
}
