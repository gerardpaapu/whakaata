interface Field<T, K extends keyof T> {
  key: K
  type: Reflection<T[K]>
}

export interface Reflection<T> {
  getTypeOf(): 'number' | 'string' | 'object' | 'undefined'
  isNull(): boolean
  fields(): Field<T, keyof T>[]
  is(u: unknown): u is T
}

export default function reflect<T>(): Reflection<T> {
  return null as any
}
