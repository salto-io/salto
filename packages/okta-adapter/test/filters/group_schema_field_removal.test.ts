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

import { filterUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import groupSchemaAddNullFilter from '../../src/filters/group_schema_field_removal'
import { getFilterParams } from '../utils'
import { GROUP_SCHEMA_TYPE_NAME, OKTA } from '../../src/constants'

describe('groupSchemaAddNullFilter', () => {
    type FilterType = filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
    let filter: FilterType

    const groupSchemaType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_SCHEMA_TYPE_NAME) })
    const groupSchemaBeforeInstance = new InstanceElement(
      'defualtGroupSchema',
      groupSchemaType,
      {
        definitions: {
          custom: {
            properties: {
              additionalProperties: {
                property1: {},
                property2: {},
              },
            },
          },
        },
      },
    )
    const groupSchemaAfterInstance = new InstanceElement(
      'defualtGroupSchema',
      groupSchemaType,
      {
        definitions: {
          custom: {
            properties: {
              additionalProperties: {
                property1: {},
              },
            },
          },
        },
      },
    )

    beforeEach(async () => {
      filter = groupSchemaAddNullFilter(getFilterParams()) as typeof filter
    })

    describe('preDeploy', () => {
      it('should add null to removed Properties', async () => {
        const groupSchemaBeforeInstanceCopy = groupSchemaBeforeInstance.clone()
        const groupSchemaAfterInstanceCopy = groupSchemaAfterInstance.clone()
        await filter.preDeploy([
          toChange({ before: groupSchemaBeforeInstanceCopy, after: groupSchemaAfterInstanceCopy })])
        expect(groupSchemaAfterInstanceCopy.value.definitions.custom.properties.additionalProperties.property2)
          .toBeNull()
      })
      it('should add null when changing property name', async () => {
        const groupSchemaAfterModifyedInstance = new InstanceElement(
          'defualtGroupSchema',
          groupSchemaType,
          {
            definitions: {
              custom: {
                properties: {
                  additionalProperties: {
                    property1: {},
                    property3: {},
                  },
                },
              },
            },
          },
        )
        await filter.preDeploy([
          toChange({ before: groupSchemaBeforeInstance, after: groupSchemaAfterModifyedInstance })])
        expect(groupSchemaAfterModifyedInstance.value.definitions.custom.properties.additionalProperties.property2)
          .toBeNull()
      })
    })
    describe('onDeploy', () => {
      it('should delete Properties with null', async () => {
        const groupSchemaAfterInstanceTwo = new InstanceElement(
          'defualtGroupSchema',
          groupSchemaType,
          {
            definitions: {
              custom: {
                properties: {
                  additionalProperties: {
                    property1: {},
                    property2: null,
                  },
                },
              },
            },
          },
        )
        await filter.onDeploy([
          toChange({ before: groupSchemaBeforeInstance, after: groupSchemaAfterInstanceTwo })])
        expect(groupSchemaAfterInstanceTwo.value.definitions.custom.properties.additionalProperties.property2)
          .toBeUndefined()
      })
    })
})
