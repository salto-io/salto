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
import {
  InstanceElement,
  ObjectType,
  ElemID,
  toChange,
} from '@salto-io/adapter-api'
import { elementSource as elementSourceUtils } from '@salto-io/workspace'
import _ from 'lodash'
import { ZENDESK } from '../../src/constants'
import { duplicateIdFieldValuesValidator } from '../../src/change_validators'
import { API_DEFINITIONS_CONFIG, DEFAULT_CONFIG, ZendeskApiConfig } from '../../src/config'

const { createInMemoryElementSource } = elementSourceUtils

const createGroupInstance = (elemId: string, name: string): InstanceElement =>
  new InstanceElement(
    elemId,
    new ObjectType({ elemID: new ElemID(ZENDESK, 'group') }),
    {
      name,
    },
  )

describe('duplicateIdFieldValuesValidator', () => {
  let apiConfig: ZendeskApiConfig
  beforeEach(() => {
    apiConfig = _.cloneDeep(DEFAULT_CONFIG[API_DEFINITIONS_CONFIG])
  })

  it('should not return errors for instances with unique id field values', async () => {
    const uniqueGroup1 = createGroupInstance('unique1', 'name1')
    const uniqueGroup2 = createGroupInstance('unique2', 'name2')
    const uniqueGroup3 = createGroupInstance('unique3', 'name3')

    const changes = [
      toChange({ after: uniqueGroup1 }),
      toChange({ after: uniqueGroup2 }),
    ]
    const elementSource = createInMemoryElementSource([uniqueGroup1, uniqueGroup2, uniqueGroup3])
    const errors = await duplicateIdFieldValuesValidator(apiConfig)(changes, elementSource)
    expect(errors).toEqual([])
  })

  it('should return an error for instances with the same id field values', async () => {
    const duplicateGroup1 = createGroupInstance('duplicate1', 'name1')
    const duplicateGroup2 = createGroupInstance('duplicate2', 'name1')
    const duplicateGroup3 = createGroupInstance('duplicate3', 'name3')
    const duplicateGroup4 = createGroupInstance('duplicate4', 'name3')
    const duplicateGroup5 = createGroupInstance('duplicate5', 'name3')
    const uniqueGroup = createGroupInstance('unique', 'unique')

    const changes = [
      toChange({ after: duplicateGroup1 }),
      toChange({ after: duplicateGroup3 }),
      toChange({ after: duplicateGroup4 }),
      toChange({ after: uniqueGroup }),
    ]
    const elementSource = createInMemoryElementSource([
      duplicateGroup1,
      duplicateGroup2,
      duplicateGroup3,
      duplicateGroup4,
      duplicateGroup5,
      uniqueGroup,
    ])
    const errors = await duplicateIdFieldValuesValidator(apiConfig)(changes, elementSource)
    expect(errors).toMatchObject([
      {
        elemID: duplicateGroup1.elemID,
        severity: 'Error',
        message: 'Duplicate unique field values',
        detailedMessage: 'This element has the same unique fields as \'duplicate2\', deploying it will cause Salto collisions, please make sure this is not an existing modified element',
      },
      {
        elemID: duplicateGroup3.elemID,
        severity: 'Error',
        message: 'Duplicate unique field values',
        detailedMessage: 'This element has the same unique fields as \'duplicate4, duplicate5\', deploying it will cause Salto collisions, please make sure this is not an existing modified element',
      },
      {
        elemID: duplicateGroup4.elemID,
        severity: 'Error',
        message: 'Duplicate unique field values',
        detailedMessage: 'This element has the same unique fields as \'duplicate3, duplicate5\', deploying it will cause Salto collisions, please make sure this is not an existing modified element',
      },
    ])
  })
})
