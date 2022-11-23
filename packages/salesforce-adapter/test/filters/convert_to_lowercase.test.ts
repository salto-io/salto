/*
*                      Copyright 2022 Salto Labs Ltd.
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
import _ from 'lodash'
import { ObjectType, ElemID, InstanceElement, Element, BuiltinTypes, createRefToElmWithValue } from '@salto-io/adapter-api'
import { makeFilter } from '../../src/filters/convert_to_lowercase'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import { defaultFilterContext } from '../utils'

describe('convert to lowercase filter', () => {
  const mockType = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'EntitlementTemplate'),
    fields: {
      entitlementProcess: {
        refType: BuiltinTypes.STRING,
      },
    },
  })

  const mockTypeThatShouldntChange = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'EntitlementShmemplate'),
    fields: {
      entitlementProcess: {
        refType: BuiltinTypes.STRING,
      },
    },
  })

  const mockInstance = new InstanceElement(
    'instance_of_entitlement_template',
    mockType,
    {
      entitlementProcess: 'Mixed Case',
    }
  )

  const mockInstanceLowerCase = new InstanceElement(
    'instance_of_entitlement_template_with_lowercase_field',
    mockType,
    {
      entitlementProcess: 'lower case',
    },
  )

  const mockInstanceDifferentType = new InstanceElement(
    'instance_of_some_other_type',
    mockTypeThatShouldntChange,
    {
      entitlementProcess: 'SpOnGeBoB CaSe',
    }
  )

  let testElements: Element[]

  const filter = makeFilter()({ config: defaultFilterContext }) as FilterWith<'onFetch'>

  beforeEach(() => {
    testElements = [
      _.assign(_.clone(mockInstance), { refType: createRefToElmWithValue(mockType) }),
      _.assign(_.clone(mockInstanceLowerCase), { refType: createRefToElmWithValue(mockType) }),
      _.assign(_.clone(mockInstanceDifferentType), { refType: createRefToElmWithValue(mockTypeThatShouldntChange) }),
    ]
  })

  describe('on fetch', () => {
    let mixedCaseInst: InstanceElement
    let lowerCaseInst: InstanceElement
    let unchangedInst: InstanceElement

    beforeEach(async () => {
      await filter.onFetch(testElements)
      mixedCaseInst = testElements[0] as InstanceElement
      lowerCaseInst = testElements[1] as InstanceElement
      unchangedInst = testElements[2] as InstanceElement
    })

    it('should convert mixed case fields to lower case', async () => {
      expect(mixedCaseInst.value.entitlementProcess).toEqual('mixed case')
    })

    it('should not modify lower case fields', async () => {
      expect(lowerCaseInst.value.entitlementProcess).toEqual('lower case')
    })

    it('should not modify instances of unknown types', async () => {
      expect(unchangedInst.value.entitlementProcess).toEqual('SpOnGeBoB CaSe')
    })
  })
})
