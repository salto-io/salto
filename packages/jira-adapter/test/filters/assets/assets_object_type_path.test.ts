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
import { filterUtils, elements as adapterElements } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, Element } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../../src/config/config'
import assetsObjectTypePath from '../../../src/filters/assets/assets_object_type_path'
import { createEmptyType, getFilterParams } from '../../utils'
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_TYPE, JIRA } from '../../../src/constants'

describe('assetsObjectTypePathsFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let elements: Element[]
  let parentInstance: InstanceElement
  let sonOneInstance: InstanceElement
  let sonTwoInstance: InstanceElement
  let grandsonOneInstance: InstanceElement
  let grandsonTwoInstance: InstanceElement
  const assetSchemaInstance = new InstanceElement(
    'assetsSchema1',
    createEmptyType(OBJECT_SCHEMA_TYPE),
    {
      idAsInt: 5,
      name: 'assetsSchema',
    },
    [JIRA, adapterElements.RECORDS_PATH, 'ObjectSchema', 'assetsSchema1', 'assetsSchema1'],
  )
  describe('on fetch', () => {
    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.enableJsmExperimental = true
      filter = assetsObjectTypePath(getFilterParams({ config })) as typeof filter
      parentInstance = new InstanceElement(
        'parentInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'parentInstance',
          parentObjectTypeId: new ReferenceExpression(assetSchemaInstance.elemID, assetSchemaInstance),
        },
        [JIRA, adapterElements.RECORDS_PATH, 'ObjectSchema', 'assetsSchema1', 'objectTypes', 'parentInstance'],
      )
      sonOneInstance = new InstanceElement(
        'sonOneInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'sonOneInstance',
          parentObjectTypeId: new ReferenceExpression(parentInstance.elemID, parentInstance),
        },
        [JIRA, adapterElements.RECORDS_PATH, 'ObjectSchema', 'assetsSchema1', 'objectTypes', 'sonOneInstance'],
      )
      sonTwoInstance = new InstanceElement(
        'sonTwoInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'sonTwoInstance',
          parentObjectTypeId: new ReferenceExpression(parentInstance.elemID, parentInstance),
        },
        [JIRA, adapterElements.RECORDS_PATH, 'ObjectSchema', 'assetsSchema1', 'objectTypes', 'sonTwoInstance'],
      )
      grandsonOneInstance = new InstanceElement(
        'grandsonOneInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'grandsonOneInstance',
          parentObjectTypeId: new ReferenceExpression(sonOneInstance.elemID, sonOneInstance),
        },
        [JIRA, adapterElements.RECORDS_PATH, 'ObjectSchema', 'assetsSchema1', 'objectTypes', 'grandsonOneInstance'],
      )
      grandsonTwoInstance = new InstanceElement(
        'grandsonTwoInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          name: 'grandsonTwoInstance',
          parentObjectTypeId: new ReferenceExpression(sonOneInstance.elemID, sonOneInstance),
        },
        [JIRA, adapterElements.RECORDS_PATH, 'ObjectSchema', 'assetsSchema1', 'objectTypes', 'grandsonTwoInstance'],
      )

      elements = [
        parentInstance,
        sonOneInstance,
        sonTwoInstance,
        grandsonOneInstance,
        grandsonTwoInstance,
        assetSchemaInstance,
      ]
    })
    it('should change path to be subdirectory of parent', async () => {
      await filter.onFetch(elements)
      expect(parentInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        'ObjectSchema',
        'assetsSchema1',
        'objectTypes',
        'parentInstance',
        'parentInstance',
      ])
      expect(sonOneInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        'ObjectSchema',
        'assetsSchema1',
        'objectTypes',
        'parentInstance',
        'sonOneInstance',
        'sonOneInstance',
      ])
      expect(sonTwoInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        'ObjectSchema',
        'assetsSchema1',
        'objectTypes',
        'parentInstance',
        'sonTwoInstance',
        'sonTwoInstance',
      ])
      expect(grandsonOneInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        'ObjectSchema',
        'assetsSchema1',
        'objectTypes',
        'parentInstance',
        'sonOneInstance',
        'grandsonOneInstance',
        'grandsonOneInstance',
      ])
      expect(grandsonTwoInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        'ObjectSchema',
        'assetsSchema1',
        'objectTypes',
        'parentInstance',
        'sonOneInstance',
        'grandsonTwoInstance',
        'grandsonTwoInstance',
      ])
    })
  })
})
