import { Element } from 'adapter-api'
import { SaveResult } from 'jsforce-types'
import { HasMember, filterHasMember } from './typeutils'
import SalesforceClient from './client/client'

// Filter interface, filters will be activated upon adapter discover, add, update and remove
// operations. The filter will be responsible for specific business logic.
// For example, field permissions filter will add field_level_security annotation and will read
// it and update permissions accordingly.
export type FilterInstance = Partial<{
  onDiscover(elements: Element[]): Promise<void>
  onAdd(after: Element): Promise<SaveResult[]>
  onUpdate(before: Element, after: Element): Promise<SaveResult[]>
  onRemove(before: Element): Promise<SaveResult[]>
}>

export type FilterInstanceWith<M extends keyof FilterInstance> = HasMember<FilterInstance, M>

export const onlyInstancesWith = <M extends keyof FilterInstance>(
  m: M,
  filters: FilterInstance[],
): FilterInstanceWith<M>[] => filterHasMember<FilterInstance, M>(m, filters)

export type Filter = (client: SalesforceClient) => FilterInstance
