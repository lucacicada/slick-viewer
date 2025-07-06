<script setup lang="ts">
import { ChevronDown, ImageIcon, ImageOff, Maximize, RotateCcw, RotateCw, SquarePower, Underline, ZoomIn, ZoomOut } from 'lucide-vue-next'

type MouseButton = 'left' | 'middle' | 'right'
type Modifier = 'shift' | 'ctrl' | 'alt' | 'meta'
type JoinModifiers<T extends string[], Acc extends string = ''>
  = T extends [infer Head extends string, ...infer Tail extends string[]]
    ? JoinModifiers<Tail, `${Acc}${Acc extends '' ? '' : '+'}${Head}`>
    : Acc

// Accept MouseButton followed by 0 or more modifiers joined by '+'
type ActionButton = `${MouseButton}${'' | `+${JoinModifiers<Modifier[]>}`}`

interface Ctx {
  rotate: (angle: number) => void
  rotateExact: (angle: number) => void
  rotateAtMousePoint: (angle: number, event: MouseEvent | WheelEvent) => void
  zoom: (factor: number) => void
  zoomAtMousePoint: (factor: number, event: MouseEvent | WheelEvent) => void
  centerImage: (padding?: number) => void
}

/**
 * For convenience, `preventDefault()` is automatically called on the event after the callback is invoked.
 *
 * To control this behavior, return `false` from the callback, this will leave the `event` untouched.
 */
interface ShortcutHandler {
  (ctx: Ctx, event: KeyboardEvent | WheelEvent): void | boolean
}

export interface ImageViewerOptions {
  src?: string
  type?: string
  alwaysSuppressContextMenu?: boolean
  padding?: number
  controls?: {
    pan?: {
      enabled?: boolean
      button?: ActionButton | ActionButton[]
    }
    area?: {
      enabled?: boolean
      button?: ActionButton | ActionButton[]
    }
    dragRotate?: {
      enabled?: boolean
      button?: ActionButton | ActionButton[]
      margin?: number
    }
  }
  shortcuts?: ShortcutHandler | {
    [K in string]: (ctx: Ctx, event: KeyboardEvent | WheelEvent) => void | boolean
  }
}

const { src, alwaysSuppressContextMenu = false, controls, ...options } = defineProps<ImageViewerOptions>()

interface Control {
  enabled?: boolean
  button?: ActionButton | ActionButton[]
}

function buttonMatch(event: MouseEvent, control: Control | undefined, defaults: { default: MouseButton | MouseButton[] }) {
  if (control?.enabled === false) {
    return false
  }

  let button: MouseButton

  switch (event.button) {
    case 0:
      button = 'left'
      break
    case 1:
      button = 'middle'
      break
    case 2:
      button = 'right'
      break
    default:
      return false
  }

  const buttonConfig = control?.button ?? defaults.default
  const actionString: ActionButton[] = Array.isArray(buttonConfig) ? buttonConfig : [buttonConfig]

  for (const action of actionString) {
    const [actionButton, ...modifiers] = action.split('+') as [MouseButton, ...Modifier[]]
    if (button === actionButton && (!modifiers.length || modifiers.every(mod => event[`${mod}Key`]))) {
      return true
    }
  }
}

const mediaEl = useTemplateRef('mediaRef')

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

watch(mediaEl, (el) => {
  computeDimensions(el)

  // Special case, there is no `decoded` event for images,
  // so we need to decode the image manually.
  if (typeof HTMLImageElement !== 'undefined' && el instanceof HTMLImageElement) {
    el.decode().then(() => computeDimensions(el))
  }
}, {
  immediate: true,
})

useEventListener(mediaEl, 'load', (e) => {
  computeDimensions(e.target)
}, {
  passive: true,
})

useEventListener(mediaEl, 'loadedmetadata', (e) => {
  computeDimensions(e.target)
}, {
  passive: true,
})

const containerEl = useTemplateRef('containerRef')

const context = useTransformMatrix(containerEl, () => ({
  width: width.value,
  height: height.value,
}))

watch([width, height], () => {
  context.centerImage()
}, {
  immediate: true,
})

const rotationInDeg = computed(() => {
  if (!context.transformMatrix.value) {
    return 0
  }

  let angle = Math.atan2(context.transformMatrix.value.b, context.transformMatrix.value.a)
  angle = angle * (180 / Math.PI)

  // FIXME: the angle sometimes is very close to 0, but not exactly 0
  // this is likely due to rotateExact that try to subtract the current angle
  return Math.abs(angle) < 0.0001 ? 0 : angle
})

const ctx: Ctx = {
  rotate: context.rotate,
  rotateExact: context.rotateExact,
  rotateAtMousePoint: context.rotateAtMousePoint,
  zoom: context.zoom,
  zoomAtMousePoint: context.zoomAtMousePoint,
  centerImage: (padding?: number) => context.centerImage(padding ?? options?.padding ?? 40),
}

const pointer = ref({
  pointerId: undefined as number | undefined,
  down: false as 'pan' | 'area' | 'drag-rotate' | false,
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
})

// If the shortcut function is called, prevent default on undefined or false return value
function invokeShortcut(event: KeyboardEvent | WheelEvent) {
  const shortcuts = options?.shortcuts

  if (!shortcuts) {
    return
  }

  let res: any
  let called = false

  if (typeof shortcuts === 'function') {
    res = shortcuts(ctx, event)
    called = true
  }
  else if (event.type === 'wheel' && typeof shortcuts.Wheel === 'function') {
    res = shortcuts.Wheel(ctx, event)
    called = true
  }
  else if ('key' in event && typeof shortcuts[event.key] === 'function') {
    res = shortcuts[event.key](ctx, event)
    called = true
  }

  if (called && res !== false) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }
}

useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.repeat) {
    return
  }

  // Cancel the current pointer action if any
  if (event.key === 'Escape' && pointer.value.down) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    pointer.value.down = false
    return
  }

  invokeShortcut(event)
})

useEventListener(containerEl, 'wheel', (event) => {
  invokeShortcut(event)
})

let suppressContextMenu = false

const MIN_AREA = 12

const area = computed(() => {
  const x = pointer.value.startX
  const y = pointer.value.startY
  const w = pointer.value.x - pointer.value.startX
  const h = pointer.value.y - pointer.value.startY

  if (pointer.value.down === 'area' && Math.abs(w) > MIN_AREA && Math.abs(h) > MIN_AREA) {
    return {
      x: Math.min(x, x + w),
      y: Math.min(y, y + h),
      w: Math.abs(w),
      h: Math.abs(h),
    }
  }

  return null
})

useEventListener(containerEl, 'pointerdown', (event) => {
  if (event.shiftKey || event.ctrlKey) {
    return
  }

  const rect = containerEl.value?.getBoundingClientRect()

  if (!rect) {
    return
  }

  // Check if the cursor is near the margin
  const m = controls?.dragRotate?.margin ?? 60
  if ((controls?.dragRotate?.enabled ?? true) && m > 0) {
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    if ((mouseX < m || mouseX > rect.width - m || mouseY < m || mouseY > rect.height - m)) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      pointer.value = {
        pointerId: event.pointerId,
        down: 'drag-rotate',
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
      }

      return
    }
  }

  let action: 'pan' | 'area'

  if (buttonMatch(event, controls?.pan, { default: ['left', 'middle'] })) {
    action = 'pan'
  }
  else if (buttonMatch(event, controls?.area, { default: 'right' })) {
    action = 'area'
  }
  else {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  pointer.value = {
    pointerId: event.pointerId,
    down: action,
    startX: event.clientX,
    startY: event.clientY,
    x: event.clientX,
    y: event.clientY,
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

  if (pointer.value.down === 'pan') {
    context.pad(deltaX, deltaY)
  }
  else if (pointer.value.down === 'drag-rotate') {
    const ROTATE_POINTER_SENSITIVITY = 1 / 100

    let rx = deltaX * ROTATE_POINTER_SENSITIVITY
    let ry = deltaY * ROTATE_POINTER_SENSITIVITY

    const rect = containerEl.value?.getBoundingClientRect()
    if (rect) {
      // position aware rotation
      if (pointer.value.y > rect.height / 2)
        rx *= -1

      if (pointer.value.x < rect.width / 2)
        ry *= -1

      context.rotate(rx + ry)
    }
  }

  const movementX = pointer.value.startX - pointer.value.x
  const movementY = pointer.value.startY - pointer.value.y

  suppressContextMenu = Math.abs(movementX) > MIN_AREA || Math.abs(movementY) > MIN_AREA
}, {
  passive: true,
})

useEventListener(['pointerup', 'pointercancel'], (event) => {
  if (!pointer.value.down || event.pointerId !== pointer.value.pointerId) {
    return
  }

  if (area.value) {
    context.select(area.value)
  }

  pointer.value.pointerId = undefined
  pointer.value.down = false
}, {
  passive: true,
})

useEventListener(containerEl, 'contextmenu', (event) => {
  if (event.shiftKey) {
    return
  }

  if (alwaysSuppressContextMenu || suppressContextMenu) {
    suppressContextMenu = false

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }
}, {
  passive: false,
})

// Fix for some wired glitch when the image overflows the container in rare occasions on first load
const { stop } = useResizeObserver(containerEl, () => {
  context.centerImage(options.padding ?? 40)
  stop()
})

//

const menuContainerEl = useTemplateRef('menuContainerRef')
const isHovered = useElementHover(menuContainerEl, { delayEnter: 200, delayLeave: 600 })

const settings = ref({
  showInfo: true,
  bgColor: '#000000',
  theaterMode: true,
})
</script>

<template>
  <div
    ref="containerRef"
    role="presentation"
    class="bg-black size-full relative overflow-hidden bg-center bg-cover before:bg-[#0000009e] before:absolute before:inset-[0] before:backdrop-blur-2xl select-none"
    :style="settings.theaterMode ? { backgroundImage: `url(${src})` } : {}"
  >
    <div class="cursor-move absolute z-10 h-[60px] inset-x-0 top-0" />
    <div class="cursor-move absolute z-10 h-[60px] inset-x-0 bottom-0" />
    <div class="cursor-move absolute z-10 w-[60px] inset-y-0 right-0" />

    <video
      v-if="type?.startsWith('video/')"
      ref="mediaRef"
      :key="`video-${src}`"
      class="absolute top-0 left-0 block p-0 m-0 origin-top-left will-change-transform max-w-[fit-content] max-h-[fit-content]"
      :width="width"
      :height="height"
      :src="src"
      :style="{
        transform: context.transform.value,
      }"
    />
    <img
      v-else
      ref="mediaRef"
      :key="`image-${src}`"
      class="absolute top-0 left-0 block p-0 m-0 origin-top-left will-change-transform max-w-[fit-content] max-h-[fit-content]"
      :width="width"
      :height="height"
      :src="src"
      :style="{
        transform: context.transform.value,
      }"
    >

    <!-- <img
      class="absolute top-0 left-0 block p-0 m-0 origin-top-left will-change-transform"
      :src="src"
      :width="computedNaturalWidth"
      :height="computedNaturalHeight"
      :style="{
        'width': `${computedNaturalWidth}px`,
        'height': `${computedNaturalHeight}px`,
        'min-width': `${computedNaturalWidth}px`,
        'min-height': `${computedNaturalHeight}px`,
        'max-width': `${computedNaturalWidth}px`,
        'max-height': `${computedNaturalHeight}px`,
        'transform': context.transform.value,
      }"
    > -->

    <div class="absolute bottom-0 left-0 p-2 text-xs text-white bg-black/50">
      {{ rotationInDeg === 0 ? '0' : rotationInDeg.toFixed(2) }}°
    </div>

    <div
      v-if="area"
      class="absolute bg-cyan-500/10 border-border border-1"
      :style="{
        left: `${area.x}px`,
        top: `${area.y}px`,
        width: `${area.w}px`,
        height: `${area.h}px`,
      }"
    />

    <div
      ref="menuContainerRef"
      class="absolute flex p-6 justify-center z-50 inset-y-0 w-[var(--size,65px)] left-0 cursor-default transition-colors duration-100 ease-in-out"
      :class="isHovered ? 'bg-black/50' : 'bg-transparent'"
    >
      <Transition
        appear
        enter-active-class="duration-300 ease-out"
        enter-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="duration-200 ease-in"
        leave-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-show="isHovered" class="flex flex-col gap-2 transition-opacity duration-300 ease-in-out pointer-events-auto">
          <button
            type="button"
            class="flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-red-500/50 size-8 hover:bg-red-500/80"
          >
            <SquarePower class="size-6" />
          </button>

          <div class="flex-1" />

          <button
            type="button"
            class="pointer-events-auto flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
            @click="context.zoom(1.1)"
          >
            <ZoomIn class="size-6" />
          </button>

          <button
            type="button"
            class="pointer-events-auto flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
            @click="context.zoom(0.9)"
          >
            <ZoomOut class="size-6" />
          </button>

          <button
            type="button"
            class="pointer-events-auto flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
            @click="context.rotate(-10)"
          >
            <RotateCcw class="size-6" />
          </button>

          <button
            type="button"
            class="pointer-events-auto flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
            @click="context.rotate(10)"
          >
            <RotateCw class="size-6" />
          </button>

          <button
            type="button"
            class="pointer-events-auto flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
            @click="context.rotateExact(0)"
          >
            <Underline class="size-6" />
          </button>

          <button
            type="button"
            class="flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
            @click="context.centerImage(options.padding ?? 40)"
          >
            <Maximize class="size-6" />
          </button>

          <button
            type="button"
            class="flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
            @click="settings.theaterMode = !settings.theaterMode"
          >
            <ImageOff v-if="settings.theaterMode" class="size-6" />
            <ImageIcon v-else class="size-6" />
          </button>

          <div class="flex-1" />

          <button
            type="button"
            class="flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
          >
            <ChevronDown class="size-6" />
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>
