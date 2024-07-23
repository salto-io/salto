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
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { MockInterface } from '@salto-io/test-utils'
import Connection from '../src/client/jsforce'
import { mockInstances } from './mock_elements'
import { CHANGED_AT_SINGLETON } from '../src/constants'
import { createListApexClassesDef } from '../src/client/custom_list_funcs'
import { SalesforceClient } from '../index'
import mockClient from './client'

describe('Custom List Functions', () => {
  let client: SalesforceClient
  let connection: MockInterface<Connection>
  describe('createListApexClassesDef', () => {
    ;({ client, connection } = mockClient())
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
      it('should query for all the ApexClasses', async () => {
        const elementsSource = createElementsSource({ withLatestChangedAt: false })
        await createListApexClassesDef(elementsSource).func(client)
        expect(connection.query).toHaveBeenCalledWith(
          'SELECT Id, NamespacePrefix, Name, CreatedDate, CreatedBy.Name, LastModifiedDate, LastModifiedBy.Name FROM ApexClass',
        )
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
})
