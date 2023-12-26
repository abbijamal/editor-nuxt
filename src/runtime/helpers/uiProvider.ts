import {
  type Ref,
  type ComputedRef,
  onMounted,
  onBeforeUnmount,
  ref,
} from 'vue'
import { eventBus } from './eventBus'
import type { BlokkliStorageProvider } from './storageProvider'

export type BlokkliUiProvider = {
  rootElement: () => HTMLElement
  artboardElement: () => HTMLElement
  providerElement: () => HTMLElement
  menu: {
    isOpen: Readonly<Ref<boolean>>
    close: () => void
    open: () => void
  }
  getArtboardScale: () => number
  isMobile: ComputedRef<boolean>
  isDesktop: ComputedRef<boolean>
  isArtboard: () => boolean
  isAnimating: Ref<boolean>
  useAnimations: ComputedRef<boolean>
}

export default function (storage: BlokkliStorageProvider): BlokkliUiProvider {
  let cachedRootElement: HTMLElement | null = null
  let cachedArtboardElement: HTMLElement | null = null
  let cachedProviderElement: HTMLElement | null = null

  const menuIsOpen = ref(false)
  const isAnimating = ref(false)
  const useAnimationsSetting = storage.use('useAnimations', true)
  const useAnimations = computed(() => useAnimationsSetting.value)

  const artboardElement = () => {
    if (cachedArtboardElement) {
      return cachedArtboardElement
    }
    const el = document.querySelector('.bk-main-canvas')
    if (!el || !(el instanceof HTMLElement)) {
      throw new Error('Failed to locate artboard element.')
    }
    cachedArtboardElement = el
    return el
  }

  const rootElement = () => {
    if (cachedRootElement) {
      return cachedRootElement
    }
    const el = document.querySelector('#nuxt-root')
    if (!el || !(el instanceof HTMLElement)) {
      throw new Error('Failed to locate root Nuxt element.')
    }
    cachedRootElement = el
    return el
  }

  const providerElement = () => {
    if (cachedProviderElement) {
      return cachedProviderElement
    }
    const el = document.querySelector('[data-blokkli-provider-active="true"]')
    if (!el || !(el instanceof HTMLElement)) {
      throw new Error('Failed to locate provider element.')
    }
    cachedProviderElement = el
    return el
  }

  const getArtboardScale = () => {
    const el = artboardElement()
    const scaleValue = parseFloat(el.style.scale || '1')
    if (isNaN(scaleValue)) {
      return 1
    }
    return scaleValue
  }

  const viewportWidth = ref(window.innerWidth)
  const isMobile = computed(() => viewportWidth.value < 768)
  const isDesktop = computed(() => viewportWidth.value > 1024)

  let resizeTimeout: any = null

  const onResize = () => {
    viewportWidth.value = window.innerWidth

    clearTimeout(resizeTimeout)

    resizeTimeout = setTimeout(() => {
      eventBus.emit('ui:resized')
    }, 400)
  }

  const isArtboard = () => {
    return document.documentElement.classList.contains('bk-is-artboard')
  }

  watch(isAnimating, (is) => {
    is
      ? document.documentElement.classList.add('bk-is-animating')
      : document.documentElement.classList.remove('bk-is-animating')
  })

  onMounted(async () => {
    viewportWidth.value = window.innerWidth
    window.addEventListener('resize', onResize)
    document.documentElement.classList.add('bk-html-root')
    document.body.classList.add('bk-body')
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
    document.documentElement.classList.remove('bk-html-root')
    document.body.classList.remove('bk-body')
    clearTimeout(resizeTimeout)
  })

  return {
    menu: {
      isOpen: menuIsOpen,
      close: () => (menuIsOpen.value = false),
      open: () => (menuIsOpen.value = true),
    },
    artboardElement,
    rootElement,
    providerElement,
    getArtboardScale,
    isMobile,
    isDesktop,
    isArtboard,
    isAnimating,
    useAnimations,
  }
}
