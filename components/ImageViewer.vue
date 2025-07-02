<script setup lang="ts">
import type { FullGestureState, StateKey } from '@vueuse/gesture'
import { useAsyncState } from '@vueuse/core'
import { useDrag } from '@vueuse/gesture'
import { ChevronDown, ImageIcon, ImageOff, Maximize, RotateCcw, RotateCw, SquarePower, Underline, ZoomIn, ZoomOut } from 'lucide-vue-next'

type MouseButton = 'left' | 'middle' | 'right'
type Modifier = 'shift' | 'ctrl' | 'alt' | 'meta'
type JoinModifiers<T extends string[], Acc extends string = ''>
  = T extends [infer Head extends string, ...infer Tail extends string[]]
    ? JoinModifiers<Tail, `${Acc}${Acc extends '' ? '' : '+'}${Head}`>
    : Acc

// Accept MouseButton followed by 0 or more modifiers joined by '+'
type ActionButton = `${MouseButton}${'' | `+${JoinModifiers<Modifier[]>}`}`

export interface ImageViewerOptions {
  src?: string
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

const containerEl = useTemplateRef('containerRef')

const { state, error, execute } = useAsyncState<HTMLImageElement | undefined>(
  () => new Promise((resolve, reject) => {
    const optionsValue = toValue(src) as string | { src: string } | undefined

    if (!optionsValue) {
      resolve(undefined)
      return
    }

    const img = new Image()
    img.src = typeof optionsValue === 'string' ? optionsValue : optionsValue.src

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
  () => toValue(src),
  () => execute(),
  { deep: true },
)

const context = useTransformMatrix(containerEl, () => ({
  width: state.value?.naturalWidth ?? 0,
  height: state.value?.naturalHeight ?? 0,
}))

const computedNaturalWidth = computed(() => state.value?.naturalWidth || 0)
const computedNaturalHeight = computed(() => state.value?.naturalHeight || 0)

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

// state is never updated in SSR
watch(
  state,
  () => context.centerImage(options.padding ?? 40),
  { immediate: true },
)

const pointer = ref({
  pointerId: undefined as number | undefined,
  down: false as 'pan' | 'area' | false,
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
})

/**
 * Keyboard Shortcuts
 * - Space: Center the image
 * - Escape: Reset the image to its initial position
 * - ArrowLeft: Rotate left
 * - ArrowRight: Rotate right
 * - +: Zoom in
 * - -: Zoom out
 * - R: Reset rotation preserving zoom and position
 * - C: Center the image preserving zoom
 * - T: Toggle theater mode
 * - I: Toggle image info
 */

const shortcuts: Record<string, () => void> = {
  ' ': () => context.centerImage(options.padding ?? 40),
  'Escape': () => {
    // Cancel the current pointer action if any
    if (pointer.value.down) {
      pointer.value.down = false
    }
    else {
      context.rotateExact(0)
    }
  },
  'ArrowLeft': () => context.rotate(-10),
  'ArrowRight': () => context.rotate(10),
  '+': () => context.zoom(1.1),
  '-': () => context.zoom(0.9),
}

useEventListener(
  'keydown',
  (event: KeyboardEvent) => {
    if (event.repeat) {
      return
    }

    if (event.key in shortcuts) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()

      shortcuts[event.key]()
    }
  },
  false,
)

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

useEventListener(containerEl, 'wheel', (event) => {
  // if (event.ctrlKey) {
  //   return
  // }

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  // Rotate instead of zooming under the cursor
  if (event.shiftKey) {
    const angle = Math.sign(event.deltaY) * 15 // Rotate 15 degrees per scroll step
    context.rotateAtMousePoint(angle, event)
  }
  else {
    context.zoomAtMousePoint(event.deltaY < 0 ? 1.1 : 0.9, event)
  }
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

function onDrag(e: Omit<FullGestureState<StateKey<'drag'>>, 'event'> & { event: Event }) {
  if (e.dragging) {
    e.event.preventDefault()
    e.event.stopPropagation()
    e.event.stopImmediatePropagation()

    const x = e.delta[0]
    const y = e.delta[1]

    const angle = (x + y) * (Math.PI / 180)

    context.rotate(angle)
  }
}

const a1El = useTemplateRef('a1')
const a3El = useTemplateRef('a3')
const a4El = useTemplateRef('a4')

useDrag(onDrag, { domTarget: a1El, eventOptions: { passive: false } })
useDrag(onDrag, { domTarget: a3El, eventOptions: { passive: false } })
useDrag(onDrag, { domTarget: a4El, eventOptions: { passive: false } })
</script>

<template>
  <div
    ref="containerRef"
    class="bg-black size-full relative overflow-hidden bg-center bg-cover before:bg-[#0000009e] before:absolute before:inset-[0] before:backdrop-blur-2xl select-none"
    :style="settings.theaterMode ? { backgroundImage: `url(${src})` } : {}"
  >
    <div ref="a1" class="cursor-move absolute z-10 h-[60px] inset-x-0 top-0" />
    <div ref="a4" class="cursor-move absolute z-10 h-[60px] inset-x-0 bottom-0" />
    <div ref="a3" class="cursor-move absolute z-10 w-[60px] inset-y-0 right-0" />

    <img
      class="absolute top-0 left-0 block origin-top-left will-change-transform p-0 m-0"
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
    >

    <div v-if="error" class="relative z-10 text-white bg-black/50">
      Unable to load the image
    </div>

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
