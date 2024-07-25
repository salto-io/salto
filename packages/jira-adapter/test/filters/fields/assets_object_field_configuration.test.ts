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
import {
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import assetsObjectFieldConfigurationFilter from '../../../src/filters/assets/assets_object_field_configuration'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import JiraClient from '../../../src/client/client'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import { JIRA } from '../../../src/constants'

describe('assetsObjectFieldConfiguration', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let client: JiraClient
  let config: JiraConfig
  let elements: Element[]
  let contextInstance1: InstanceElement
  let contextInstance2: InstanceElement
  let fieldContextType: ObjectType
  let fieldInstance: InstanceElement

  beforeEach(() => {
    fieldContextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })

    fieldInstance = new InstanceElement('field', createEmptyType(FIELD_TYPE_NAME), {
      name: 'field',
      type: 'com.atlassian.jira.plugins.cmdb:cmdb-object-cftype',
    })

    contextInstance1 = new InstanceElement(
      'context1',
      fieldContextType,
      {
        name: 'context',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)],
      },
    )
    contextInstance2 = new InstanceElement(
      'context2',
      createEmptyType(FIELD_CONTEXT_TYPE_NAME),
      {
        name: 'context2',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)],
      },
    )

    fieldInstance.value.contexts = [
      new ReferenceExpression(contextInstance1.elemID, contextInstance1),
      new ReferenceExpression(contextInstance2.elemID, contextInstance2),
    ]
    describe('onFetch', () => {
      beforeEach(() => {
        const { client: cli } = mockClient()
        client = cli
        config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableAssetsObjectFieldConfiguration = true
        filter = assetsObjectFieldConfigurationFilter(
          getFilterParams({
            client,
            config,
          }),
        ) as typeof filter
      })
    })
    it('should add assetsObjectFieldConfigurationType', async () => {
      elements = []
      await filter.onFetch(elements)
      expect(elements.length).toBe(1)
      expect(elements[0]).toEqual(
        expect.objectContaining({
          elemID: new ElemID(JIRA, 'AssetsObjectFieldConfiguration'),
          fields: expect.objectContaining({
            id: expect.objectContaining({ refType: 'string', annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true } }),
          }),
          annotations: expect.objectContaining({
            [CORE_ANNOTATIONS.CREATABLE]: true,
            [CORE_ANNOTATIONS.UPDATABLE]: true,
            [CORE_ANNOTATIONS.DELETABLE]: true,
          }),
        }),
      )
    })

    it('should not add assetsObjectFieldConfigurationType when the flag is disabled', async () => {
      config.fetch.enableAssetsObjectFieldConfiguration = false
      elements = []
      await filter.onFetch(elements)
      expect(elements.length).toBe(0)
    })

    it('should add assetsObjectFieldConfiguration field to field type', async () => {
      elements = [fieldContextType]
      await filter.onFetch(elements)
      expect(elements.length).toBe(2)
      expect(fieldContextType.fields.assetsObjectFieldConfiguration).toEqual(
        expect.objectContaining({
          refType: expect.objectContaining({
            elemID: new ElemID(JIRA, 'AssetsObjectFieldConfiguration'),
            annotations: {
              [CORE_ANNOTATIONS.CREATABLE]: true,
              [CORE_ANNOTATIONS.UPDATABLE]: true,
              [CORE_ANNOTATIONS.DELETABLE]: true,
            },
          }),
        }),
      )
    })
  })
})
