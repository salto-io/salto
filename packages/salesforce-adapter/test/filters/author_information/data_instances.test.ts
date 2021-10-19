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

import { CORE_ANNOTATIONS, ElemID, Element, ObjectType, ReferenceExpression, InstanceElement } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { FileProperties } from 'jsforce-types'
import { mockFileProperties, mockQueryResult } from '../../connection'
import mockClient from '../../client'
import Connection from '../../../src/client/jsforce'
import SalesforceClient from '../../../src/client/client'
import { Filter } from '../../../src/filter'
import dataInstances from '../../../src/filters/author_information/data_instances'
import { defaultFilterContext } from '../../utils'
import { API_NAME, CUSTOM_OBJECT, METADATA_TYPE } from '../../../src/constants'

describe('data instances author information test', () => {
  let filter: Filter
  let client: SalesforceClient
  let connection: MockInterface<Connection>
  const testType = new ObjectType({ elemID: new ElemID('', 'test'),
    annotations: { [METADATA_TYPE]: CUSTOM_OBJECT, [API_NAME]: 'otherName' } })
  const testInst = new InstanceElement(
    'Custom__c',
    new ReferenceExpression(testType.elemID, testType),
    { CreatedDate: 'created_date',
      CreatedById: 'creator_id',
      LastModifiedDate: 'changed_date',
      LastModifiedById: 'changed_id' }
  )
  const objectProperties = mockFileProperties({ fullName: 'Custom__c',
    type: 'test',
    createdByName: 'created_name',
    createdDate: 'created_date',
    lastModifiedByName: 'changed_name',
    lastModifiedDate: 'changed_date' })
  const checkElementAnnotations = (object: Element, properties: FileProperties): void => {
    expect(object.annotations[CORE_ANNOTATIONS.CREATED_BY]).toEqual(properties.createdByName)
    expect(object.annotations[CORE_ANNOTATIONS.CREATED_AT]).toEqual(properties.createdDate)
    expect(object.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toEqual(properties.lastModifiedByName)
    expect(object.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual(properties.lastModifiedDate)
  }
  // In order to test an object without author information in server.

  beforeEach(async () => {
    ({ connection, client } = mockClient())
    const TestCustomRecords = mockQueryResult({
      records: [
        {
          Id: 'creator_id',
          Name: 'created_name',
        },
        {
          Id: 'changed_id',
          Name: 'changed_name',
        },
      ],
      totalSize: 2,
    })
    connection.metadata.list.mockResolvedValueOnce([objectProperties])
    connection.query.mockResolvedValue(TestCustomRecords)
    filter = dataInstances({ client, config: defaultFilterContext })
    await filter.onFetch?.([testInst])
  })
  it('should add annotations to to custom object instances', async () => {
    checkElementAnnotations(testInst, objectProperties)
  })
})
