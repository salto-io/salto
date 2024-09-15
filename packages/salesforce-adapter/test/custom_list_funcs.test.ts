/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { MockInterface } from '@salto-io/test-utils'
import Connection from '../src/client/jsforce'
import { mockInstances } from './mock_elements'
import {
  APEX_CLASS_METADATA_TYPE,
  CHANGED_AT_SINGLETON,
  WAVE_DATAFLOW_FILE_EXTENSION,
  WAVE_DATAFLOW_METADATA_TYPE,
  WAVE_RECIPE_FILE_EXTENSION,
  WAVE_RECIPE_METADATA_TYPE,
} from '../src/constants'
import { createListApexClassesDef, createListMissingWaveDataflowsDef } from '../src/client/custom_list_funcs'
import { SalesforceClient } from '../index'
import mockClient from './client'
import { mockFileProperties } from './connection'

describe('Custom List Functions', () => {
  let client: SalesforceClient
  let connection: MockInterface<Connection>
  beforeEach(() => {
    ;({ client, connection } = mockClient())
  })
  describe('createListApexClassesDef', () => {
    const LATEST_CHANGED_AT = '2024-01-03T00:00:00.000Z'
    const createElementsSource = ({
      withLatestChangedAt,
    }: {
      withLatestChangedAt: boolean
    }): ReadOnlyElementsSource => {
      const changedAtSingleton = mockInstances()[CHANGED_AT_SINGLETON]
      if (withLatestChangedAt) {
        changedAtSingleton.value.ApexClass = {
          ApexClass1: '2024-01-01T00:00:00.000Z',
          ApexClass2: LATEST_CHANGED_AT,
        }
      } else {
        delete changedAtSingleton.value.ApexClass
      }
      return buildElementsSourceFromElements([changedAtSingleton])
    }
    describe('when latestChangedInstanceOfType ApexClass is undefined', () => {
      beforeEach(() => {
        connection.query.mockResolvedValue({
          records: [
            {
              Id: '1',
              Name: 'ApexClass1',
              CreatedDate: '2024-01-01T00:00:00.000Z',
              CreatedBy: { Name: 'user1' },
              LastModifiedDate: '2024-01-01T00:00:00.000Z',
              LastModifiedBy: { Name: 'user1' },
            },
            {
              Id: '2',
              NamespacePrefix: 'namespace',
              Name: 'ApexClass2',
              CreatedDate: '2024-01-02T00:00:00.000Z',
              CreatedBy: { Name: 'user2' },
              LastModifiedDate: '2024-01-02T00:00:00.000Z',
              LastModifiedBy: { Name: 'user2' },
            },
          ],
          done: true,
          totalSize: 2,
        })
      })
      it('should return FileProperties for all the ApexClasses', async () => {
        const elementsSource = createElementsSource({ withLatestChangedAt: false })
        const result = await createListApexClassesDef(elementsSource).func(client)
        expect(connection.query).toHaveBeenCalledWith(
          'SELECT Id, NamespacePrefix, Name, CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name FROM ApexClass',
        )
        expect(result).toStrictEqual({
          errors: [],
          result: [
            {
              type: APEX_CLASS_METADATA_TYPE,
              namespacePrefix: undefined,
              fullName: 'ApexClass1',
              fileName: 'classes/ApexClass1.cls',
              id: '1',
              createdDate: '2024-01-01T00:00:00.000Z',
              createdByName: 'user1',
              lastModifiedDate: '2024-01-01T00:00:00.000Z',
              lastModifiedByName: 'user1',
              lastModifiedById: '',
              createdById: '',
            },
            {
              type: APEX_CLASS_METADATA_TYPE,
              namespacePrefix: 'namespace',
              fullName: 'namespace__ApexClass2',
              fileName: 'classes/namespace__ApexClass2.cls',
              id: '2',
              createdDate: '2024-01-02T00:00:00.000Z',
              createdByName: 'user2',
              lastModifiedDate: '2024-01-02T00:00:00.000Z',
              lastModifiedByName: 'user2',
              lastModifiedById: '',
              createdById: '',
            },
          ],
        })
      })
    })
    describe('when latestChangedInstanceOfType ApexClass is defined', () => {
      it('should query for ApexClasses by LastModifiedDate', async () => {
        const elementsSource = createElementsSource({ withLatestChangedAt: true })
        await createListApexClassesDef(elementsSource).func(client)
        expect(connection.query).toHaveBeenCalledWith(
          `SELECT Id, NamespacePrefix, Name, CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name FROM ApexClass WHERE LastModifiedDate > ${LATEST_CHANGED_AT}`,
        )
      })
    })
  })
  describe('createListMissingDataflowsDef', () => {
    beforeEach(() => {
      connection.metadata.list.mockResolvedValue([
        mockFileProperties({
          type: WAVE_RECIPE_METADATA_TYPE,
          fullName: 'Test1',
          fileName: `wave/Test1${WAVE_RECIPE_FILE_EXTENSION}`,
        }),
        mockFileProperties({
          type: WAVE_RECIPE_METADATA_TYPE,
          fullName: 'Test2',
          fileName: `wave/Test2${WAVE_RECIPE_FILE_EXTENSION}`,
        }),
      ])
    })
    it('should create WaveDataflow FileProperties from WaveRecipe properties', async () => {
      const result = await createListMissingWaveDataflowsDef().func(client)
      expect(result).toEqual({
        errors: [],
        result: [
          mockFileProperties({
            type: WAVE_DATAFLOW_METADATA_TYPE,
            fullName: 'Test1',
            fileName: `wave/Test1${WAVE_DATAFLOW_FILE_EXTENSION}`,
            id: '',
          }),
          mockFileProperties({
            type: WAVE_DATAFLOW_METADATA_TYPE,
            fullName: 'Test2',
            fileName: `wave/Test2${WAVE_DATAFLOW_FILE_EXTENSION}`,
            id: '',
          }),
        ],
      })
    })
  })
})
