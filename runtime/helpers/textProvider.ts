import { translations, ValidTextKeys } from '#blokkli/translations'
import { BlokkliAdapterContext } from '../adapter'

export type BlokkliTextProvider = (key: ValidTextKeys) => string

export default function (
  context: ComputedRef<BlokkliAdapterContext>,
): BlokkliTextProvider {
  const defaultLanguage = useRuntimeConfig().public.blokkli
    .defaultLanguage as keyof typeof translations
  const language = computed(() => {
    if (
      context.value.language &&
      (translations as any)[context.value.language]
    ) {
      return context.value.language as keyof typeof translations
    }
    return defaultLanguage
  })
  const currentTranslations = computed(() => {
    return translations[language.value]
  })
  return (key: ValidTextKeys) => {
    return currentTranslations.value[key] || translations.en[key]
  }
}
