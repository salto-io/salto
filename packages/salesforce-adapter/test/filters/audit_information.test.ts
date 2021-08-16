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

import { CORE_ANNOTATIONS, ElemID, Element, ObjectType, PrimitiveType, PrimitiveTypes, ReferenceExpression, InstanceElement } from '@salto-io/adapter-api'
import mockClient from '../client'
import Connection from '../../src/client/jsforce'
import SalesforceClient from '../../src/client/client'
import * as utils from '../../src/filters/utils'
import { Filter, FilterResult } from '../../src/filter'
import auditInformation, { WARNING_MESSAGE } from '../../src/filters/audit_information'
import { defaultFilterContext, MockInterface } from '../utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { API_NAME, CUSTOM_FIELD, CUSTOM_OBJECT } from '../../src/constants'
import * as transformer from '../../src/transformers/transformer'


describe('audit information test', () => {
  let filter: Filter
  let client: SalesforceClient
  let connection: MockInterface<Connection>
  let customObject: ObjectType
  const objectProperties = { fullName: 'Custom__c',
    createdByName: 'created_name',
    createdDate: 'created_date',
    lastModifiedByName: 'changed_name',
    lastModifiedDate: 'changed_date' }
  const fieldProperties = { fullName: 'Custom__c.StringField__c',
    createdByName: 'created_name_field',
    createdDate: 'created_date_field',
    lastModifiedByName: 'changed_name_field',
    lastModifiedDate: 'changed_date_field' }
  const primID = new ElemID('test', 'prim')
  const primNum = new PrimitiveType({
    elemID: primID,
    primitive: PrimitiveTypes.STRING,
    annotationRefsOrTypes: {},
    annotations: {},
  })
  const checkElementAnnotations = (object: Element, properties: Record<string, string>): void => {
    expect(object.annotations[CORE_ANNOTATIONS.CREATED_BY]).toEqual(properties.createdByName)
    expect(object.annotations[CORE_ANNOTATIONS.CREATED_AT]).toEqual(properties.createdDate)
    expect(object.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toEqual(properties.lastModifiedByName)
    expect(object.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual(properties.lastModifiedDate)
  }
  const mockQueryAll: jest.Mock = jest.fn()
  SalesforceClient.prototype.queryAll = mockQueryAll

  beforeEach(() => {
    ({ connection, client } = mockClient())
    connection.metadata.list = jest.fn()
      .mockImplementation(async ([{ type }]) => {
        if (type === CUSTOM_OBJECT) {
          return [objectProperties]
        }
        if (type === CUSTOM_FIELD) {
          return [fieldProperties]
        }
        return []
      })
    filter = auditInformation({ client, config: defaultFilterContext })
    customObject = new ObjectType({
      elemID: new ElemID('salesforce', 'Custom__c'),
      annotations: { metadataType: 'CustomObject', [API_NAME]: 'Custom__c' },
      fields: {
        StringField__c: { refType: new ReferenceExpression(primNum.elemID, primNum) },
      },
    })
  })
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should add audit annotations to custom object', async () => {
    await filter.onFetch?.([customObject])
    checkElementAnnotations(customObject, objectProperties)
    checkElementAnnotations(customObject.fields.StringField__c, fieldProperties)
  })
  it('should add annotations to to custom object instances', async () => {
    jest.spyOn(transformer, 'isInstanceOfCustomObject').mockResolvedValue(true)
    const TestCustomRecords = [
      {
        Id: 'creator_id',
        Name: 'created_name',
      },
      {
        Id: 'changed_id',
        Name: 'changed_name',
      },
    ]
    jest.spyOn(utils, 'queryClient').mockResolvedValue(TestCustomRecords)
    const testType = new ObjectType({ elemID: new ElemID('', 'test') })
    const testInst = new InstanceElement('Custom__c', new ReferenceExpression(testType.elemID, testType),
      { CreatedDate: 'created_date',
        CreatedById: 'creator_id',
        LastModifiedDate: 'changed_date',
        LastModifiedById: 'changed_id' })
    await filter.onFetch?.([testInst])
    checkElementAnnotations(testInst, objectProperties)
  })
  it('should return a warning', async () => {
    jest.spyOn(transformer, 'isInstanceOfCustomObject').mockImplementation(() => {
      throw new Error()
    })
    const res = await filter.onFetch?.([customObject]) as FilterResult
    const err = res.errors ?? []
    expect(res.errors).toHaveLength(1)
    expect(err[0]).toEqual({
      severity: 'Warning',
      message: WARNING_MESSAGE,
    })
  })
  describe('when feature is disabled', () => {
    it('should not add any annotations', async () => {
      filter = auditInformation({
        client,
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({ optionalFeatures: { auditInformation: false } }),
        },
      })
      await filter.onFetch?.([customObject])
      checkElementAnnotations(customObject, {})
    })
  })
})
