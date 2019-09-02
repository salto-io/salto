import { Element } from 'adapter-api'
import { SaveResult } from 'jsforce'
import SalesforceClient from '../client/client'

// Filter interface, filters will be activated upon adapter discover, add, update and remove
// operations. The filter will be responsible for specific business logic.
// For example, field permissions filter will add field_level_security annotation and will read
// it and update permissions accordingly.
export default interface Filter {
  onDiscover(client: SalesforceClient, elements: Element[]): Promise<void>
  onAdd(client: SalesforceClient, after: Element): Promise<SaveResult[]>
  onUpdate(client: SalesforceClient, before: Element, after: Element): Promise<SaveResult[]>
  onRemove(client: SalesforceClient, before: Element): Promise<SaveResult[]>
}
