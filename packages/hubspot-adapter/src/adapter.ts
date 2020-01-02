import {
  AdapterCreator, BuiltinTypes, Change, ElemID, Field, ObjectType,
  Element, InstanceElement, isInstanceElement,
} from 'adapter-api'
import {
  FormObjectType,
} from './client/types'
import HubspotClient, { Credentials } from './client/client'

export interface HubspotAdapterParams {
  // client to use
  client: HubspotClient

}

export default class HubspotAdapter {
  private client: HubspotClient

  public constructor({
    client,
  }: HubspotAdapterParams) {
    this.client = client
  }

  /**
   * Fetch configuration elements: objects, types and instances for the given HubSpot account.
   * Account credentials were given in the constructor.
   */
  public async fetch(): Promise<Element[]> {
    const resp = await this.client.getAllForms()
    return resp.map(e => new InstanceElement(
      e.name,
      new ObjectType({ elemID: new ElemID('hubspot') }),
      {}
    ))
  }

  /**
   * Add new element
   * @param element the object/instance to add
   * @returns the updated element
   * @throws error in case of failure
   */
  public async add(element: Element): Promise<Element> {
    if (isInstanceElement(element)) {
      const resp = await this.client.createForm(
        {
          name: element.value.name,
        } as FormObjectType
      )
      element.value.guid = resp.guid
    }

    return element
  }

  /**
   * Remove an instance
   * @param instance to remove
   * @throws error in case of failure
   */
  public async remove(instance: InstanceElement): Promise<void> {
    await this.client.deleteForm(
      {
        guid: instance.value.guid,
      } as FormObjectType
    )
  }

  /**
   * Updates an Element
   * @param before The metadata of the old element
   * @param after The new metadata of the element to replace
   * @param changes to apply
   * @returns the updated element
   */
  public async update(
    before: Element,
    after: Element,
    _changes: ReadonlyArray<Change>
  ): Promise<Element> {
    if (isInstanceElement(before) && isInstanceElement(after)) {
      await this.client.updateForm(
        {
          guid: after.value.guid,
        } as FormObjectType
      )
    }

    return after
  }
}

const configID = new ElemID('hubspot')

const configType = new ObjectType({
  elemID: configID,
  fields: {
    apiKey: new Field(configID, 'apiKey', BuiltinTypes.STRING),
  },
  annotationTypes: {},
  annotations: {},
})

const credentialsFromConfig = (config: InstanceElement): Credentials => ({
  apiKey: config.value.apiKey,
})

const clientFromConfig = (config: InstanceElement): HubspotClient =>
  new HubspotClient(
    {
      credentials: credentialsFromConfig(config),
    }
  )

export const creator: AdapterCreator = {
  create: ({ config }) => new HubspotAdapter({
    client: clientFromConfig(config),
  }),
  configType,
}
