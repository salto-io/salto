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

import { filterUtils, elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, isInstanceElement, isObjectType, toChange } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { getDefaultConfig } from '../../../src/config/config'
import dafaultAttributeFilter from '../../../src/filters/assets/label_object_type_attribute'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import {
  OBJECT_SCHEMA_TYPE,
  OBJECT_TYPE_TYPE,
  JIRA,
  OBJECT_TYPE_ATTRIBUTE_TYPE,
  OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE,
} from '../../../src/constants'
import JiraClient from '../../../src/client/client'

const createAttributeInstance = (
  id: number,
  suffix: string,
  objectType: InstanceElement,
  isLabel: boolean,
): InstanceElement =>
  new InstanceElement(
    `assetsObjectType${suffix}`,
    createEmptyType(OBJECT_TYPE_ATTRIBUTE_TYPE),
    {
      id,
      name: `assetsObjectType${suffix}`,
      objectType: new ReferenceExpression(objectType.elemID, objectType),
      label: isLabel,
    },
    [
      JIRA,
      elementUtils.RECORDS_PATH,
      OBJECT_SCHEMA_TYPE,
      'assetsSchema',
      'assetsObjectTypes',
      'parentObjectTypeInstance',
      'attributes',
      `assetsObjectType${suffix}`,
    ],
  )
describe('labelObjectTypeAttributeFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy'>
  let filter: FilterType
  let client: JiraClient
  const objectTypeInstance = new InstanceElement(
    'parent_Object_Type_Instance@sss',
    createEmptyType(OBJECT_TYPE_TYPE),
    {
      id: 'p1',
      name: 'AssetsObjectTypeP1',
    },
    [
      JIRA,
      elementUtils.RECORDS_PATH,
      OBJECT_SCHEMA_TYPE,
      'assetsSchema',
      'assetsObjectTypes',
      'parentObjectTypeInstance',
      'parentObjectTypeInstance',
    ],
  )
  const attributeInstanceOne = createAttributeInstance(1, 'One', objectTypeInstance, false)
  const attributeInstanceTwo = createAttributeInstance(2, 'Two', objectTypeInstance, true)
  describe('fetch', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.enableJsmExperimental = true
      filter = dafaultAttributeFilter(getFilterParams({ config, client })) as typeof filter
    })
    it('should add labelAttributeInstance and type to the elements', async () => {
      const elements = [objectTypeInstance, attributeInstanceOne, attributeInstanceTwo]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(5)
      const labelAttributeInstances = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE)
      expect(labelAttributeInstances[0]).toBeDefined()
      expect(labelAttributeInstances[0].elemID.name).toEqual('parent_Object_Type_Instance_label_attribute@sssuu')
      expect(labelAttributeInstances[0].value.labelAttribute).toEqual(
        new ReferenceExpression(attributeInstanceTwo.elemID, attributeInstanceTwo),
      )
      const labelAttributeType = elements
        .filter(isObjectType)
        .find(e => e.elemID.typeName === OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE)
      expect(labelAttributeType).toBeDefined()
    })
    it('should do nothing for instnaces without objectType references', async () => {
      const elements = [objectTypeInstance, attributeInstanceOne, attributeInstanceTwo]
      delete attributeInstanceTwo.value.objectType
      await filter.onFetch(elements)
      expect(elements).toHaveLength(4)
    })
  })
  describe('deploy', () => {
    let connection: MockInterface<clientUtils.APIConnection>
    let labelAttributeInstance: InstanceElement
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.enableJSMPremium = true
      const { client: cli, connection: conn } = mockClient(false)
      client = cli
      connection = conn
      filter = dafaultAttributeFilter(getFilterParams({ config, client })) as typeof filter
      labelAttributeInstance = new InstanceElement(
        'labelAttributeInstance',
        createEmptyType(OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE),
        {
          objectType: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
          labelAttribute: new ReferenceExpression(attributeInstanceTwo.elemID, attributeInstanceTwo),
        },
      )
      connection.get.mockImplementation(async url => {
        if (url === '/rest/servicedeskapi/assets/workspace') {
          return {
            status: 200,
            data: {
              values: [
                {
                  workspaceId: 'workspaceId',
                },
              ],
            },
          }
        }
        throw new Error('Unexpected url')
      })
      connection.put.mockResolvedValueOnce({ status: 200, data: {} })
    })
    it('should set label in addition change', async () => {
      const changes = [toChange({ after: labelAttributeInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.put).toHaveBeenCalledTimes(1)
    })
    it('should set label in modifictaion change', async () => {
      const labelAttributeInstanceAfter = labelAttributeInstance.clone()
      labelAttributeInstanceAfter.value.labelAttribute = new ReferenceExpression(
        attributeInstanceOne.elemID,
        attributeInstanceOne,
      )
      const changes = [toChange({ before: labelAttributeInstance, after: labelAttributeInstanceAfter })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.put).toHaveBeenCalledTimes(1)
    })
    it('should do nothing if labelAttribute is not a referenceExpression', async () => {
      const labelAttributeInstanceAfter = labelAttributeInstance.clone()
      labelAttributeInstanceAfter.value.labelAttribute = 'unexpected string'
      const changes = [toChange({ before: labelAttributeInstance, after: labelAttributeInstanceAfter })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(connection.put).toHaveBeenCalledTimes(0)
    })
    it('should do nothing on removalChange', async () => {
      const changes = [toChange({ before: labelAttributeInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(connection.put).toHaveBeenCalledTimes(0)
    })
    it('should return error when workspaceId is undefined', async () => {
      connection.get.mockResolvedValueOnce({ status: 200, data: {} })
      const changes = [toChange({ after: labelAttributeInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toEqual(
        'The following changes were not deployed, due to error with the workspaceId: jira.ObjectTypeLabelAttribute.instance.labelAttributeInstance',
      )
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(connection.post).toHaveBeenCalledTimes(0)
    })
  })
})
