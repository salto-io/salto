import { ParseResult } from '../parser/parse'

type AsyncCache<K, V> = {
  get(key: K): Promise<V | undefined>
  put(key: K, value: V): Promise<void>
}

export type ParseResultKey = {
  filename: string
  lastModified: number
}

export type ParseResultCache = AsyncCache<ParseResultKey, ParseResult> &
{ flush: () => Promise<void> }
