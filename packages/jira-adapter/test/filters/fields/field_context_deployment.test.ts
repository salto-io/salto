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
        contextName: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true } },
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
  describe('options', () => {
    let context: InstanceElement
    let optionInstance1: InstanceElement
    let optionInstance2: InstanceElement
    beforeEach(() => {
      context = new InstanceElement('context1', contextType, {})
      optionInstance1 = new InstanceElement(
        'option1',
        optionType,
        {
          value: 'val1',
          id: '1',
          disabled: 'false',
          contextName: 'context1',
        },
        undefined,
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(context.elemID, context, context)] },
      )
      optionInstance2 = new InstanceElement(
        'option2',
        optionType,
        {
          value: 'val2',
          id: '2',
          disabled: 'false',
          contextName: 'context1',
        },
        undefined,
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(context.elemID, context, context)] },
      )
      context.value.options = [
        new ReferenceExpression(optionInstance1.elemID, optionInstance1, optionInstance1),
        new ReferenceExpression(optionInstance2.elemID, optionInstance2, optionInstance2),
      ]
    })
    it('should transform options with their changed data', async () => {
      const change = toChange({ after: context })
      const contextToDeploy = new InstanceElement('context1', contextType, {
        options: {
          val1: {
            value: 'val1',
            id: '1',
            disabled: 'false',
            position: 1,
          },
          val2: {
            value: 'val2',
            id: '2',
            disabled: 'false',
            position: 2,
          },
        },
      })
      await filter.deploy([change])
      expect(deployContextChangeMock).toHaveBeenCalledWith(
        toChange({ after: contextToDeploy }),
        client,
        getDefaultConfig({ isDataCenter: false }).apiDefinitions,
        paginator,
        expect.anything(),
      )
    })
    it('should transform additioned options to their original form', async () => {
      const before = context.clone()
      before.value.options.pop()
      const contextChange = toChange({ before, after: context })
      const optionChange = toChange({ after: optionInstance2 })

      const beforeContextToDeploy = new InstanceElement('context1', contextType, {
        options: {
          val1: {
            value: 'val1',
            id: '1',
            disabled: 'false',
            position: 1,
          },
        },
      })
      const afterContextToDeploy = new InstanceElement('context1', contextType, {
        options: {
          val1: {
            value: 'val1',
            id: '1',
            disabled: 'false',
            position: 1,
          },
          val2: {
            value: 'val2',
            id: '2',
            disabled: 'false',
            position: 2,
          },
        },
      })
      await filter.deploy([contextChange, optionChange])
      expect(deployContextChangeMock).toHaveBeenCalledWith(
        toChange({ before: beforeContextToDeploy, after: afterContextToDeploy }),
        client,
        getDefaultConfig({ isDataCenter: false }).apiDefinitions,
        paginator,
        expect.anything(),
      )
    })
    it('should transform modified options to their original form', async () => {
      const contextChange = toChange({ before: context, after: context })
      const option1After = optionInstance1.clone()
      option1After.value.value = 'val1_new'
      const optionChange = toChange({ before: optionInstance1, after: option1After })

      const beforeContextToDeploy = new InstanceElement('context1', contextType, {
        options: {
          val1: {
            value: 'val1',
            id: '1',
            disabled: 'false',
            position: 1,
          },
          val2: {
            value: 'val2',
            id: '2',
            disabled: 'false',
            position: 2,
          },
        },
      })
      const afterContextToDeploy = new InstanceElement('context1', contextType, {
        options: {
          val1_new: {
            value: 'val1_new',
            id: '1',
            disabled: 'false',
            position: 1,
          },
          val2: {
            value: 'val2',
            id: '2',
            disabled: 'false',
            position: 2,
          },
        },
      })
      await filter.deploy([contextChange, optionChange])
      expect(deployContextChangeMock).toHaveBeenCalledWith(
        toChange({ before: beforeContextToDeploy, after: afterContextToDeploy }),
        client,
        getDefaultConfig({ isDataCenter: false }).apiDefinitions,
        paginator,
        expect.anything(),
      )
    })
  })
})
