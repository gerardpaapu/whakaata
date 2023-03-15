export type Schema =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'null' }
  | { kind: 'undefined' }
  | { kind: 'array'; item: Schema }
  | { kind: 'object'; entries: Record<any, Schema> }
  | { kind: 'named'; name: string; schema: Schema }

export const $string = { kind: 'string' } as const
export const $number = { kind: 'number' } as const
export const $boolean = { kind: 'boolean' } as const
export const $null = { kind: 'null' } as const
export const $undefined = { kind: 'undefined' } as const

export function $array<T extends Schema>(item: T) {
  return { kind: 'array', item } as const
}

export function $object<T extends Record<any, Schema>>(entries: T) {
  return { kind: 'object', entries } as const
}

export function $named<T extends Schema, Name extends string>(
  name: Name,
  schema: T
) {
  return { kind: 'named', name, schema } as const
}

export type Reflect<T> = T extends { kind: 'string' }
  ? string
  : T extends { kind: 'number' }
  ? number
  : T extends { kind: 'boolean' }
  ? boolean
  : T extends { kind: 'null' }
  ? null
  : T extends { kind: 'undefined' }
  ? undefined
  : T extends { kind: 'array'; item: infer U }
  ? Reflect<U>[]
  : T extends { kind: 'object'; entries: infer U }
  ? { [K in keyof U]: Reflect<U[K]> }
  : T extends { kind: 'named'; name: string; schema: infer U }
  ? Reflect<U>
  : never

export type GetName<T> = T extends { kind: 'named'; name: infer U } ? U : never

export function is<T extends Schema>(schema: T) {
  return (u: unknown): u is Reflect<T> => {
    switch (schema.kind) {
      case 'string':
        return typeof u === 'string'
      case 'number':
        return typeof u === 'number'
      case 'boolean':
        return typeof u === 'boolean'
      case 'null':
        return u === null
      case 'undefined':
        return u === undefined
      case 'array':
        return Array.isArray(u) && u.every((u: unknown) => is(schema.item)(u))

      case 'object':
        if (typeof u !== 'object' || u == null) {
          return false
        }

        const obj = u as Record<any, unknown>
        for (const [key, $schema] of Object.entries(u)) {
          const isProperty = is($schema)
          if (!isProperty(obj[key])) {
            return false
          }
        }

        return true

      case 'named':
        return is(schema.schema)(u)
    }
  }
}

export function describe<T extends Schema>(schema: T): string {
  switch (schema.kind) {
    case 'string':
      return 'string'
    case 'boolean':
      return 'boolean'
    case 'number':
      return 'number'
    case 'null':
      return 'null'
    case 'undefined':
      return 'undefined'
    case 'array':
      return `array of (${describe(schema.item)})`

    case 'object': {
      let lines = ''
      for (const [key, value] of Object.entries(schema.entries)) {
        lines += `${JSON.stringify(key)} = ${describe(value)};\n`
      }

      return `object of (${lines})`
    }

    case 'named':
      return `named ${JSON.stringify(schema.name)} (${describe(schema.schema)})`
  }
}
