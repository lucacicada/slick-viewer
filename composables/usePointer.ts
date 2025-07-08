interface UsePointerEvent {
  event: PointerEvent
  startX: number
  startY: number
  x: number
  y: number
  delta: {
    x: number
    y: number
  }
}

interface PointerAction {
  down?: (event: UsePointerEvent) => void | boolean
  move?: (event: UsePointerEvent) => void
  up?: (event: UsePointerEvent) => void
}

export function usePointerAction(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  actions: Record<string, PointerAction>,
) {
  const rect = useElementBounding(target)

  const pointer = ref({
    suppressContextMenu: false,
    pointerId: undefined as number | undefined,
    down: false,
    action: undefined as string | undefined,
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

    const actionValue = toValue(actions)
    for (const actionName in actionValue) {
      const action = actionValue[actionName]
      if (action.down) {
        if (event.defaultPrevented) {
          return
        }

        const context = {
          event,
          startX: event.clientX,
          startY: event.clientY,
          x: event.clientX,
          y: event.clientY,
          delta: {
            x: 0,
            y: 0,
          },
        }

        if (action.down(context)) {
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()

          pointer.value = {
            suppressContextMenu: false,
            pointerId: event.pointerId,
            down: true,
            action: actionName,
            startX: event.clientX,
            startY: event.clientY,
            x: event.clientX,
            y: event.clientY,
          }
        }
      }
    }
  })

  useEventListener('pointermove', (event) => {
    if (!pointer.value.down || event.pointerId !== pointer.value.pointerId) {
      return
    }

    const deltaX = event.clientX - pointer.value.x
    const deltaY = event.clientY - pointer.value.y
    pointer.value.x = event.clientX
    pointer.value.y = event.clientY

    const actionValue = toValue(actions)
    const action = actionValue[pointer.value.action!]

    if (!action || !action.move) {
      return
    }

    action.move({
      event,
      startX: pointer.value.startX,
      startY: pointer.value.startY,
      x: pointer.value.x,
      y: pointer.value.y,
      delta: {
        x: deltaX,
        y: deltaY,
      },
    })
  }, {
    passive: true,
  })

  useEventListener(['pointerup', 'pointercancel'], (event) => {
    if (!pointer.value.down || event.pointerId !== pointer.value.pointerId) {
      return
    }

    pointer.value.pointerId = undefined
    pointer.value.down = false

    const actionValue = toValue(actions)
    const action = actionValue[pointer.value.action!]
    pointer.value.action = undefined

    if (!action || !action.up) {
      return
    }

    action.up({
      event,
      startX: pointer.value.startX,
      startY: pointer.value.startY,
      x: pointer.value.x,
      y: pointer.value.y,
      delta: {
        x: event.clientX - pointer.value.startX,
        y: event.clientY - pointer.value.startY,
      },
    })
  }, {
    passive: true,
  })

  useEventListener('contextmenu', (event) => {
    if (event.shiftKey) {
      return
    }

    if (pointer.value.suppressContextMenu) {
      pointer.value.suppressContextMenu = false

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }
  }, {
    capture: true,
    passive: false,
  })

  return pointer
}
