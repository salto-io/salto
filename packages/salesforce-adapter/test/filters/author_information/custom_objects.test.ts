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

import { CORE_ANNOTATIONS, ElemID, Element, ObjectType, PrimitiveType, PrimitiveTypes, ReferenceExpression } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { FileProperties } from 'jsforce-types'
import { mockFileProperties } from '../../connection'
import mockClient from '../../client'
import Connection from '../../../src/client/jsforce'
import SalesforceClient from '../../../src/client/client'
import { Filter, FilterResult } from '../../../src/filter'
import customObjects, { WARNING_MESSAGE } from '../../../src/filters/author_information/custom_objects'
import { defaultFilterContext } from '../../utils'
import { buildFetchProfile } from '../../../src/fetch_profile/fetch_profile'
import { API_NAME, CUSTOM_OBJECT } from '../../../src/constants'

jest.setTimeout(22222222)

describe('custom objects author information test', () => {
  let filter: Filter
  let client: SalesforceClient
  let connection: MockInterface<Connection>
  let customObject: ObjectType
  const objectProperties = mockFileProperties({ fullName: 'Custom__c',
    type: 'test',
    createdByName: 'created_name',
    createdDate: 'created_date',
    lastModifiedByName: 'changed_name',
    lastModifiedDate: 'changed_date' })
  const fieldProperties = mockFileProperties({ fullName: 'Custom__c.StringField__c',
    type: 'test',
    createdByName: 'created_name_field',
    createdDate: 'created_date_field',
    lastModifiedByName: 'changed_name_field',
    lastModifiedDate: 'changed_date_field' })
  const nonExistentFieldProperties = mockFileProperties({ fullName: 'Custom__c.noSuchField',
    type: 'test',
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
  beforeEach(() => {
    ({ connection, client } = mockClient())
    connection.metadata.list.mockResolvedValueOnce([objectProperties])
    connection.metadata.list.mockResolvedValueOnce([fieldProperties, nonExistentFieldProperties])
    filter = customObjects({ client, config: defaultFilterContext })
    customObject = new ObjectType({
      elemID: new ElemID('salesforce', 'Custom__c'),
      annotations: { metadataType: CUSTOM_OBJECT, [API_NAME]: 'Custom__c' },
      fields: {
        StringField__c: { refType: new ReferenceExpression(primNum.elemID, primNum) },
      },
    })
  })
  it('should add author annotations to custom object', async () => {
    await filter.onFetch?.([customObject, objectWithoutInformation])
    checkElementAnnotations(customObject, objectProperties)
    checkElementAnnotations(customObject.fields.StringField__c, fieldProperties)
  })
  it('should return a warning on failure', async () => {
    connection.metadata.list.mockReset()
    connection.metadata.list.mockImplementationOnce(() => {
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
      filter = customObjects({
        client,
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({ optionalFeatures: { authorInformation: false } }),
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
