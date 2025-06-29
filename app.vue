<script setup lang="ts">
const containerRef = useTemplateRef('containerRef')

const file = shallowRef()
const url = useObjectUrl(file)

const src = computed(() => url.value || 'https://picsum.photos/seed/picsum/600/400')

useDropZone(containerRef, {
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
</script>

<template>
  <div ref="containerRef" class="h-screen w-screen">
    <ImageViewer :src="src" />
  </div>
</template>
