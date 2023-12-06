import { computed, inject } from 'vue'
import type { ComputedRef } from 'vue'
import {
  BlokkliItemDefinitionOptionsInput,
  InjectedParagraphItem,
  ParagraphsBuilderEditContext,
} from '#blokkli/types'
import { globalOptions } from '#blokkli/definitions'
import { globalOptionsDefaults } from '#blokkli/default-global-options'

import {
  ValidGlobalConfigKeys,
  BlokkliItemDefinitionInputWithTypes,
  ValidFieldListTypes,
  ValidParentParagraphBundle,
} from '#blokkli/generated-types'
import {
  INJECT_BLOCK_ITEM,
  INJECT_EDIT_CONTEXT,
  INJECT_FIELD_LIST_TYPE,
} from '../helpers/symbols'

type StringBoolean = '0' | '1'

type GetType<T> = T extends { type: 'checkbox' }
  ? StringBoolean
  : T extends { type: 'radios' }
  ? T extends { options: infer O }
    ? keyof O
    : string
  : string

type WithOptions<T extends BlokkliItemDefinitionOptionsInput> = {
  [K in keyof T]: GetType<T[K]>
}

type GlobalOptionsType = typeof globalOptions

type GlobalOptionsKeyTypes<T extends ValidGlobalConfigKeys> = {
  [K in T[number]]: GetType<GlobalOptionsType[K]>
}

type Paragraph<T extends BlokkliItemDefinitionInputWithTypes> = {
  /**
   * The UUID of the paragraph.
   */
  uuid: string

  /**
   * The index of the paragraph in the field list.
   */
  index: ComputedRef<number>

  /**
   * Whether the paragraph is being displayed in an editing context.
   */
  isEditing: boolean

  /**
   * The bundle (Drupal bundle name, e.g. "teaser_list") of the parent
   * paragraph if the paragraph is nested.
   */
  parentParagraphBundle: ComputedRef<ValidParentParagraphBundle | undefined>

  /**
   * The type of the field list the paragraph is part of.
   */
  fieldListType: ComputedRef<ValidFieldListTypes>

  /**
   * The reactive runtime options.
   *
   * This includes both the locally defined options and the inherited global
   * options.
   */
  options: ComputedRef<
    (T['options'] extends BlokkliItemDefinitionOptionsInput
      ? WithOptions<T['options']>
      : {}) &
      (T['globalOptions'] extends ValidGlobalConfigKeys
        ? GlobalOptionsKeyTypes<T['globalOptions']>
        : {})
  >
}

/**
 * Define a paragraph component.
 */
export function defineParagraph<T extends BlokkliItemDefinitionInputWithTypes>(
  config: T,
): Paragraph<T> {
  // The default options are provided by the paragraph itself.
  const defaultOptions: Record<string, any> = {}
  for (const key in config.options) {
    if (config.options[key] && 'default' in config.options[key]) {
      defaultOptions[key] = config.options[key].default
    }
  }

  // If the paragraph uses global options, we add the default values from the
  // global options to the default options of this paragraph.
  if (config.globalOptions) {
    for (const key in config.globalOptions) {
      const defaultValue = (globalOptionsDefaults as any)[key as any]
      if (defaultValue !== undefined) {
        defaultOptions[key] = defaultValue
      }
    }
  }

  const fieldListType = inject<ComputedRef<ValidFieldListTypes>>(
    INJECT_FIELD_LIST_TYPE,
    computed(() => 'default'),
  )!

  // Inject the data from the ParagraphItem component.
  const paragraphItem = inject<InjectedParagraphItem>(INJECT_BLOCK_ITEM)
  const uuid = paragraphItem?.value.uuid || ''
  const index =
    paragraphItem?.value.index !== undefined
      ? paragraphItem.value.index
      : computed(() => 0)

  const parentParagraphBundle = computed(() => {
    return paragraphItem?.value
      .parentParagraphBundle as ValidParentParagraphBundle
  })

  // This is injected by the "from_library" paragraph component.
  // If its present it means this paragraph is reusable. In this case it
  // inherits the options defined on its wrapper paragraph.
  const fromLibraryOptions = inject<any>('paragraphFromLibraryOptions', null)
  if (fromLibraryOptions) {
    return {
      uuid,
      index,
      isEditing: !!paragraphItem?.value.isEditing,
      options: fromLibraryOptions,
      parentParagraphBundle,
      fieldListType,
    }
  }

  // When we are in an edit context, the current options are managed in a
  // separate reactive state. This state is mutated when the user is changing
  // the options. These options are only persisted once the user closes the
  // options popup. In order to have live preview of how these options affect
  // the paragraph, we use this state to override the paragraphs options.
  const editContext = inject<ParagraphsBuilderEditContext | null>(
    INJECT_EDIT_CONTEXT,
    null,
  )
  if (editContext && uuid) {
    const options = computed(() => {
      const overrideOptions =
        editContext.mutatedOptions.value[uuid]?.paragraph_builder_data || {}
      return {
        ...defaultOptions,
        ...(paragraphItem?.value.paragraphsBuilderOptions || {}),
        ...overrideOptions,
      }
    })
    return {
      options,
      index,
      uuid,
      isEditing: !!paragraphItem?.value.isEditing,
      parentParagraphBundle,
      fieldListType,
    } as any
  }

  const options = computed(() => {
    return {
      ...defaultOptions,
      ...paragraphItem?.value.paragraphsBuilderOptions,
    }
  })

  return {
    uuid,
    index,
    options,
    isEditing: !!paragraphItem?.value.isEditing,
    parentParagraphBundle,
    fieldListType,
  } as any
}
