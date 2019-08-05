import { Element } from 'adapter-api'
import { SaveResult } from 'jsforce-types'
import _ from 'lodash'
import SalesforceClient from '../client/client'
import { aspect as fieldPermissionsAspect } from './field_permissions'
import { aspect as layoutAspect } from './layouts'

// Exported for testing purposes
export interface Aspect {
  discover(client: SalesforceClient, elements: Element[]): Promise<void>
  add(client: SalesforceClient, after: Element): Promise<SaveResult[]>
  update(client: SalesforceClient, before: Element, after: Element): Promise<SaveResult[]>
  remove(client: SalesforceClient, before: Element): Promise<SaveResult[]>
}

// This is encapsulated as class for easier mocking of it
export class AspectsManager {
  // This is not private and not readonly for testing purpose
  aspects = [fieldPermissionsAspect, layoutAspect]
  constructor(private readonly client: SalesforceClient) { }

  discover = async (elements: Element[]): Promise<void[]> =>
    Promise.all(this.aspects.map(aspect => aspect.discover(this.client, elements)))

  add = async (after: Element): Promise<SaveResult[]> =>
    _.flatten(await Promise.all(this.aspects.map(aspect => aspect.add(this.client, after))))

  update = async (before: Element, after: Element): Promise<SaveResult[]> =>
    _.flatten(await Promise.all(this.aspects.map(aspect =>
      aspect.update(this.client, before, after))))

  remove = async (before: Element): Promise<SaveResult[]> =>
    _.flatten(await Promise.all(this.aspects.map(aspect => aspect.remove(this.client, before))))
}
