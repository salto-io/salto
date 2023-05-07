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
import { DETECTS_PARENTS_INDICATOR } from '../../src/constants'

describe('buildDataManagement', () => {
  let dataManagement: DataManagement
  beforeEach(() => {
    dataManagement = buildDataManagement({
      includeObjects: ['aaa.*'],
      excludeObjects: ['.*bbb'],
      allowReferenceTo: ['ccc'],
      saltoIDSettings: {
        defaultIdFields: ['default'],
        overrides: [{
          objectsRegex: 'aaab.*',
          idFields: ['field'],
        }],
      },
    })
  })

  it('isObjectMatch should return currect results for matched objects', () => {
    expect(dataManagement.isObjectMatch('aaa')).toBeTruthy()
    expect(dataManagement.isObjectMatch('ccc')).toBeFalsy()
    expect(dataManagement.isObjectMatch('aaabbb')).toBeFalsy()
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
    expect(dataManagement.getObjectAliasFields('Account')).toEqual(['Name'])
    expect(dataManagement.getObjectAliasFields('SBQQ__LookupQuery__c')).toEqual([
      DETECTS_PARENTS_INDICATOR,
      'SBQQ__PriceRule2__c',
      'Name',
    ])
  })
})
