/*
*                      Copyright 2021 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import mockClient from '../client'
import Connection from '../../src/client/jsforce'
import SalesforceClient from '../../src/client/client'
import { Filter } from '../../src/filter'
import elementsUrlFilter from '../../src/filters/elements_url'
import { defaultFilterContext } from '../utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('elements url filter', () => {
  let filter: Filter
  let client: SalesforceClient
  let connection: Connection
  let standardObject: ObjectType

  beforeEach(() => {
    ({ connection, client } = mockClient())
    filter = elementsUrlFilter({ client, config: defaultFilterContext })
    standardObject = new ObjectType({ elemID: new ElemID('salesforce', 'Account'), annotations: { apiName: 'Account', metadataType: 'CustomObject' } })
  })

  it('should add object type its service url', async () => {
    connection.instanceUrl = 'https://salto5-dev-ed.my.salesforce.com'
    await filter.onFetch?.([standardObject])
    expect(standardObject.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/Account/Details/view')
  })

  it('should add a field its service url', async () => {
    connection.instanceUrl = 'https://salto5-dev-ed.my.salesforce.com'
    const field = new Field(standardObject, 'standardField', BuiltinTypes.NUMBER, { apiName: 'standardField' })
    standardObject.fields.standardField = field
    await filter.onFetch?.([standardObject])
    expect(field.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/standardField/view')
  })

  it('should add an instance its service url', async () => {
    connection.instanceUrl = 'https://salto5-dev-ed.my.salesforce.com'
    const instance = new InstanceElement(ElemID.CONFIG_NAME, new ObjectType({ elemID: new ElemID('salesforce', 'BusinessHoursSettings'), annotations: { metadataType: 'BusinessHoursSettings' } }))
    await filter.onFetch?.([instance])
    expect(instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://salto5-dev-ed.lightning.force.com/lightning/setup/BusinessHours/home')
  })

  it('should add an element with reference expression its service url', async () => {
    connection.instanceUrl = 'https://salto5-dev-ed.my.salesforce.com'

    const instance = new InstanceElement(
      'testLayout',
      new ObjectType({ elemID: new ElemID('salesforce', 'Layout'), annotations: { metadataType: 'Layout' } }),
      { internalId: 'someId' },
      [],
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(standardObject.elemID)] }
    )

    await filter.onFetch?.([instance, standardObject])
    expect(instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe('https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/Account/PageLayouts/someId/view')
  })

  it('there is no instance url should not add the service url', async () => {
    connection.instanceUrl = ''
    expect(filter.onFetch).toBeDefined()
    await filter.onFetch?.([standardObject])
    expect(standardObject.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })

  it('when instance url is an invalid salesforce url should not add the service url', async () => {
    connection.instanceUrl = 'https://google.com'
    expect(filter.onFetch).toBeDefined()
    await filter.onFetch?.([standardObject])
    expect(standardObject.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })

  it('should not service url for unkown element', async () => {
    connection.instanceUrl = 'https://salto5-dev-ed.my.salesforce.com'
    const element = new ObjectType({ elemID: new ElemID('salesforce', 'someType') })
    expect(filter.onFetch).toBeDefined()
    await filter.onFetch?.([element])
    expect(element.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })

  it('should not run any query when feature is disabled', async () => {
    connection.instanceUrl = 'https://salto5-dev-ed.my.salesforce.com'
    filter = elementsUrlFilter({
      client,
      config: {
        ...defaultFilterContext,
        fetchProfile: buildFetchProfile({ optionalFeatures: { elementsUrl: false } }),
      },
    })
    await filter.onFetch?.([standardObject])
    expect(standardObject.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
    expect(connection.query).not.toHaveBeenCalled()
  })
})
