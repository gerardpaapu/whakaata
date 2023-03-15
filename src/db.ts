import {
  Reflect,
  $array,
  is,
  $named,
  $object,
  $number,
  $string,
} from './schema'

type ColumnSchema =
  | { kind: 'number' }
  | { kind: 'string' }
  | { kind: 'boolean' }

type ReflectColumn<T> = T extends { kind: 'string' }
  ? StringExpr
  : T extends { kind: 'number' }
  ? NumberExpr
  : T extends { kind: 'boolean' }
  ? BoolExpr
  : never

type TableSchema = {
  kind: 'named'
  name: string
  schema: {
    kind: 'object'
    entries: Record<string, ColumnSchema>
  }
}

type ReflectTable<T extends TableSchema> = T extends {
  schema: {
    kind: 'object'
    entries: infer S
  }
}
  ? {
      [Key in keyof S]: ReflectColumn<S[Key]>
    }
  : never

interface BoolExpr {
  and(n: BoolExpr): BoolExpr
  or(n: BoolExpr): BoolExpr
  unwrap(): string
}

const boolExpr = (expr: string): BoolExpr => ({
  and(x) {
    return boolExpr(`${expr} AND ${x.unwrap()}`)
  },
  or(x) {
    return boolExpr(`${expr} OR ${x.unwrap()}`)
  },
  unwrap() {
    return expr
  },
})

interface NumberExpr {
  greaterThan(n: NumberExpr | number): BoolExpr
  lessThan(n: NumberExpr | number): BoolExpr
  equals(n: NumberExpr | number): BoolExpr
  unwrap(): string
}

const numberExpr = (expr: string): NumberExpr => ({
  greaterThan(n) {
    const rhs = typeof n === 'number' ? n : n.unwrap()
    return boolExpr(`${expr} > ${rhs}`)
  },
  lessThan(n) {
    const rhs = typeof n === 'number' ? n : n.unwrap()
    return boolExpr(`${expr} < ${rhs}`)
  },
  equals(n) {
    const rhs = typeof n === 'number' ? n : n.unwrap()
    return boolExpr(`${expr} = ${rhs}`)
  },
  unwrap() {
    return expr
  },
})

interface StringExpr {
  equals(n: StringExpr | string): BoolExpr
  like(s: string): BoolExpr
  unwrap(): string
}

const stringExpr = (expr: string): StringExpr => ({
  equals(x) {
    const rhs = typeof x === 'string' ? x : x.unwrap()
    return boolExpr(`${expr} = ${rhs}`)
  },
  like(pattern) {
    // TODO: JSON.stringify isn't exactly right here
    return boolExpr(`${expr} LIKE ${JSON.stringify(pattern)}`)
  },
  unwrap() {
    return expr
  },
})

type WhereClause<Row> = (row: Row) => BoolExpr
type OrderClause<Row> = {
  order: 'desc' | 'asc'
  pick: (row: Row) => NumberExpr | StringExpr
}

interface Query<T extends TableSchema, Row = ReflectTable<T>> {
  $schema: T
  whereClauses: WhereClause<Row>[]
  orderByClause?: OrderClause<Row>
}

interface QueryBuilder<T extends TableSchema, Row = ReflectTable<T>> {
  where(clause: WhereClause<Row>): this
  orderBy(
    order: 'desc' | 'asc',
    pick: (row: Row) => NumberExpr | StringExpr
  ): this
  unwrap(): Query<T>
}

function query<T extends TableSchema>($schema: T): QueryBuilder<T> {
  const inner: Query<T> = {
    $schema,
    whereClauses: [],
  }

  return {
    where(f) {
      inner.whereClauses.push(f)
      return this
    },
    orderBy(order, pick) {
      inner.orderByClause = { order, pick }
      return this
    },
    unwrap() {
      return inner
    },
  }
}

function schemaToRow<T extends TableSchema>($schema: T): ReflectTable<T> {
  const row = {} as any
  const columns = $schema.schema.entries
  for (const [k, s] of Object.entries(columns)) {
    switch (s.kind) {
      case 'boolean':
        row[k] = boolExpr(k)
        break
      case 'string':
        row[k] = stringExpr(k)
        break
      case 'number':
        row[k] = numberExpr(k)
        break
    }
  }

  return row
}

const $Garden = $named(
  'Garden',
  $object({
    width: $number,
    height: $number,
    soilType: $string,
  })
)

const row = schemaToRow($Garden)

const t = row.height
  .greaterThan(12)
  .and(row.width.greaterThan(6))
  .and(row.soilType.like('peat%'))
  .unwrap()

function toSql<T extends TableSchema>(query: Query<T>) {
  const row = schemaToRow(query.$schema)
  let sql = `SELECT * FROM ${query.$schema.name}`
  for (const clause of query.whereClauses) {
    sql += `\nWHERE ${clause(row).unwrap()}`
  }

  if (query.orderByClause) {
    sql += `\nORDER BY ${query.orderByClause
      .pick(row)
      .unwrap()} ${query.orderByClause.order.toUpperCase()}`
  }

  return sql
}

async function runQuery(sql: string): Promise<unknown[]> {
  console.log(sql)
  throw new Error(`Oops, I'm not a real database`)
}

export async function get<T extends TableSchema, Ret = Reflect<T>>(
  $schema: T,
  build: (q: QueryBuilder<T>) => void
): Promise<Ret[]> {
  const builder = query($schema)
  const arraySchema = $array($schema)
  build(builder)
  const sql = toSql(builder.unwrap())
  const records = await runQuery(sql)

  if (is(arraySchema)(records)) {
    return records as Ret[]
  }

  throw new TypeError()
}

interface DB<T extends TableSchema, Ret = Reflect<T>> {
  get(build: (q: QueryBuilder<T>) => void): Promise<Ret[]>
}

export function table<T extends TableSchema>($schema: T): DB<T> {
  return {
    get(build) {
      return get($schema, build)
    },
  }
}
