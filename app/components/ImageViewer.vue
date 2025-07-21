<script setup lang="ts">
import { ImageIcon, ImageOff, Maximize, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-vue-next'

defineProps<{
  src: string
  type?: string
}>()

const container = useTemplateRef('containerRef')
const content = useTemplateRef('mediaRef')

const { transform, width, height, area, ...context } = useViewportControl(
  container,
  content,
  {
    padding: 20,
  },
)

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
        transform,
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
        transform,
      }"
    >

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

    <div class="absolute inset-y-0 z-50 flex group">
      <div class="-translate-x-full flex flex-col gap-2 transition-transform duration-300 ease-in-out w-[65px] items-center group-hover:translate-x-0">
        <div class="flex-1" />

        <button
          type="button"
          class="flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
          @click="context.zoom(1.1)"
        >
          <ZoomIn class="size-6" />
        </button>

        <button
          type="button"
          class="flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
          @click="context.zoom(0.9)"
        >
          <ZoomOut class="size-6" />
        </button>

        <button
          type="button"
          class="flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
          @click="context.rotate(-10)"
        >
          <RotateCcw class="size-6" />
        </button>

        <button
          type="button"
          class="flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
          @click="context.rotate(10)"
        >
          <RotateCw class="size-6" />
        </button>

        <button
          type="button"
          class="flex items-center justify-center p-1.5 text-white transition-colors duration-300 ease-in-out rounded-lg cursor-pointer shrink-0 bg-black/50 size-8 hover:bg-black/80"
          @click="context.centerImage()"
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
      </div>
    </div>
  </div>
</template>
