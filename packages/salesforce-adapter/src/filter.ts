import { Element, Change } from 'adapter-api'
import { SaveResult, UpsertResult } from 'jsforce-types'
import { types } from '@salto/lowerdash'
import SalesforceClient from './client/client'

// Filter interface, filters will be activated upon adapter fetch, add, update and remove
// operations. The filter will be responsible for specific business logic.
// For example, field permissions filter will add field_level_security annotation and will read
// it and update permissions accordingly.
export type Filter = Partial<{
  onFetch(elements: Element[]): Promise<void>
  onAdd(after: Element): Promise<(SaveResult| UpsertResult)[]>
  onUpdate(before: Element, after: Element, changes: Iterable<Change>):
    Promise<(SaveResult| UpsertResult)[]>
  onRemove(before: Element): Promise<SaveResult[]>
}>

export type FilterWith<M extends keyof Filter> = types.HasMember<Filter, M>

export const filtersWith = <M extends keyof Filter>(
  m: M,
  filters: Filter[],
): FilterWith<M>[] => types.filterHasMember<Filter, M>(m, filters)

export type FilterCreator = (opts: { client: SalesforceClient }) => Filter
