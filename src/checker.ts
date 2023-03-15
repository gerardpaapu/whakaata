type Checker<T> = (u: unknown) => u is T
type Checks<T> = T extends Checker<infer U> ? U : never

function isString(u: unknown): u is string {
  return typeof u === 'string'
}

function isNumber(u: unknown): u is number {
  return typeof u === 'number'
}

function propIs<T, K extends string>(k: K, check: Checker<T>) {
  return (u: unknown): u is { [_ in K]: T } => {
    return typeof u === 'object' && u != null && k in u && check((u as any)[k])
  }
}

function and<A, B>(a: Checker<A>, b: Checker<B>): Checker<A & B> {
  return (u: unknown): u is A & B => a(u) && b(u)
}

function obj<R extends Record<string | symbol, Checker<any>>>(checkers: R) {
  return (u: unknown): u is ChecksObject<R> => {
    if (u == null || typeof u !== 'object') {
      return false
    }

    const data = u as Record<string, unknown>
    for (const [key, checker] of Object.entries(checkers)) {
      if (!checker(data[key])) {
        return false
      }
    }

    return true
  }
}

type ChecksObject<R> = {
  // Mapped Type
  [K in keyof R]: Checks<R[K]>
}

/// ----------------

const isWidget = obj({
  color: isString,
  weight: isNumber,
})

export type Widget = Checks<typeof isWidget>
export const readWidget = makeReader(isWidget)

export function makeReader<T>(checker: Checker<T>) {
  return (source: string) => {
    const data = JSON.parse(source) as unknown
    if (checker(data)) {
      return data
    }

    throw new TypeError()
  }
}
