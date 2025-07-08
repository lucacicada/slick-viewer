/**
 * For convenience, `preventDefault()` is automatically called on the event after the callback is invoked.
 *
 * To control this behavior, return `false` from the callback, this will leave the `event` untouched.
 */
interface ShortcutHandler {
  (event: KeyboardEvent): void | boolean
}

type Shortcuts = {
  [K in string]: (event: KeyboardEvent) => void | boolean
}

export function useShortcuts<T extends ShortcutHandler | Shortcuts>(
  shortcuts: MaybeRefOrGetter<T>,
) {
  useEventListener('keydown', (event: KeyboardEvent) => {
    if (event.repeat) {
      return
    }

    if (event.defaultPrevented) {
      return
    }

    const s = toValue(shortcuts)

    if (!s) {
      return
    }

    let res: any
    let called = false

    if (typeof s === 'function') {
      res = s(event)
      called = true
    }
    else if ('key' in event && typeof s[event.key] === 'function') {
      res = s[event.key](event)
      called = true
    }

    if (called && res !== false) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }
  })
}
