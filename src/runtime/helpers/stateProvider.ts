import {
  type Ref,
  type ComputedRef,
  computed,
  ref,
  readonly,
  onMounted,
  onBeforeUnmount,
  provide,
} from 'vue'
import type {
  MutatedField,
  EditEntity,
  MutatedOptions,
  TranslationState,
  MappedState,
  MutationItem,
  Validation,
  MutateWithLoadingStateFunction,
  EditMode,
  FieldConfig,
} from '#blokkli/types'
import { removeDroppedElements, falsy } from '#blokkli/helpers'
import { eventBus, emitMessage } from '#blokkli/helpers/eventBus'
import type { BlokkliAdapter, AdapterContext } from '../adapter'
import { INJECT_MUTATED_FIELDS } from './symbols'
import { refreshNuxtData } from 'nuxt/app'

export type BlokkliOwner = {
  name: string | undefined
  currentUserIsOwner: boolean
}

export type StateProvider = {
  owner: Readonly<Ref<BlokkliOwner | null>>
  refreshKey: Readonly<Ref<string>>
  mutatedFields: Readonly<Ref<MutatedField[]>>
  entity: Readonly<Ref<EditEntity>>
  mutatedOptions: Ref<MutatedOptions>
  translation: Readonly<Ref<TranslationState>>
  mutations: Readonly<Ref<MutationItem[]>>
  currentMutationIndex: Readonly<Ref<number>>
  violations: Readonly<Ref<Validation[]>>
  mutateWithLoadingState: MutateWithLoadingStateFunction
  editMode: Readonly<Ref<EditMode>>
  canEdit: ComputedRef<boolean>
  isLoading: Readonly<Ref<boolean>>
}

export default async function (
  adapter: BlokkliAdapter<any>,
  context: ComputedRef<AdapterContext>,
): Promise<StateProvider> {
  const owner = ref<BlokkliOwner | null>(null)
  const refreshKey = ref('')
  const mutatedFields = ref<MutatedField[]>([])
  const mutations = ref<MutationItem[]>([])
  const violations = ref<Validation[]>([])
  const currentMutationIndex = ref(-1)
  const isLoading = ref(false)
  const entity = ref<EditEntity>({
    id: undefined,
    changed: undefined,
    status: false,
  })

  const mutatedOptions = ref<MutatedOptions>({})
  const translation = ref<TranslationState>({
    isTranslatable: false,
    sourceLanguage: '',
    availableLanguages: [],
    translations: [],
  })

  function setContext(context?: MappedState) {
    removeDroppedElements()

    mutatedOptions.value = context?.mutatedState?.mutatedOptions || {}
    mutations.value = context?.mutations || []
    violations.value = context?.mutatedState?.violations || []
    const currentIndex = context?.currentIndex
    currentMutationIndex.value = currentIndex === undefined ? -1 : currentIndex
    owner.value = {
      name: context?.ownerName,
      currentUserIsOwner: !!context?.currentUserIsOwner,
    }
    entity.value.id = context?.entity?.id
    entity.value.changed = context?.entity?.changed
    entity.value.label = context?.entity?.label
    entity.value.status = context?.entity?.status
    entity.value.bundleLabel = context?.entity?.bundleLabel || ''
    entity.value.editUrl = context?.entity.editUrl

    translation.value.isTranslatable =
      !!context?.translationState?.isTranslatable
    translation.value.translations =
      context?.translationState?.translations?.filter(falsy) || []
    translation.value.sourceLanguage =
      context?.translationState?.sourceLanguage || ''
    translation.value.availableLanguages =
      context?.translationState?.availableLanguages || []

    const newMutatedFields = context?.mutatedState?.fields || []
    mutatedFields.value = newMutatedFields

    eventBus.emit('updateMutatedFields', { fields: newMutatedFields })

    eventBus.emit('state:reloaded')
    refreshKey.value = Date.now().toString()
  }

  function lockBody() {
    document.body.classList.add('bk-body-loading')
    isLoading.value = true
  }

  function unlockBody() {
    document.body.classList.remove('bk-body-loading')
    isLoading.value = false
  }

  const mutateWithLoadingState: MutateWithLoadingStateFunction = async (
    promise,
    errorMessage,
    successMessage,
  ) => {
    if (!promise) {
      return true
    }
    lockBody()
    try {
      const result = await promise
      unlockBody()
      if (result.data.state?.action?.state) {
        setContext(adapter.mapState(result.data.state?.action?.state))
      } else if (!result.data.state?.action?.success) {
        throw new Error('Unexpected error.')
      }
      if (successMessage) {
        emitMessage(successMessage)
      }
      return true
    } catch (_e) {
      emitMessage(
        errorMessage || 'Es ist ein unerwarteter Fehler aufgetreten.',
        'error',
      )
    }

    unlockBody()
    return false
  }

  async function loadState() {
    const state = await adapter.loadState()
    if (state) {
      setContext(adapter.mapState(state))
    }
  }

  async function onReloadState() {
    removeDroppedElements()
    await loadState()
  }

  async function onReloadEntity() {
    await refreshNuxtData()
    await loadState()
  }

  const canEdit = computed(() => !!owner.value?.currentUserIsOwner)
  const isTranslation = computed(
    () => context.value.language !== translation.value.sourceLanguage,
  )

  const editMode = computed<EditMode>(() => {
    if (!canEdit.value) {
      return 'readonly'
    }
    if (isTranslation.value) {
      return 'translating'
    }

    return 'editing'
  })

  onMounted(() => {
    eventBus.on('reloadState', onReloadState)
    eventBus.on('reloadEntity', onReloadEntity)
  })

  onBeforeUnmount(() => {
    eventBus.off('reloadState', onReloadState)
    eventBus.off('reloadEntity', onReloadEntity)
  })

  provide(
    INJECT_MUTATED_FIELDS,
    computed(() => mutatedFields.value),
  )

  await loadState()

  return {
    refreshKey,
    owner: readonly(owner),
    mutatedFields,
    entity,
    mutatedOptions,
    translation,
    mutations,
    violations,
    currentMutationIndex,
    mutateWithLoadingState,
    editMode,
    canEdit,
    isLoading: readonly(isLoading),
  }
}
