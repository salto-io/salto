import { ObjectType } from 'adapter-api'
import { SaveResult } from 'jsforce-types'
import _ from 'lodash'
import SalesforceClient from '../client/client'
import { aspect as fieldPermissionsAspect } from './field_permissions'

// Exported for testing purposes
export interface SObjectAspect {
  discover(client: SalesforceClient, sobjects: ObjectType[]): Promise<void>
  add(client: SalesforceClient, after: ObjectType): Promise<SaveResult[]>
  update(client: SalesforceClient, before: ObjectType, after: ObjectType): Promise<SaveResult[]>
  remove(client: SalesforceClient, before: ObjectType): Promise<SaveResult[]>
}

// This is encapsulated as class for easier mocking of it
export class AspectsManager {
  // This is not private and not readonly for testing purpose
  aspects: SObjectAspect[] = [fieldPermissionsAspect]
  constructor(private readonly client: SalesforceClient) { }

  discover = async (sobjects: ObjectType[]): Promise<void[]> =>
    Promise.all(this.aspects.map(aspect => aspect.discover(this.client, sobjects)))

  add = async (after: ObjectType): Promise<SaveResult[]> =>
    _.flatten(await Promise.all(this.aspects.map(aspect => aspect.add(this.client, after))))

  update = async (before: ObjectType, after: ObjectType): Promise<SaveResult[]> =>
    _.flatten(await Promise.all(this.aspects.map(aspect =>
      aspect.update(this.client, before, after))))

  remove = async (before: ObjectType): Promise<SaveResult[]> =>
    _.flatten(await Promise.all(this.aspects.map(aspect => aspect.remove(this.client, before))))
}
