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
import { InstanceElement, ObjectType, ElemID, toChange } from '@salto-io/adapter-api'
import { elementSource as elementSourceUtils } from '@salto-io/workspace'
import _ from 'lodash'
import { ZENDESK } from '../../src/constants'
import { duplicateIdFieldValuesValidator } from '../../src/change_validators'
import { API_DEFINITIONS_CONFIG, DEFAULT_CONFIG, ZendeskApiConfig } from '../../src/config'
import * as duplicateIdFieldValuesModule from '../../src/change_validators/duplicate_id_field_values'

const { createInMemoryElementSource } = elementSourceUtils

const createGroupInstance = (elemId: string, name: string): InstanceElement =>
  new InstanceElement(elemId, new ObjectType({ elemID: new ElemID(ZENDESK, 'group') }), {
    name,
  })

describe('duplicateIdFieldValuesValidator', () => {
  let apiConfig: ZendeskApiConfig
  let toZendeskIdMock: jest.SpyInstance
  beforeEach(() => {
    apiConfig = _.cloneDeep(DEFAULT_CONFIG[API_DEFINITIONS_CONFIG])
    toZendeskIdMock = jest.spyOn(duplicateIdFieldValuesModule, 'toZendeskId')
  })
  afterEach(() => {
    toZendeskIdMock.mockClear()
  })

  it('should not return errors for instances with unique zendesk id', async () => {
    const uniqueGroup1 = createGroupInstance('unique1', 'name1')
    const uniqueGroup2 = createGroupInstance('unique2', 'name2')
    const uniqueGroup3 = createGroupInstance('unique3', 'name3')

    const changes = [toChange({ after: uniqueGroup1 }), toChange({ after: uniqueGroup2 })]
    const elementSource = createInMemoryElementSource([uniqueGroup1, uniqueGroup2, uniqueGroup3])
    const errors = await duplicateIdFieldValuesValidator(apiConfig)(changes, elementSource)
    expect(errors).toEqual([])
  })
  it('should return an error for instances with the same zendesk id and different id fields values', async () => {
    const duplicateGroup1 = createGroupInstance('duplicate1', 'name1')
    const duplicateGroup2 = createGroupInstance('duplicate2', 'name1')
    const duplicateGroup3 = createGroupInstance('duplicate3', 'name3')
    const duplicateGroup4 = createGroupInstance('duplicate4', 'name3')
    const duplicateGroup5 = createGroupInstance('duplicate5', 'name3')
    const uniqueGroup = createGroupInstance('unique', 'unique')

    const changes = [
      toChange({ after: duplicateGroup1 }),
      toChange({ before: duplicateGroup3 }),
      toChange({ after: duplicateGroup4 }),
      toChange({ after: uniqueGroup }),
    ]
    const elementSource = createInMemoryElementSource([
      duplicateGroup1,
      duplicateGroup2,
      duplicateGroup4,
      duplicateGroup5,
      uniqueGroup,
    ])
    const errors = await duplicateIdFieldValuesValidator(apiConfig)(changes, elementSource)
    expect(errors).toMatchObject([
      {
        elemID: duplicateGroup1.elemID,
        severity: 'Error',
        message: 'group duplication detected',
        detailedMessage:
          "This group cannot be deployed as it is a duplicate of 'duplicate2'. This likely indicates a misalignment of Salto IDs. To address this, please execute a fetch on both the source and target environments. Ensure you select the 'Regenerate Salto IDs' option in the advanced settings. More details can be found here: https://help.salto.io/en/articles/8290892-misalignment-of-salto-element-ids",
      },
      {
        elemID: duplicateGroup3.elemID,
        severity: 'Error',
        message: 'group duplication detected',
        detailedMessage:
          "This group cannot be deployed as it is a duplicate of 'duplicate4, duplicate5'. This likely indicates a misalignment of Salto IDs. To address this, please execute a fetch on both the source and target environments. Ensure you select the 'Regenerate Salto IDs' option in the advanced settings. More details can be found here: https://help.salto.io/en/articles/8290892-misalignment-of-salto-element-ids",
      },
      {
        elemID: duplicateGroup4.elemID,
        severity: 'Error',
        message: 'group duplication detected',
        detailedMessage:
          "This group cannot be deployed as it is a duplicate of 'duplicate3, duplicate5'. This likely indicates a misalignment of Salto IDs. To address this, please execute a fetch on both the source and target environments. Ensure you select the 'Regenerate Salto IDs' option in the advanced settings. More details can be found here: https://help.salto.io/en/articles/8290892-misalignment-of-salto-element-ids",
      },
    ])
  })
  it('should return an error for instances with the same zendesk id and same id fields values', async () => {
    const duplicateGroup1 = createGroupInstance('duplicate1', 'name1')
    const duplicateGroup2 = createGroupInstance('duplicate2', 'name2')

    const changes = [toChange({ after: duplicateGroup1 })]
    const elementSource = createInMemoryElementSource([duplicateGroup1, duplicateGroup2])

    // Currently there are on types that have the different id fields in zendesk and salto, so we need to mock it
    toZendeskIdMock.mockReturnValue('duplicate')
    const errors = await duplicateIdFieldValuesValidator(apiConfig)(changes, elementSource)

    expect(errors).toMatchObject([
      {
        elemID: duplicateGroup1.elemID,
        severity: 'Error',
        message: 'group duplication detected',
        detailedMessage:
          "This group cannot be deployed due to duplication of fields 'name' with existing instances 'duplicate2'. Please ensure that these field values are unique before deploying.",
      },
    ])
  })
})
