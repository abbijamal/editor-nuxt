import onBlokkliEvent from './composables/onBlokkliEvent'
import useAnimationFrame from './composables/useAnimationFrame'
import { onMounted, onBeforeUnmount } from '#imports'
import { eventBus } from '#blokkli/helpers/eventBus'

export type AnimationProvider = {
  /**
   * Request an animation loop. Should be called when UI state changes.
   */
  requestDraw: () => void
}

export default function (): AnimationProvider {
  let mouseX = 0
  let mouseY = 0

  // Keep track of how many frames should be rendered.
  // Assuming 60 fps, this value means after every draw request we will only
  // render a maximum of 2 seconds.
  let iterator = 120

  const onPointerMove = (e: PointerEvent) => {
    mouseX = e.clientX
    mouseY = e.clientY
    iterator = 120
  }

  useAnimationFrame(() => {
    // Make sure we don't loop when it's not needed.
    if (iterator < 1) {
      return
    }

    // Decrement the value.
    iterator--

    // Let the "Artboard" feature alter the position/scale of the root element
    // before triggering the main animation loop event.
    eventBus.emit('animationFrame:before')

    const el = document.getElementById('bk-animation-canvas')
    const ctx = el instanceof HTMLCanvasElement ? el.getContext('2d') : null

    if (ctx) {
      const wrapperEl = document.querySelector('.bk-main-canvas')
      if (wrapperEl instanceof HTMLElement) {
        eventBus.emit('animationFrame', {
          mouseX,
          mouseY,
          fieldAreas: [],
          ctx,
        })
      }
    }
  })

  onMounted(() => {
    document.addEventListener('scroll', requestDraw)
    document.body.addEventListener('wheel', requestDraw, { passive: false })
    window.addEventListener('pointermove', onPointerMove, {
      passive: false,
    })
  })

  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onPointerMove)
    document.body.removeEventListener('wheel', requestDraw)
    document.removeEventListener('scroll', requestDraw)
  })

  const requestDraw = () => (iterator = 120)

  onBlokkliEvent('select', requestDraw)
  onBlokkliEvent('select:start', requestDraw)
  onBlokkliEvent('select:end', requestDraw)
  onBlokkliEvent('select:toggle', requestDraw)
  onBlokkliEvent('option:update', requestDraw)
  onBlokkliEvent('state:reloaded', requestDraw)

  return { requestDraw }
}
