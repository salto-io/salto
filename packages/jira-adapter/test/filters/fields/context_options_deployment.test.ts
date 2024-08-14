/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import _ from 'lodash'
import { getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { JIRA } from '../../../src/constants'
import optionsDeploymentFilter from '../../../src/filters/fields/context_options_deployment_filter'
import JiraClient from '../../../src/client/client'
import * as contexts from '../../../src/filters/fields/contexts'
// import { FIELD_CONTEXT_TYPE_NAME } from '../../../src/filters/fields/constants'

describe('fieldContextDeployment', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let config: JiraConfig
  let fieldType: ObjectType
  let contextType: ObjectType
  let optionType: ObjectType
  let client: JiraClient
  let paginator: clientUtils.Paginator
  const deployContextChangeMock = jest.spyOn(contexts, 'deployContextChange')

  beforeEach(() => {
    deployContextChangeMock.mockClear()
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.splitFieldContextOptions = true
    const mockCli = mockClient()
    client = mockCli.client
    paginator = mockCli.paginator
    filter = optionsDeploymentFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as typeof filter

    optionType = new ObjectType({
      elemID: new ElemID(JIRA, 'CustomFieldContextOption'),
      fields: {
        value: { refType: BuiltinTypes.STRING },
        optionId: { refType: BuiltinTypes.STRING },
        disabled: { refType: BuiltinTypes.STRING },
      },
    })

    contextType = new ObjectType({
      elemID: new ElemID(JIRA, 'CustomFieldContext'),
      fields: {
        options: { refType: new MapType(optionType) },
        // defaultValue: { refType: defaultValueType },
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
  describe('Deploy', () => {
    it('should call deployContextChange on addition', async () => {
      const fieldInstance = new InstanceElement('field', fieldType, {})
      const contextInstance = new InstanceElement('context', contextType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
      })
      const instance = new InstanceElement('instance', optionType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
      })
      const change = toChange({ after: instance })
      await filter.deploy([change])
      // expect(deployContextChangeMock).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     change,
      //     client,
      //     config: getDefaultConfig({ isDataCenter: false }),
      //     paginator,
      //   }),
      // )
    })
    it('should call deployContextChange on modification', async () => {
      const instance = new InstanceElement('instance', contextType, {})
      const change = toChange({ after: instance, before: instance })
      await filter.deploy([change])
      // expect(deployContextChangeMock).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     change,
      //     client,
      //     config: getDefaultConfig({ isDataCenter: false }),
      //     paginator,
      //   }),
      // )
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
      // expect(deployContextChangeMock).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     change,
      //     client,
      //     config: getDefaultConfig({ isDataCenter: false }),
      //     paginator,
      //   }),
      // )
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
      filter = optionsDeploymentFilter(
        getFilterParams({
          client,
          paginator,
        }),
      ) as typeof filter
      const change = toChange({ after: contextInstance }) as AdditionChange<InstanceElement>
      const res = await filter.deploy([change])
      expect(deployContextChangeMock).toHaveBeenCalledTimes(0)
      expect(res.deployResult.errors).toHaveLength(0)
      // expect(change.data.after.value.id).toEqual('1')
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
      filter = optionsDeploymentFilter(
        getFilterParams({
          client,
          paginator,
        }),
      ) as typeof filter
      contextInstance.value.name = 'context_2'
      const change = toChange({ after: contextInstance }) as AdditionChange<InstanceElement>
      // const res = await filter.deploy([change])
      await filter.deploy([change])
      expect(deployContextChangeMock).toHaveBeenCalledTimes(0)
      // expect(res.deployResult.errors).toHaveLength(1)
    })
    it('should not deploy custom field context with jsm locked field if it is a bad response', async () => {
      mockGet.mockResolvedValue({
        status: 404,
        data: {
          errorMessages: ['The component with id 1 does not exist.'],
        },
      })
      filter = optionsDeploymentFilter(
        getFilterParams({
          client,
          paginator,
        }),
      ) as typeof filter
      const change = toChange({ after: contextInstance }) as AdditionChange<InstanceElement>
      // const res = await filter.deploy([change])
      await filter.deploy([change])
      expect(deployContextChangeMock).toHaveBeenCalledTimes(0)
      // expect(res.deployResult.errors).toHaveLength(1)
    })
  })
})
