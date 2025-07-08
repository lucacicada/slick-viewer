<script setup lang="ts">
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

const options = computed(() => ({
  src: url.value || 'https://picsum.photos/seed/picsum/600/400',
  type: file.value?.type,
}))
</script>

<template>
  <div ref="dropDivRef" class="w-screen h-screen overflow-hidden">
    <ImageViewer :src="options.src" :type="options.type" />
  </div>
</template>
