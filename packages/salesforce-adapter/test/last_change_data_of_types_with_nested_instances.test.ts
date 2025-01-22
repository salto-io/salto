/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { FileProperties, MetadataObject } from '@salto-io/jsforce'
import { MockInterface } from '@salto-io/test-utils'
import { collections } from '@salto-io/lowerdash'
import { CUSTOM_FIELD, CUSTOM_OBJECT } from '../src/constants'
import { SalesforceClient } from '../index'
import Connection from '../src/client/jsforce'
import mockClient from './client'
import { mockFileProperties } from './connection'
import { getLastChangeDateOfTypesWithNestedInstances } from '../src/last_change_date_of_types_with_nested_instances'
import { buildFilePropsMetadataQuery, buildMetadataQuery } from '../src/fetch_profile/metadata_query'
import { LastChangeDateOfTypesWithNestedInstances, MetadataQuery } from '../src/types'
import { CUSTOM_OBJECT_FIELDS } from '../src/fetch_profile/metadata_types'

const { makeArray } = collections.array

describe('getLastChangeDateOfTypesWithNestedInstances', () => {
  // This magic is used for fileProperties that expect to filter out.
  const FUTURE_TIME = '2024-11-07T00:00:00.000Z'
  const FIRST_OBJECT_NAME = 'Test1__c'
  const SECOND_OBJECT_NAME = 'Test2__c'

  let client: SalesforceClient
  let connection: MockInterface<Connection>
  let listedTypes: string[]
  let metadataQuery: MetadataQuery<FileProperties>
  let metadataTypeInfos: MetadataObject[]
  let filePropByRelatedType: Record<string, FileProperties[]>
  beforeEach(() => {
    ;({ client, connection } = mockClient())
    listedTypes = []
    filePropByRelatedType = {
      // CustomObject props
      BusinessProcess: [
        // Latest related property for Updated__c
        mockFileProperties({
          fullName: `${FIRST_OBJECT_NAME}.TestBusinessProcess`,
          type: 'BusinessProcess',
          lastModifiedDate: '2023-11-07T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: `${SECOND_OBJECT_NAME}.TestBusinessProcess`,
          type: 'BusinessProcess',
          lastModifiedDate: '2023-10-01T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: `${FIRST_OBJECT_NAME}.NamespacedBusinessProcess`,
          namespacePrefix: 'test',
          type: 'BusinessProcess',
          lastModifiedDate: FUTURE_TIME,
        }),
        mockFileProperties({
          fullName: `${SECOND_OBJECT_NAME}.NamespacedBusinessProcess`,
          namespacePrefix: 'test',
          type: 'BusinessProcess',
          lastModifiedDate: FUTURE_TIME,
        }),
      ],
      CompactLayout: [
        mockFileProperties({
          fullName: `${FIRST_OBJECT_NAME}.TestCompactLayout`,
          type: 'CompactLayout',
          lastModifiedDate: '2023-11-05T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: `${SECOND_OBJECT_NAME}.TestCompactLayout`,
          type: 'CompactLayout',
          lastModifiedDate: '2023-10-03T00:00:00.000Z',
        }),
      ],
      CustomField: [
        mockFileProperties({
          fullName: `${FIRST_OBJECT_NAME}.TestField__c`,
          type: CUSTOM_FIELD,
          lastModifiedDate: '2023-11-02T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: `${SECOND_OBJECT_NAME}.TestField__c`,
          type: CUSTOM_FIELD,
          lastModifiedDate: '2023-11-01T00:00:00.000Z',
        }),
      ],
      CustomObject: [
        mockFileProperties({
          fullName: FIRST_OBJECT_NAME,
          type: CUSTOM_OBJECT,
          lastModifiedDate: '2023-11-01T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: SECOND_OBJECT_NAME,
          type: CUSTOM_OBJECT,
          lastModifiedDate: '2023-11-01T00:00:00.000Z',
        }),
      ],
      FieldSet: [],
      Index: [
        mockFileProperties({
          fullName: `${FIRST_OBJECT_NAME}.TestIndex`,
          type: 'Index',
          lastModifiedDate: FUTURE_TIME,
        }),
        mockFileProperties({
          fullName: `${SECOND_OBJECT_NAME}.TestIndex`,
          type: 'Index',
          lastModifiedDate: FUTURE_TIME,
        }),
      ],
      ListView: [
        mockFileProperties({
          fullName: `${FIRST_OBJECT_NAME}.TestListView`,
          type: 'ListView',
          lastModifiedDate: '2023-11-06T00:00:00.000Z',
        }),
        // Latest related property for NonUpdated__c
        mockFileProperties({
          fullName: `${SECOND_OBJECT_NAME}.TestListView`,
          type: 'ListView',
          lastModifiedDate: '2023-11-02T00:00:00.000Z',
        }),
      ],
      RecordType: [],
      SharingReason: [],
      ValidationRule: [],
      WebLink: [],
      // CustomLabels props
      CustomLabel: [
        mockFileProperties({
          fullName: 'TestLabel1',
          type: 'CustomLabel',
          lastModifiedDate: '2023-11-07T00:00:00.000Z',
        }),
        mockFileProperties({
          fullName: 'TestLabel2',
          type: 'CustomLabel',
          lastModifiedDate: '2023-11-09T00:00:00.000Z',
        }),
      ],
    }
    connection.metadata.list.mockImplementation(async queries =>
      makeArray(queries).flatMap(({ type }) => {
        listedTypes.push(type)
        return filePropByRelatedType[type] ?? []
      }),
    )
  })
  describe('when all types with nested instances are included', () => {
    let excludedRelatedTypes: string[]
    beforeEach(() => {
      excludedRelatedTypes = ['Index']
      metadataTypeInfos = Object.keys(filePropByRelatedType).map(type => ({ xmlName: type }))
      metadataQuery = buildFilePropsMetadataQuery(
        buildMetadataQuery({
          fetchParams: {
            metadata: {
              include: [
                {
                  metadataType: '.*',
                  namespace: '',
                },
              ],
              exclude: excludedRelatedTypes.map(type => ({
                metadataType: type,
              })),
            },
          },
        }),
      )
    })
    it('should return correct values', async () => {
      const lastChangeDateOfTypesWithNestedInstances = await getLastChangeDateOfTypesWithNestedInstances({
        client,
        metadataQuery,
        metadataTypeInfos,
      })
      const expected: LastChangeDateOfTypesWithNestedInstances = {
        AssignmentRules: {},
        AutoResponseRules: {},
        CustomLabels: '2023-11-09T00:00:00.000Z',
        CustomObject: {
          Test1__c: '2024-11-07T00:00:00.000Z',
          Test2__c: '2024-11-07T00:00:00.000Z',
        },
        EscalationRules: {},
        SharingRules: {},
        Workflow: {},
      }
      expect(lastChangeDateOfTypesWithNestedInstances).toEqual(expected)
    })
  })
  describe('when types are not managed in the environment', () => {
    beforeEach(() => {
      metadataTypeInfos = [{ xmlName: CUSTOM_OBJECT }]
      metadataQuery = buildFilePropsMetadataQuery(
        buildMetadataQuery({
          fetchParams: {
            metadata: {
              include: [
                {
                  metadataType: '.*',
                  namespace: '',
                },
              ],
            },
          },
        }),
      )
    })
    it('should not consider the unmanaged types', async () => {
      const lastChangeDateOfTypesWithNestedInstances = await getLastChangeDateOfTypesWithNestedInstances({
        client,
        metadataQuery,
        metadataTypeInfos,
      })
      const expected: LastChangeDateOfTypesWithNestedInstances = {
        AssignmentRules: {},
        AutoResponseRules: {},
        CustomLabels: undefined,
        CustomObject: {
          Test1__c: '2023-11-01T00:00:00.000Z',
          Test2__c: '2023-11-01T00:00:00.000Z',
        },
        EscalationRules: {},
        SharingRules: {},
        Workflow: {},
      }
      expect(lastChangeDateOfTypesWithNestedInstances).toEqual(expected)
    })
    it('should list children types', async () => {
      await getLastChangeDateOfTypesWithNestedInstances({
        client,
        metadataQuery,
        metadataTypeInfos: [{ xmlName: CUSTOM_OBJECT, childXmlNames: [...CUSTOM_OBJECT_FIELDS, CUSTOM_FIELD] }],
      })
      expect(listedTypes).toContainValues([CUSTOM_OBJECT, ...CUSTOM_OBJECT_FIELDS, CUSTOM_FIELD])
    })
  })
})
