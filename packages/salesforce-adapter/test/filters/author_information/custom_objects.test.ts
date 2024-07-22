/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import {
  CORE_ANNOTATIONS,
  ElemID,
  Element,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
  InstanceElement,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { FileProperties } from '@salto-io/jsforce-types'
import { mockFileProperties } from '../../connection'
import mockClient from '../../client'
import Connection from '../../../src/client/jsforce'
import SalesforceClient from '../../../src/client/client'
import { Filter, FilterResult } from '../../../src/filter'
import customObjects, {
  WARNING_MESSAGE,
} from '../../../src/filters/author_information/custom_objects'
import { defaultFilterContext } from '../../utils'
import { buildFetchProfile } from '../../../src/fetch_profile/fetch_profile'
import {
  API_NAME,
  CUSTOM_OBJECT,
  INTERNAL_ID_ANNOTATION,
} from '../../../src/constants'
import { mockTypes } from '../../mock_elements'

describe('custom objects author information test', () => {
  let filter: Filter
  let client: SalesforceClient
  let connection: MockInterface<Connection>
  let customObject: ObjectType
  let instancesWithParent: InstanceElement[]

  const withParent = (
    instance: InstanceElement,
    parent: ObjectType,
  ): InstanceElement => {
    instance.annotations[CORE_ANNOTATIONS.PARENT] = [
      new ReferenceExpression(parent.elemID, parent),
    ]
    return instance
  }

  const objectProperties = mockFileProperties({
    fullName: 'Custom__c',
    type: 'test',
    // The _created_at and _created_By values should be these
    createdByName: 'created_name',
    createdDate: '2023-01-01T16:28:30.000Z',
    lastModifiedByName: 'changed_name',
    lastModifiedDate: '2023-01-19T16:28:30.000Z',
    id: 'id',
  })
  const fieldProperties = mockFileProperties({
    fullName: 'Custom__c.StringField__c',
    type: 'test',
    createdByName: 'created_name_field',
    createdDate: '2023-01-01T16:28:30.000Z',
    lastModifiedByName: 'changed_name_field',
    lastModifiedDate: '2023-01-19T16:28:30.000Z',
    id: 'id_field',
  })
  const nonExistentFieldProperties = mockFileProperties({
    fullName: 'Custom__c.noSuchField',
    type: 'test',
    createdByName: 'test',
    createdDate: '2023-01-19T16:28:30.000Z',
    lastModifiedByName: 'test',
    lastModifiedDate: '2023-01-19T16:28:30.000Z',
    id: 'test',
  })
  // In order to test a field that was described in the server and not found in our elements.
  const primID = new ElemID('test', 'prim')
  const primNum = new PrimitiveType({
    elemID: primID,
    primitive: PrimitiveTypes.STRING,
    annotationRefsOrTypes: {},
    annotations: {},
  })
  const checkElementAnnotations = (
    object: Element,
    properties: FileProperties,
  ): void => {
    expect(object.annotations[CORE_ANNOTATIONS.CREATED_BY]).toEqual(
      properties.createdByName,
    )
    expect(object.annotations[CORE_ANNOTATIONS.CREATED_AT]).toEqual(
      properties.createdDate,
    )
    expect(object.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toEqual(
      properties.lastModifiedByName,
    )
    expect(object.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual(
      properties.lastModifiedDate,
    )
    expect(object.annotations[INTERNAL_ID_ANNOTATION]).toEqual(properties.id)
  }
  const objectWithoutInformation = new ObjectType({
    elemID: new ElemID('salesforce', 'otherName'),
    annotations: { metadataType: CUSTOM_OBJECT, [API_NAME]: 'otherName' },
    fields: {
      StringField__c: { refType: primNum },
    },
  })
  beforeEach(() => {
    ;({ connection, client } = mockClient())
    filter = customObjects({ client, config: defaultFilterContext })
    customObject = new ObjectType({
      elemID: new ElemID('salesforce', 'Custom__c'),
      annotations: {
        metadataType: CUSTOM_OBJECT,
        [API_NAME]: 'Custom__c',
        [INTERNAL_ID_ANNOTATION]: 'id',
      },
      fields: {
        StringField__c: {
          refType: primNum,
          annotations: { [INTERNAL_ID_ANNOTATION]: 'id_field' },
        },
      },
    })
    instancesWithParent = [
      new InstanceElement(
        'testWebLink1',
        mockTypes.WebLink,
        { fullName: 'testWebLink1' },
        undefined,
        {
          [CORE_ANNOTATIONS.CREATED_BY]: 'Test User',
          [CORE_ANNOTATIONS.CHANGED_BY]: 'Test User',
          [CORE_ANNOTATIONS.CREATED_AT]: '2023-01-19T16:28:30.000Z',
          [CORE_ANNOTATIONS.CHANGED_AT]: '2023-02-19T16:28:30.000Z',
        },
      ),
      // This is the most recent file properties
      new InstanceElement(
        'testWebLink2',
        mockTypes.WebLink,
        { fullName: 'testWebLink2' },
        undefined,
        {
          [CORE_ANNOTATIONS.CREATED_BY]: 'Test User',
          [CORE_ANNOTATIONS.CHANGED_BY]: 'Another Test User',
          [CORE_ANNOTATIONS.CREATED_AT]: '2023-01-19T16:28:30.000Z',
          [CORE_ANNOTATIONS.CHANGED_AT]: '2023-03-19T16:28:30.000Z',
        },
      ),
      // While this sub-instance has the most recent file properties, we use it to make sure we only
      // take into consideration sub-instances of CustomObjects and not Workflow for example
      new InstanceElement(
        'workflowAlert',
        mockTypes.WorkflowAlert,
        { fullName: 'workflowAlert' },
        undefined,
        {
          [CORE_ANNOTATIONS.CREATED_BY]: 'Test User',
          [CORE_ANNOTATIONS.CHANGED_BY]: 'Another Test User',
          [CORE_ANNOTATIONS.CREATED_AT]: '2023-01-19T16:28:30.000Z',
          [CORE_ANNOTATIONS.CHANGED_AT]: '2023-04-19T16:28:30.000Z',
        },
      ),
    ].map((instance) => withParent(instance, customObject))
  })
  describe('success', () => {
    beforeEach(() => {
      connection.metadata.list.mockResolvedValueOnce([objectProperties])
      connection.metadata.list.mockResolvedValueOnce([
        fieldProperties,
        nonExistentFieldProperties,
      ])
    })
    it('should add correct author annotations to custom object', async () => {
      await filter.onFetch?.([
        customObject,
        objectWithoutInformation,
        ...instancesWithParent,
      ])
      expect(customObject.annotations).toMatchObject({
        [CORE_ANNOTATIONS.CREATED_BY]: 'created_name',
        [CORE_ANNOTATIONS.CHANGED_BY]: 'Another Test User',
        [CORE_ANNOTATIONS.CREATED_AT]: '2023-01-01T16:28:30.000Z',
        [CORE_ANNOTATIONS.CHANGED_AT]: '2023-03-19T16:28:30.000Z',
      })
      checkElementAnnotations(
        customObject.fields.StringField__c,
        fieldProperties,
      )
    })
  })
  describe('failure', () => {
    it('should return a warning', async () => {
      connection.metadata.list.mockImplementation(() => {
        throw new Error()
      })
      const res = (await filter.onFetch?.([customObject])) as FilterResult
      const err = res.errors ?? []
      expect(res.errors).toHaveLength(1)
      expect(err[0]).toEqual({
        severity: 'Warning',
        message: WARNING_MESSAGE,
      })
    })
  })
  describe('when feature is disabled', () => {
    it('should not add any annotations', async () => {
      filter = customObjects({
        client,
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            fetchParams: { optionalFeatures: { authorInformation: false } },
          }),
        },
      })
      await filter.onFetch?.([customObject])
      expect(
        customObject.annotations[CORE_ANNOTATIONS.CREATED_BY],
      ).not.toBeDefined()
      expect(
        customObject.annotations[CORE_ANNOTATIONS.CREATED_AT],
      ).not.toBeDefined()
      expect(
        customObject.annotations[CORE_ANNOTATIONS.CHANGED_BY],
      ).not.toBeDefined()
      expect(
        customObject.annotations[CORE_ANNOTATIONS.CHANGED_AT],
      ).not.toBeDefined()
    })
  })
})
