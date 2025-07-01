<script setup lang="ts">
import type { ImageViewerOptions } from './components/ImageViewer.vue'

const dropDivEl = useTemplateRef('dropDivRef')

const file = shallowRef<File>()
const url = useObjectUrl(file)

useDropZone(dropDivEl, {
  // dataTypes: [
  //   'image/jpeg',
  //   'image/png',
  //   'image/gif',
  //   'image/webp',
  //   'image/bmp',
  //   'image/avif',
  //   'image/svg+xml',
  //   'image/tiff',
  //   'image/x-icon',
  //   'image/heic',
  //   'image/heif',
  //   'image/jxl',
  // ],
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
}))
</script>

<template>
  <div ref="dropDivRef" class="w-screen h-screen overflow-hidden">
    <ImageViewer v-bind="options" />
  </div>
</template>
