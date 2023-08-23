/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { buildDataManagement, DataManagement } from '../../src/fetch_profile/data_management'
import {
  API_NAME,
  DETECTS_PARENTS_INDICATOR,
} from '../../src/constants'
import { createCustomObjectType } from '../utils'
import { Types } from '../../src/transformers/transformer'

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
      saltoIDSettings: {
        defaultIdFields: ['default'],
        overrides: [{
          objectsRegex: 'aaab.*',
          idFields: ['field'],
        }],
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
  describe('isObjectMatch', () => {
    it('should match on included objects', async () => {
      expect(await dataManagement.isObjectTypeMatch(createCustomObjectType('aaa', {}))).toBeTrue()
      expect(await dataManagement.isObjectTypeMatch(createCustomObjectType('aaaccc', {}))).toBeTrue()
    })
    it('should not match on objects we allow refs to if they are not managed by Salto', async () => {
      expect(await dataManagement.isObjectTypeMatch(createCustomObjectType('ccc', {}))).toBeFalse()
    })
    it('should match on objects we allow refs to if they may be managed by Salto', async () => {
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
      expect(await dataManagement.isObjectTypeMatch(objType)).toBeTrue()
    })
    it('should not match on objects that are excluded', async () => {
      expect(await dataManagement.isObjectTypeMatch(createCustomObjectType('bbb', {}))).toBeFalse()
      expect(await dataManagement.isObjectTypeMatch(createCustomObjectType('cccbbb', {}))).toBeFalse()
    })
    it('should not match on objects that are both included and excluded', async () => {
      expect(await dataManagement.isObjectTypeMatch(createCustomObjectType('aaabbb', {}))).toBeFalse()
    })
  })

  it('isReferenceAllowed should return currect results for allowed references', () => {
    expect(dataManagement.isReferenceAllowed('aaa')).toBeFalsy()
    expect(dataManagement.isReferenceAllowed('ccc')).toBeTruthy()
    expect(dataManagement.isReferenceAllowed('aaabbb')).toBeFalsy()
  })

  it('getObjectIdsFields should return currect results', () => {
    expect(dataManagement.getObjectIdsFields('aaa')).toEqual(['default'])
    expect(dataManagement.getObjectIdsFields('aaab')).toEqual(['field'])
  })
  it('getObjectAliasFields should return correct results', () => {
    expect(dataManagement.getObjectAliasFields('Account')).toEqual([DETECTS_PARENTS_INDICATOR, 'Name'])
    expect(dataManagement.getObjectAliasFields('SBQQ__LookupQuery__c')).toEqual([
      DETECTS_PARENTS_INDICATOR,
      'SBQQ__PriceRule2__c',
      'Name',
    ])
    expect(dataManagement.getObjectAliasFields('TestOverrideType')).toEqual(['TestField1', 'TestField2'])
    expect(dataManagement.getObjectAliasFields('Product2')).toEqual(['Name', 'IsActive'])
  })
})
