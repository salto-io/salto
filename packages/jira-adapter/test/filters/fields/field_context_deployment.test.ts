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
import {
  AdditionChange,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ListType,
  MapType,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA } from '../../../src/constants'
import contextDeploymentFilter from '../../../src/filters/fields/context_deployment_filter'
import JiraClient from '../../../src/client/client'
import * as contexts from '../../../src/filters/fields/contexts'
import { FIELD_CONTEXT_TYPE_NAME } from '../../../src/filters/fields/constants'

describe('fieldContextDeployment', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let fieldType: ObjectType
  let contextType: ObjectType
  let optionType: ObjectType
  let defaultValueType: ObjectType
  let userFilterType: ObjectType

  let client: JiraClient
  let paginator: clientUtils.Paginator
  const deployContextChangeMock = jest.spyOn(contexts, 'deployContextChange')

  beforeEach(() => {
    deployContextChangeMock.mockClear()

    const mockCli = mockClient()
    client = mockCli.client
    paginator = mockCli.paginator

    filter = contextDeploymentFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter

    optionType = new ObjectType({
      elemID: new ElemID(JIRA, 'CustomFieldContextOption'),
      fields: {
        value: { refType: BuiltinTypes.STRING },
        optionId: { refType: BuiltinTypes.STRING },
        disabled: { refType: BuiltinTypes.STRING },
        position: { refType: BuiltinTypes.NUMBER },
      },
    })

    userFilterType = new ObjectType({
      elemID: new ElemID(JIRA, 'UserFilter'),
      fields: {
        groups: { refType: BuiltinTypes.STRING },
      },
    })

    defaultValueType = new ObjectType({
      elemID: new ElemID(JIRA, 'CustomFieldContextDefaultValue'),
      fields: {
        type: { refType: BuiltinTypes.STRING },
        userFilter: { refType: userFilterType },
      },
    })

    contextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
      fields: {
        options: { refType: new MapType(optionType) },
        defaultValue: { refType: defaultValueType },
        projectIds: { refType: new ListType(BuiltinTypes.STRING) },
        issueTypeIds: { refType: new ListType(BuiltinTypes.STRING) },
      },
    })

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, 'Field'),
      fields: {
        contexts: { refType: new ListType(contextType) },
      },
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotations to context type', async () => {
      await filter.onFetch([fieldType, contextType])

      expect(fieldType.fields.contexts.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(contextType.fields.issueTypeIds.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(contextType.fields.options.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(optionType.fields.value.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(optionType.fields.optionId.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(optionType.fields.disabled.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(optionType.fields.position.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(contextType.fields.defaultValue.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(defaultValueType.fields.type.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(userFilterType.fields.groups.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })
  })
  describe('Deploy', () => {
    it('should call deployContextChange on addition', async () => {
      const instance = new InstanceElement('instance', contextType, {})
      const change = toChange({ after: instance })
      await filter.deploy([change])
      expect(deployContextChangeMock).toHaveBeenCalledWith(
        change,
        client,
        getDefaultConfig({ isDataCenter: false }).apiDefinitions,
        paginator,
        expect.anything(),
      )
    })
    it('should call deployContextChange on modification', async () => {
      const instance = new InstanceElement('instance', contextType, {})
      const change = toChange({ after: instance, before: instance })
      await filter.deploy([change])
      expect(deployContextChangeMock).toHaveBeenCalledWith(
        change,
        client,
        getDefaultConfig({ isDataCenter: false }).apiDefinitions,
        paginator,
        expect.anything(),
      )
    })
    it('should call deployContextChange on removal', async () => {
      fieldType = new ObjectType({
        elemID: new ElemID(JIRA, 'Field'),
        fields: {
          contexts: { refType: new ListType(contextType) },
        },
      })
      const fieldInstance = new InstanceElement('field', fieldType, {})
      const instance = new InstanceElement('instance', contextType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
      })
      const change = toChange({ before: instance })
      await filter.deploy([change])
      expect(deployContextChangeMock).toHaveBeenCalledWith(
        change,
        client,
        getDefaultConfig({ isDataCenter: false }).apiDefinitions,
        paginator,
        expect.anything(),
      )
    })
    it('should not call deployContextChange on removal without parent', async () => {
      const instance = new InstanceElement('instance', contextType, {})
      const change = toChange({ before: instance })
      await filter.deploy([change])
      expect(deployContextChangeMock).not.toHaveBeenCalled()
    })
  })
  describe('Deploy context for locked field', () => {
    let fieldInstcnae: InstanceElement
    let contextInstance: InstanceElement
    let mockGet: jest.SpyInstance
    beforeEach(() => {
      const { client: cli } = mockClient(false)
      client = cli
      mockGet = jest.spyOn(client, 'get')
      fieldInstcnae = new InstanceElement('field', fieldType, {
        name: 'field_1',
        description: 'auto-created by jira service',
        type: 'com.atlassian.servicedesk:vp-origin',
        isLocked: true,
      })
      contextInstance = new InstanceElement(
        'context',
        contextType,
        {
          name: 'context_1',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(fieldInstcnae.elemID, fieldInstcnae),
        },
      )
    })
    it('should deploy custom field context with jsm locked field if it was created in the service', async () => {
      mockGet.mockResolvedValueOnce({
        status: 200,
        data: {
          values: [
            {
              id: '1',
              name: 'context_1',
              isGlobalContext: true,
            },
          ],
        },
      })
      filter = contextDeploymentFilter(
        getFilterParams({
          client,
          paginator,
        }),
      ) as typeof filter
      const change = toChange({ after: contextInstance }) as AdditionChange<InstanceElement>
      const res = await filter.deploy([change])
      expect(deployContextChangeMock).toHaveBeenCalledTimes(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(change.data.after.value.id).toEqual('1')
    })
    it('should not deploy custom field context with jsm locked field f it was not created in the service', async () => {
      mockGet.mockResolvedValueOnce({
        status: 200,
        data: {
          values: [
            {
              id: '1',
              name: 'context_1',
              isGlobalContext: true,
            },
          ],
        },
      })
      filter = contextDeploymentFilter(
        getFilterParams({
          client,
          paginator,
        }),
      ) as typeof filter
      contextInstance.value.name = 'context_2'
      const change = toChange({ after: contextInstance }) as AdditionChange<InstanceElement>
      const res = await filter.deploy([change])
      expect(deployContextChangeMock).toHaveBeenCalledTimes(0)
      expect(res.deployResult.errors).toHaveLength(1)
    })
    it('should not deploy custom field context with jsm locked field if it is a bad response', async () => {
      mockGet.mockResolvedValue({
        status: 404,
        data: {
          errorMessages: ['The component with id 1 does not exist.'],
        },
      })
      filter = contextDeploymentFilter(
        getFilterParams({
          client,
          paginator,
        }),
      ) as typeof filter
      const change = toChange({ after: contextInstance }) as AdditionChange<InstanceElement>
      const res = await filter.deploy([change])
      expect(deployContextChangeMock).toHaveBeenCalledTimes(0)
      expect(res.deployResult.errors).toHaveLength(1)
    })
  })
})
