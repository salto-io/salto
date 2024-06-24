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

import { buildDataManagement } from '../../src/fetch_profile/data_management'
import { API_NAME, DETECTS_PARENTS_INDICATOR } from '../../src/constants'
import { createCustomObjectType } from '../utils'
import { Types } from '../../src/transformers/transformer'
import { DataManagement } from '../../src/types'

describe('buildDataManagement', () => {
  let dataManagement: DataManagement
  beforeEach(() => {
    dataManagement = buildDataManagement({
      includeObjects: ['aaa.*'],
      excludeObjects: ['.*bbb'],
      allowReferenceTo: ['ccc'],
      saltoManagementFieldSettings: {
        defaultFieldName: 'ManagedBySalto__c',
      },
      brokenOutgoingReferencesSettings: {
        defaultBehavior: 'BrokenReference',
        perTargetTypeOverrides: {
          User: 'InternalId',
        },
      },
      saltoIDSettings: {
        defaultIdFields: ['default'],
        overrides: [
          {
            objectsRegex: 'aaab.*',
            idFields: ['field'],
          },
        ],
      },
      saltoAliasSettings: {
        overrides: [
          // type that is not in ALIAS_FIELDS_BY_TYPE
          {
            objectsRegex: 'TestOverrideType',
            aliasFields: ['TestField1', 'TestField2'],
          },
          // type in ALIAS_FIELDS_BY_TYPE
          {
            objectsRegex: 'Product2',
            aliasFields: ['Name', 'IsActive'],
          },
        ],
      },
    })
  })
  describe('shouldFetchObjectType', () => {
    it('should fetch included objects', async () => {
      expect(
        await dataManagement.shouldFetchObjectType(
          createCustomObjectType('aaa', {}),
        ),
      ).toEqual('Always')
      expect(
        await dataManagement.shouldFetchObjectType(
          createCustomObjectType('aaaccc', {}),
        ),
      ).toEqual('Always')
    })
    it('should fetch objects we allow refs to if they are not managed by Salto', async () => {
      expect(
        await dataManagement.shouldFetchObjectType(
          createCustomObjectType('ccc', {}),
        ),
      ).toEqual('IfReferenced')
    })
    it('should fetch objects we allow refs to if they may be managed by Salto', async () => {
      const objType = createCustomObjectType('ccc', {
        fields: {
          ManagedBySalto__c: {
            refType: Types.primitiveDataTypes.Checkbox,
            annotations: {
              [API_NAME]: 'ManagedBySalto__c',
            },
          },
        },
      })
      expect(await dataManagement.shouldFetchObjectType(objType)).toEqual(
        'Always',
      )
    })
    it('should not fetch objects that are excluded', async () => {
      expect(
        await dataManagement.shouldFetchObjectType(
          createCustomObjectType('bbb', {}),
        ),
      ).toEqual('Never')
      expect(
        await dataManagement.shouldFetchObjectType(
          createCustomObjectType('cccbbb', {}),
        ),
      ).toEqual('Never')
    })
    it('should not fetch objects that are both included and excluded', async () => {
      expect(
        await dataManagement.shouldFetchObjectType(
          createCustomObjectType('aaabbb', {}),
        ),
      ).toEqual('Never')
    })
  })
  describe('brokenReferenceBehaviorForTargetType', () => {
    it('should return the default for target types that are not overridden', () => {
      expect(
        dataManagement.brokenReferenceBehaviorForTargetType('SomeType'),
      ).toEqual('BrokenReference')
    })
    it('should return the overridden value for target types that are overridden', () => {
      expect(
        dataManagement.brokenReferenceBehaviorForTargetType('User'),
      ).toEqual('InternalId')
    })
  })

  it('getObjectIdsFields should return currect results', () => {
    expect(dataManagement.getObjectIdsFields('aaa')).toEqual(['default'])
    expect(dataManagement.getObjectIdsFields('aaab')).toEqual(['field'])
  })
  it('getObjectAliasFields should return correct results', () => {
    expect(dataManagement.getObjectAliasFields('Account')).toEqual([
      DETECTS_PARENTS_INDICATOR,
      'Name',
    ])
    expect(dataManagement.getObjectAliasFields('SBQQ__LookupQuery__c')).toEqual(
      [DETECTS_PARENTS_INDICATOR, 'SBQQ__PriceRule2__c', 'Name'],
    )
    expect(dataManagement.getObjectAliasFields('TestOverrideType')).toEqual([
      'TestField1',
      'TestField2',
    ])
    expect(dataManagement.getObjectAliasFields('Product2')).toEqual([
      'Name',
      'IsActive',
    ])
  })
})
