import mitt from 'mitt'
import { BlokkliMutatedField, UpdateBlokkliItemOptionEvent } from '../types'

type FrameEventBusEvents = {
  selectItems: string[]
  mutatedFields: BlokkliMutatedField[]
  focus: string
  updateOption: UpdateBlokkliItemOptionEvent
}

export const frameEventBus = mitt<FrameEventBusEvents>()
