<script setup lang="ts">
import type { ImageViewerOptions } from './components/ImageViewer.vue'

const dropDivEl = useTemplateRef('dropDivRef')

const file = shallowRef<File>()
const url = useObjectUrl(file)

useDropZone(dropDivEl, {
  multiple: false,
  preventDefaultForUnhandled: true,
  onDrop(files) {
    if (files && files.length > 0) {
      file.value = files[0]
    }
  },
})

const options = computed<ImageViewerOptions>(() => ({
  src: url.value || 'https://picsum.photos/seed/picsum/600/400',
  type: file.value?.type,
  padding: 40,
  controls: {
    pan: {
      enabled: true,
      button: ['left', 'middle'],
    },
    area: {
      enabled: true,
      button: 'right',
    },
  },
  shortcuts: {
    ' ': context => context.centerImage(),
    'Escape': context => context.rotateExact(0),
    'ArrowLeft': context => context.rotate(-10),
    'ArrowRight': context => context.rotate(10),
    '+': context => context.zoom(1.1),
    '-': context => context.zoom(0.9),
    'Wheel': (context, event) => {
      const e = event as WheelEvent

      // Rotate instead of zooming under the cursor
      if (event.shiftKey) {
        const angle = Math.sign(e.deltaY) * 15 // Rotate 15 degrees per scroll step
        context.rotateAtMousePoint(angle, e)
      }
      else {
        context.zoomAtMousePoint(e.deltaY < 0 ? 1.1 : 0.9, e)
      }
    },
  },
}))
</script>

<template>
  <div ref="dropDivRef" class="w-screen h-screen overflow-hidden">
    <ImageViewer v-bind="options" />
  </div>
</template>
