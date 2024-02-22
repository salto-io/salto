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

import { filterUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import schemaAddNullFilter from '../../src/filters/schema_field_removal'
import { getFilterParams } from '../utils'
import { GROUP_SCHEMA_TYPE_NAME, OKTA, USER_SCHEMA_TYPE_NAME } from '../../src/constants'

describe('schemaFieldRemovalFilter', () => {
  type FilterType = filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let filter: FilterType

  beforeEach(async () => {
    filter = schemaAddNullFilter(getFilterParams()) as typeof filter
  })

  describe('schemas with additional properties ', () => {
    const groupSchemaType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_SCHEMA_TYPE_NAME) })
    const groupSchemaBeforeInstance = new InstanceElement('defaultGroupSchema', groupSchemaType, {
      definitions: {
        custom: {
          properties: {
            property1: {},
            property2: {},
          },
        },
      },
    })
    const groupSchemaAfterInstance = new InstanceElement('defaultGroupSchema', groupSchemaType, {
      definitions: {
        custom: {
          properties: {
            property1: {},
          },
        },
      },
    })
    describe('preDeploy', () => {
      it('should add null to removed Properties', async () => {
        const groupSchemaBeforeInstanceCopy = groupSchemaBeforeInstance.clone()
        const groupSchemaAfterInstanceCopy = groupSchemaAfterInstance.clone()
        await filter.preDeploy([
          toChange({ before: groupSchemaBeforeInstanceCopy, after: groupSchemaAfterInstanceCopy }),
        ])
        expect(groupSchemaAfterInstanceCopy.value.definitions.custom.properties.property2).toBeNull()
      })
      it('should add null when changing property name', async () => {
        const groupSchemaAfterModifyedInstance = new InstanceElement('defaultGroupSchema', groupSchemaType, {
          definitions: {
            custom: {
              properties: {
                property1: {},
                property3: {},
              },
            },
          },
        })
        await filter.preDeploy([
          toChange({ before: groupSchemaBeforeInstance, after: groupSchemaAfterModifyedInstance }),
        ])
        expect(groupSchemaAfterModifyedInstance.value.definitions.custom.properties.property2).toBeNull()
      })
    })
    describe('onDeploy', () => {
      it('should delete Properties with null', async () => {
        const groupSchemaAfterInstanceTwo = new InstanceElement('defaultGroupSchema', groupSchemaType, {
          definitions: {
            custom: {
              properties: {
                property1: {},
                property2: null,
              },
            },
          },
        })
        await filter.onDeploy([toChange({ before: groupSchemaBeforeInstance, after: groupSchemaAfterInstanceTwo })])
        expect(groupSchemaAfterInstanceTwo.value.definitions.custom.properties.property2).toBeUndefined()
      })
    })
  })

  describe('schemas without additional properties ', () => {
    const userSchemaType = new ObjectType({ elemID: new ElemID(OKTA, USER_SCHEMA_TYPE_NAME) })
    const userSchemaBeforeInstance = new InstanceElement('defaultGroupSchema', userSchemaType, {
      definitions: {
        custom: {
          properties: {
            property1: {},
            property2: {},
          },
        },
      },
    })
    const userSchemaAfterInstance = new InstanceElement('defaultGroupSchema', userSchemaType, {
      definitions: {
        custom: {
          properties: {
            property1: {},
          },
        },
      },
    })
    describe('preDeploy', () => {
      it('should add null to removed Properties', async () => {
        const userSchemaBeforeInstanceCopy = userSchemaBeforeInstance.clone()
        const userSchemaAfterInstanceCopy = userSchemaAfterInstance.clone()
        await filter.preDeploy([toChange({ before: userSchemaBeforeInstanceCopy, after: userSchemaAfterInstanceCopy })])
        expect(userSchemaAfterInstanceCopy.value.definitions.custom.properties.property2).toBeNull()
      })
      it('should add null when changing property name', async () => {
        const userSchemaAfterModifyedInstance = new InstanceElement('defaultGroupSchema', userSchemaType, {
          definitions: {
            custom: {
              properties: {
                property1: {},
                property3: {},
              },
            },
          },
        })
        await filter.preDeploy([toChange({ before: userSchemaBeforeInstance, after: userSchemaAfterModifyedInstance })])
        expect(userSchemaAfterModifyedInstance.value.definitions.custom.properties.property2).toBeNull()
      })
    })
    describe('onDeploy', () => {
      it('should delete Properties with null', async () => {
        const userSchemaAfterInstanceTwo = new InstanceElement('defaultGroupSchema', userSchemaType, {
          definitions: {
            custom: {
              properties: {
                property1: {},
                property2: null,
              },
            },
          },
        })
        await filter.onDeploy([toChange({ before: userSchemaBeforeInstance, after: userSchemaAfterInstanceTwo })])
        expect(userSchemaAfterInstanceTwo.value.definitions.custom.properties.property2).toBeUndefined()
      })
    })
  })
})
