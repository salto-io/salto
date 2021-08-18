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
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FileProperties } from 'jsforce-types'
import mockClient from '../client'
import Connection from '../../src/client/jsforce'
import SalesforceClient from '../../src/client/client'
import * as utils from '../../src/filters/utils'
import { Filter, FilterResult } from '../../src/filter'
import auditInformation, { WARNING_MESSAGE } from '../../src/filters/audit_information'
import { createFileProperties, defaultFilterContext, MockInterface } from '../utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { API_NAME, CUSTOM_FIELD, CUSTOM_OBJECT, METADATA_TYPE } from '../../src/constants'

describe('audit information test', () => {
  let filter: Filter
  let client: SalesforceClient
  let connection: MockInterface<Connection>
  let customObject: ObjectType
  const objectProperties = createFileProperties({ fullName: 'Custom__c',
    createdByName: 'created_name',
    createdDate: 'created_date',
    lastModifiedByName: 'changed_name',
    lastModifiedDate: 'changed_date' })
  const fieldProperties = createFileProperties({ fullName: 'Custom__c.StringField__c',
    createdByName: 'created_name_field',
    createdDate: 'created_date_field',
    lastModifiedByName: 'changed_name_field',
    lastModifiedDate: 'changed_date_field' })
  const nonExistentFieldProperties = createFileProperties({ fullName: 'Custom__c.noSuchField',
    createdByName: 'test',
    createdDate: 'test',
    lastModifiedByName: 'test',
    lastModifiedDate: 'test' })
  // In order to test a field that was described in the server and not found in our elements.
  const primID = new ElemID('test', 'prim')
  const primNum = new PrimitiveType({
    elemID: primID,
    primitive: PrimitiveTypes.STRING,
    annotationRefsOrTypes: {},
    annotations: {},
  })
  const checkElementAnnotations = (object: Element, properties: FileProperties): void => {
    expect(object.annotations[CORE_ANNOTATIONS.CREATED_BY]).toEqual(properties.createdByName)
    expect(object.annotations[CORE_ANNOTATIONS.CREATED_AT]).toEqual(properties.createdDate)
    expect(object.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toEqual(properties.lastModifiedByName)
    expect(object.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual(properties.lastModifiedDate)
  }
  const objectWithoutInformation = new ObjectType({
    elemID: new ElemID('salesforce', 'otherName'),
    annotations: { metadataType: CUSTOM_OBJECT, [API_NAME]: 'otherName' },
    fields: {
      StringField__c: { refType: new ReferenceExpression(primNum.elemID, primNum) },
    },
  })
  // In order to test an object without audit information in server.

  beforeEach(() => {
    ({ connection, client } = mockClient())
    connection.metadata.list
      .mockImplementation(async inQuery => {
        const query = collections.array.makeArray(inQuery)[0]
        if (_.isEqual(query, { type: CUSTOM_OBJECT })) {
          return [objectProperties]
        }
        if (_.isEqual(query, { type: CUSTOM_FIELD })) {
          return [fieldProperties, nonExistentFieldProperties]
        }
        return []
      })
    filter = auditInformation({ client, config: defaultFilterContext })
    customObject = new ObjectType({
      elemID: new ElemID('salesforce', 'Custom__c'),
      annotations: { metadataType: CUSTOM_OBJECT, [API_NAME]: 'Custom__c' },
      fields: {
        StringField__c: { refType: new ReferenceExpression(primNum.elemID, primNum) },
      },
    })
  })
  it('should add audit annotations to custom object', async () => {
    await filter.onFetch?.([customObject, objectWithoutInformation])
    checkElementAnnotations(customObject, objectProperties)
    checkElementAnnotations(customObject.fields.StringField__c, fieldProperties)
  })
  it('should add annotations to to custom object instances', async () => {
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
    await filter.onFetch?.([testInst])
    checkElementAnnotations(testInst, objectProperties)
  })
  it('should return a warning', async () => {
    connection.metadata.list.mockImplementation(() => {
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
      expect(customObject.annotations[CORE_ANNOTATIONS.CREATED_BY]).not.toBeDefined()
      expect(customObject.annotations[CORE_ANNOTATIONS.CREATED_AT]).not.toBeDefined()
      expect(customObject.annotations[CORE_ANNOTATIONS.CHANGED_BY]).not.toBeDefined()
      expect(customObject.annotations[CORE_ANNOTATIONS.CHANGED_AT]).not.toBeDefined()
    })
  })
})
