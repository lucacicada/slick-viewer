interface UsePointerEvent {
  event: PointerEvent
}

export function usePointer(target: MaybeRefOrGetter<HTMLElement | null | undefined>, cb: (event: UsePointerEvent) => void) {
  const rect = useElementBounding(target)

  const pointer = ref({
    suppressContextMenu: false,
    pointerId: undefined as number | undefined,
    down: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
  })

  useEventListener(target, 'pointerdown', (event) => {
    if (event.shiftKey || event.ctrlKey) {
      return
    }

    if (rect.width.value === 0 || rect.height.value === 0) {
      return
    }

    cb({
      event,
    })
  })

  useEventListener('pointermove', (event) => {
    if (!pointer.value.down || event.pointerId !== pointer.value.pointerId) {
      return
    }

    cb({
      event,
    })
  }, {
    passive: true,
  })

  useEventListener(['pointerup', 'pointercancel'], (event) => {
    if (!pointer.value.down || event.pointerId !== pointer.value.pointerId) {
      return
    }

    cb({
      event,
    })
  }, {
    passive: true,
  })

  useEventListener('contextmenu', (event) => {
    if (event.shiftKey) {

    }
  }, {
    capture: true,
    passive: false,
  })
}
