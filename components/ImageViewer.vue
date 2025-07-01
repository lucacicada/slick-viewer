<script setup lang="ts">
import type { FullGestureState, StateKey } from '@vueuse/gesture'
import { onKeyDown, useImage } from '@vueuse/core'
import { useDrag } from '@vueuse/gesture'
import { ChevronDown, ImageIcon, ImageOff, Maximize, RotateCcw, RotateCw, SquarePower, Underline, ZoomIn, ZoomOut } from 'lucide-vue-next'

const { src } = defineProps<{
  src?: string
}>()

const CENTER_PADDING = 40
const alwaysSuppressContextMenu = false

const containerRef = useTemplateRef('containerRef')

const { state, error } = useImage(() => ({ src: src as string }))
const computedNaturalWidth = computed(() => state.value?.naturalWidth || 0)
const computedNaturalHeight = computed(() => state.value?.naturalHeight || 0)

const transformMatrix = shallowRef<DOMMatrix>(typeof DOMMatrix === 'undefined' ? undefined as unknown as DOMMatrix : new DOMMatrix())

const rotationInDeg = computed(() => {
  if (!transformMatrix.value) {
    return 0
  }

  let angle = Math.atan2(transformMatrix.value.b, transformMatrix.value.a)
  angle = angle * (180 / Math.PI)

  // FIXME: the angle sometimes is very close to 0, but not exactly 0
  // this is likely due to rotateExact that try to subtract the current angle
  return Math.abs(angle) < 0.0001 ? 0 : angle
})

function getSize() {
  const rect = containerRef.value?.getBoundingClientRect()
  const i = state.value

  if (!transformMatrix.value || !i || !rect || !i.naturalWidth || !i.naturalHeight) {
    return null
  }

  return {
    container: rect,
    image: i,
  }
}

function zoom(scaleFactor: number) {
  const size = getSize()

  if (!size) {
    return
  }

  transformMatrix.value = transformMatrix.value
    .translate(size.image.naturalWidth / 2, size.image.naturalHeight / 2)
    .scale(scaleFactor)
    .translate(-size.image.naturalWidth / 2, -size.image.naturalHeight / 2)
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

  if (scaleFactor < 1) {
    // Get the size of the image after scaling
    const currentWidth = (size.image.naturalWidth * transformMatrix.value.a)
    const currentHeight = (size.image.naturalHeight * transformMatrix.value.d)

    // Prevent zooming out too much
    if (Math.max(currentWidth, currentHeight) < 50) {
      return
    }
  }

  transformMatrix.value = transformMatrix.value
    .translate(pointInImageCoords.x, pointInImageCoords.y)
    .scale(scaleFactor)
    .translate(-pointInImageCoords.x, -pointInImageCoords.y)
}

function rotate(deg: number) {
  const size = getSize()

  if (!size) {
    return
  }

  transformMatrix.value = transformMatrix.value
    .translate(size.image.naturalWidth / 2, size.image.naturalHeight / 2)
    .rotate(deg)
    .translate(-size.image.naturalWidth / 2, -size.image.naturalHeight / 2)
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

  transformMatrix.value = transformMatrix.value
    .translate(pointInImageCoords.x, pointInImageCoords.y)
    .rotate(deg)
    .translate(-pointInImageCoords.x, -pointInImageCoords.y)
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

function centerImage() {
  const size = getSize()

  if (!size) {
    return
  }

  const scale = Math.min(
    (size.container.width - CENTER_PADDING) / size.image.naturalWidth,
    (size.container.height - CENTER_PADDING) / size.image.naturalHeight,
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

// state is never updated in SSR
watchImmediate(state, (newState) => {
  if (newState) {
    centerImage()
  }
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

// Center the image on space key press
onKeyDown(' ', (event) => {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  centerImage()
}, {
  dedupe: true,
})

onKeyDown('Escape', (event) => {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  rotateExact(0)
}, {
  dedupe: true,
})

onKeyDown('ArrowLeft', (event) => {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  rotate(-10)
}, {
  dedupe: true,
})

onKeyDown('ArrowRight', (event) => {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  rotate(10)
}, {
  dedupe: true,
})

onKeyDown('+', (event) => {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  zoom(1.1)
}, {
  dedupe: true,
})

onKeyDown('-', (event) => {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  zoom(0.9)
}, {
  dedupe: true,
})

let suppressContextMenu = false

const pointer = ref({
  pointerId: undefined as number | undefined,
  down: false as 'pad' | 'area' | false,
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
})

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

const IGNORE_L_CLICK = false

useEventListener(containerRef, 'pointerdown', (event) => {
  if (event.shiftKey || event.ctrlKey) {
    return
  }

  // Left, middle or right click only
  if (event.button < 0 || event.button > 2) {
    return
  }

  if (IGNORE_L_CLICK && event.button === 0) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  pointer.value = {
    pointerId: event.pointerId,
    down: event.button === 0 || event.button === 1 ? 'pad' : 'area',
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

  if (pointer.value.down === 'pad') {
    pad(deltaX, deltaY)
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
    select(area.value)
  }

  pointer.value.pointerId = undefined
  pointer.value.down = false
}, {
  passive: true,
})

useEventListener(containerRef, 'contextmenu', (event) => {
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
  capture: true,
  passive: false,
})

useEventListener(containerRef, 'wheel', (event) => {
  // if (event.ctrlKey) {
  //   return
  // }

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  // Rotate instead of zooming under the cursor
  if (event.shiftKey) {
    const angle = Math.sign(event.deltaY) * 15 // Rotate 15 degrees per scroll step
    rotateAtMousePoint(angle, event)
  }
  else {
    zoomAtMousePoint(event.deltaY < 0 ? 1.1 : 0.9, event)
  }
}, {
  capture: true,
  passive: false,
})

// Fix for some wired glitch when the image overflows the container in rare occasions on first load
const { stop } = useResizeObserver(containerRef, () => {
  centerImage()
  stop()
})

//

const menuContainerRef = useTemplateRef('menuContainerRef')
const isHovered = useElementHover(menuContainerRef, { delayEnter: 200, delayLeave: 600 })

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

    rotate(angle)
  }
}

const a1 = useTemplateRef('a1')
// const a2 = useTemplateRef('a2')
const a3 = useTemplateRef('a3')
const a4 = useTemplateRef('a4')

useDrag(onDrag, { domTarget: a1, eventOptions: { passive: false } })
// useDrag(onDrag, { domTarget: a2, eventOptions: { passive: false } })
useDrag(onDrag, { domTarget: a3, eventOptions: { passive: false } })
useDrag(onDrag, { domTarget: a4, eventOptions: { passive: false } })
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
      class="absolute top-0 left-0 block origin-top-left"
      :src="src"
      :width="computedNaturalWidth"
      :height="computedNaturalHeight"
      :style="{
        'will-change': 'transform',
        'display': 'block',
        'position': 'absolute',
        'top': 0,
        'left': 0,
        'margin': 0,
        'padding': 0,
        'width': `${computedNaturalWidth}px`,
        'height': `${computedNaturalHeight}px`,
        'min-width': `${computedNaturalWidth}px`,
        'min-height': `${computedNaturalHeight}px`,
        'max-width': `${computedNaturalWidth}px`,
        'max-height': `${computedNaturalHeight}px`,
        'transform-origin': '0 0',
        'transform': String(transformMatrix || 'matrix(1, 0, 0, 1, 0, 0)'),
      }"
    >

    <div v-if="error" class="text-white bg-black/50 relative z-10">
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
            @click="zoom(1.1)"
          >
            <ZoomIn class="size-6" />
          </button>

          <button
            type="button"
            class="pointer-events-auto flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
            @click="zoom(0.9)"
          >
            <ZoomOut class="size-6" />
          </button>

          <button
            type="button"
            class="pointer-events-auto flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
            @click="rotate(-10)"
          >
            <RotateCcw class="size-6" />
          </button>

          <button
            type="button"
            class="pointer-events-auto flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
            @click="rotate(10)"
          >
            <RotateCw class="size-6" />
          </button>

          <button
            type="button"
            class="pointer-events-auto flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
            @click="rotateExact(0)"
          >
            <Underline class="size-6" />
          </button>

          <button
            type="button"
            class="flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
            @click="centerImage()"
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
