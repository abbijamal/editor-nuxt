import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import { walk } from 'estree-walker'
import type { Nuxt } from '@nuxt/schema'
import type { CallExpression, Expression, ObjectExpression } from 'estree'
import { ParagraphDefinitionInput } from '../runtime/types'

/**
 * Type check for falsy values.
 *
 * Used as the callback for array.filter, e.g.
 * items.filter(falsy)
 */
export function falsy<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined
}

const fileRegex = /\.(vue)$/

type RuntimeParagraphDefintionInput = {
  options?: {
    [key: string]: {
      default: string
    }
  }
  globalOptions?: string[]
}

/**
 * Build an object from an ObjectExpression.
 */
function estreeToObject(
  expression: ObjectExpression,
): ParagraphDefinitionInput<any> {
  return Object.fromEntries(
    expression.properties
      .map((prop) => {
        if (prop.type === 'Property') {
          if ('name' in prop.key) {
            if (prop.value.type === 'Literal') {
              return [prop.key.name, prop.value.value]
            } else if (prop.value.type === 'ObjectExpression') {
              return [prop.key.name, estreeToObject(prop.value)]
            }
          }
        }
        return null
      })
      .filter(falsy),
  )
}

/**
 * Build the runtime paragraph definition from the full definition.
 *
 * During runtime, only the option default values and the array of globel
 * options are needed.
 */
function buildRuntimeDefinition(
  definition: ParagraphDefinitionInput<any>,
): RuntimeParagraphDefintionInput {
  const runtimeDefinition: RuntimeParagraphDefintionInput = {}

  if (definition.options) {
    runtimeDefinition.options = {}
    Object.entries(definition.options).forEach(
      ([optionKey, optionDefinition]) => {
        if (optionDefinition.default) {
          runtimeDefinition.options![optionKey] = {
            default: optionDefinition.default,
          }
        }
      },
    )
  }
  if (definition.globalOptions) {
    runtimeDefinition.globalOptions = definition.globalOptions
  }

  return runtimeDefinition
}

export const ParagraphsBuilderPlugin = (nuxt: Nuxt) =>
  createUnplugin(() => {
    return {
      name: 'transform-file',
      enforce: 'post',
      transform(source, id) {
        if (!fileRegex.test(id)) {
          return
        }

        if (!source.includes('defineParagraph')) {
          return
        }
        const s = new MagicString(source)

        walk(
          this.parse(source, {
            sourceType: 'module',
            ecmaVersion: 'latest',
          }),
          {
            enter: async (_node) => {
              if (
                _node.type !== 'CallExpression' ||
                (_node as CallExpression).callee.type !== 'Identifier'
              ) {
                return
              }
              const node = _node as CallExpression & {
                start: number
                end: number
              }
              const name = 'name' in node.callee && node.callee.name
              if (name === 'defineParagraph') {
                const arg = node.arguments[0]
                const meta = node.arguments[0] as Expression & {
                  start: number
                  end: number
                }
                if (arg.type === 'ObjectExpression') {
                  const definition = estreeToObject(arg)
                  const runtimeDefinition = buildRuntimeDefinition(definition)
                  const start = meta.start
                  const end = meta.end
                  s.overwrite(start, end, JSON.stringify(runtimeDefinition))
                }
              }
            },
          },
        )

        if (s.hasChanged()) {
          return {
            code: s.toString(),
            map:
              nuxt.options.sourcemap.client || nuxt.options.sourcemap.server
                ? s.generateMap({ hires: true })
                : null,
          }
        }

        return source
      },
    }
  })
