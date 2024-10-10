/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { MockInterface } from '@salto-io/test-utils'
import { FileProperties, RetrieveRequest } from '@salto-io/jsforce'
import { collections } from '@salto-io/lowerdash'
import { BuiltinTypes, InstanceElement, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import Connection from '../src/client/jsforce'
import SalesforceAdapter from '../index'
import mockAdapter from './adapter'
import { CUSTOM_OBJECT_FIELDS } from '../src/fetch_profile/metadata_types'
import {
  APEX_CLASS_METADATA_TYPE,
  API_NAME,
  CHANGED_AT_SINGLETON,
  CUSTOM_FIELD,
  CUSTOM_OBJECT,
  FIELD_ANNOTATIONS,
  PROFILE_METADATA_TYPE,
  UNIX_TIME_ZERO_STRING,
} from '../src/constants'
import { mockDefaultValues, mockInstances, mockTypes } from './mock_elements'
import { mockDescribeResult, mockFileProperties, mockRetrieveLocator, mockRetrieveResult } from './connection'
import { createCustomObjectType, mockFetchOpts } from './utils'
import { createInstanceElement, Types } from '../src/transformers/transformer'
import * as customListFuncsModule from '../src/client/custom_list_funcs'

const { makeArray } = collections.array

describe('Salesforce Fetch With Changes Detection', () => {
  const OBJECT_WITH_DELETED_FIELD_NAME = 'ObjectWithDeletedField__c'
  const UPDATED_OBJECT_NAME = 'Updated__c'
  const NON_UPDATED_OBJECT_NAME = 'NonUpdated__c'

  let connection: MockInterface<Connection>
  let adapter: SalesforceAdapter
  let changedAtSingleton: InstanceElement
  let deletedApexClasses: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  let retrieveRequest: RetrieveRequest

  const RELATED_TYPES = [...CUSTOM_OBJECT_FIELDS, CUSTOM_FIELD, CUSTOM_OBJECT, PROFILE_METADATA_TYPE] as const
  type RelatedType = (typeof RELATED_TYPES)[number]
  // This standard object has no custom fields or sub instances, and will have no lastChangeDate value
  const NON_UPDATED_STANDARD_OBJECT = 'NonUpdatedStandardObject'

  const setupMocks = (metadataExclude = [{ metadataType: PROFILE_METADATA_TYPE }]): void => {
    ;({ connection, adapter } = mockAdapter({
      adapterParams: {
        config: {
          fetch: {
            metadata: {
              include: [
                {
                  metadataType: '.*',
                },
              ],
              exclude: metadataExclude,
            },
          },
        },
        elementsSource,
      },
    }))
    const filePropByRelatedType: Record<RelatedType, FileProperties[]> = {
      BusinessProcess: [
        // Latest related property for Updated__c
        mockFileProperties({
          fullName: `${UPDATED_OBJECT_NAME}.TestBusinessProcess`,
          type: 'BusinessProcess',
          lastModifiedDate: '2023-11-07T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: `${NON_UPDATED_OBJECT_NAME}.TestBusinessProcess`,
          type: 'BusinessProcess',
          lastModifiedDate: '2023-10-01T00:00:00.000Z',
        }),
      ],
      CompactLayout: [
        mockFileProperties({
          fullName: `${UPDATED_OBJECT_NAME}.TestCompactLayout`,
          type: 'CompactLayout',
          lastModifiedDate: '2023-11-05T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: `${NON_UPDATED_OBJECT_NAME}.TestCompactLayout`,
          type: 'CompactLayout',
          lastModifiedDate: '2023-10-03T00:00:00.000Z',
        }),
      ],
      CustomField: [
        mockFileProperties({
          fullName: `${UPDATED_OBJECT_NAME}.TestField__c`,
          type: CUSTOM_FIELD,
          lastModifiedDate: '2023-11-02T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: `${NON_UPDATED_OBJECT_NAME}.TestField__c`,
          type: CUSTOM_FIELD,
          lastModifiedDate: '2023-11-01T00:00:00.000Z',
        }),
      ],
      CustomObject: [
        mockFileProperties({
          fullName: UPDATED_OBJECT_NAME,
          type: CUSTOM_OBJECT,
          lastModifiedDate: '2023-11-01T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: NON_UPDATED_OBJECT_NAME,
          type: CUSTOM_OBJECT,
          lastModifiedDate: '2023-11-01T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: OBJECT_WITH_DELETED_FIELD_NAME,
          type: CUSTOM_OBJECT,
          lastModifiedDate: '2023-11-01T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: NON_UPDATED_STANDARD_OBJECT,
          type: CUSTOM_OBJECT,
          lastModifiedDate: UNIX_TIME_ZERO_STRING,
        }),
      ],
      FieldSet: [],
      Index: [],
      ListView: [
        mockFileProperties({
          fullName: `${UPDATED_OBJECT_NAME}.TestListView`,
          type: 'ListView',
          lastModifiedDate: '2023-11-06T00:00:00.000Z',
        }),
        // Latest related property for NonUpdated__c
        mockFileProperties({
          fullName: `${NON_UPDATED_OBJECT_NAME}.TestListView`,
          type: 'ListView',
          lastModifiedDate: '2023-11-02T00:00:00.000Z',
        }),
      ],
      RecordType: [],
      SharingReason: [],
      ValidationRule: [],
      WebLink: [],
      Profile: [
        mockFileProperties({
          fullName: 'Admin',
          type: PROFILE_METADATA_TYPE,
          lastModifiedDate: '2023-11-01T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: 'Custom Profile',
          type: PROFILE_METADATA_TYPE,
          lastModifiedDate: '2023-11-01T00:00:00.000Z',
        }),
      ],
    }

    connection.metadata.describe.mockResolvedValue(mockDescribeResult(RELATED_TYPES.map(type => ({ xmlName: type }))))
    connection.metadata.list.mockImplementation(async queries =>
      makeArray(queries).flatMap(({ type }) => filePropByRelatedType[type as RelatedType] ?? []),
    )
    connection.metadata.retrieve.mockImplementation(request => {
      retrieveRequest = request
      return mockRetrieveLocator(mockRetrieveResult({ zipFiles: [] }))
    })

    changedAtSingleton.value[CUSTOM_OBJECT] = {
      [UPDATED_OBJECT_NAME]: '2023-11-06T00:00:00.000Z',
      [NON_UPDATED_OBJECT_NAME]: '2023-11-02T00:00:00.000Z',
      [OBJECT_WITH_DELETED_FIELD_NAME]: '2023-11-02T00:00:00.000Z',
    }
  }

  beforeEach(async () => {
    changedAtSingleton = mockInstances()[CHANGED_AT_SINGLETON]
    const objectWithDeletedField = createCustomObjectType(OBJECT_WITH_DELETED_FIELD_NAME, {
      fields: {
        DeletedField__c: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
            [FIELD_ANNOTATIONS.CREATABLE]: true,
            [FIELD_ANNOTATIONS.UPDATEABLE]: true,
            [API_NAME]: 'DeletedField__c',
          },
        },
      },
    })
    const nonUpdatedObject = createCustomObjectType(NON_UPDATED_OBJECT_NAME, {
      fields: {
        TestField__c: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
            [FIELD_ANNOTATIONS.CREATABLE]: true,
            [FIELD_ANNOTATIONS.UPDATEABLE]: true,
            [API_NAME]: `${NON_UPDATED_OBJECT_NAME}.TestField__c`,
          },
        },
      },
    })
    const updatedObject = createCustomObjectType(UPDATED_OBJECT_NAME, {
      fields: {
        TestField__c: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
            [FIELD_ANNOTATIONS.CREATABLE]: true,
            [FIELD_ANNOTATIONS.UPDATEABLE]: true,
            [API_NAME]: `${UPDATED_OBJECT_NAME}.TestField__c`,
          },
        },
      },
    })
    const apexClass1 = createInstanceElement(
      { ...mockDefaultValues.ApexClass, fullName: 'ApexClass1' },
      mockTypes.ApexClass,
    )
    const apexClass2 = createInstanceElement(
      { ...mockDefaultValues.ApexClass, fullName: 'ApexClass2' },
      mockTypes.ApexClass,
    )
    deletedApexClasses = createInstanceElement(
      { ...mockDefaultValues.ApexClass, fullName: 'DeletedApex' },
      mockTypes.ApexClass,
    )

    const sourceElements = [
      ...Object.values(mockTypes),
      ...Types.getAllMissingTypes(),
      changedAtSingleton,
      objectWithDeletedField,
      nonUpdatedObject,
      updatedObject,
      apexClass1,
      apexClass2,
      deletedApexClasses,
      // Profile excluded by default
    ].filter(type => type.elemID.name !== PROFILE_METADATA_TYPE)
    elementsSource = buildElementsSourceFromElements(sourceElements)
  })
  describe('fetch with changes detection for types with nested instances', () => {
    beforeEach(() => {
      setupMocks()
    })
    it('should fetch only the updated CustomObject instances', async () => {
      await adapter.fetch({ ...mockFetchOpts, withChangesDetection: true })
      expect(retrieveRequest.unpackaged?.types).toIncludeSameMembers([
        {
          name: CUSTOM_OBJECT,
          members: [UPDATED_OBJECT_NAME, OBJECT_WITH_DELETED_FIELD_NAME],
        },
      ])
    })
  })
  describe('custom list functions', () => {
    describe('type with partial custom list function', () => {
      beforeEach(() => {
        setupMocks()
        connection.metadata.describe.mockResolvedValue(mockDescribeResult([{ xmlName: APEX_CLASS_METADATA_TYPE }]))
        connection.metadata.list.mockResolvedValue([
          mockFileProperties({
            fullName: 'ApexClass1',
            type: APEX_CLASS_METADATA_TYPE,
            lastModifiedDate: '2023-11-01T00:00:00.000Z',
          }),
          mockFileProperties({
            fullName: 'ApexClass2',
            type: APEX_CLASS_METADATA_TYPE,
            lastModifiedDate: '2023-11-03T00:00:00.000Z',
          }),
        ])
        // No ApexClasses were updated
        jest.spyOn(customListFuncsModule, 'createListApexClassesDef').mockReturnValue({
          func: async _client => ({ result: [], errors: [] }),
          mode: 'partial',
        })
        changedAtSingleton.value[APEX_CLASS_METADATA_TYPE] = {
          ApexClass1: '2023-11-01T00:00:00.000Z',
          ApexClass2: '2023-11-03T00:00:00.000Z',
          Deleted: '2023-11-01T00:00:00.000Z',
        }
      })
      it('should return correct deleted elements of type that was listed partially', async () => {
        const result = await adapter.fetch({ ...mockFetchOpts, withChangesDetection: true })
        expect(result.partialFetchData?.deletedElements).toEqual([deletedApexClasses.elemID])
      })
    })
  })
  describe('Type Inclusion & Exclusion', () => {
    describe('when including a type that was previously excluded', () => {
      beforeEach(() => {
        setupMocks([])
      })
      it('should fetch the type and its instances', async () => {
        const result = await adapter.fetch({ ...mockFetchOpts, withChangesDetection: true })
        expect(result.elements).toSatisfyAny(element => element.elemID.name === PROFILE_METADATA_TYPE)
        expect(retrieveRequest.unpackaged?.types).toSatisfyAny(
          entry =>
            entry.name === PROFILE_METADATA_TYPE &&
            entry.members.includes('Admin') &&
            entry.members.includes('Custom Profile'),
        )
      })
    })
    describe('when excluding a type that was previously included', () => {
      beforeEach(() => {
        setupMocks([{ metadataType: PROFILE_METADATA_TYPE }, { metadataType: APEX_CLASS_METADATA_TYPE }])
      })
      it('should delete all of its instances', async () => {
        const result = await adapter.fetch({ ...mockFetchOpts, withChangesDetection: true })
        expect(
          result.partialFetchData?.deletedElements?.filter(elemID => elemID.typeName === 'ApexClass'),
        ).not.toBeEmpty()
      })
    })
  })
})
