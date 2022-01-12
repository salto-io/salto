/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, InstanceElement, ListType, MapType, ObjectType, toChange } from '@salto-io/adapter-api'
import { deployment, filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { mockClient } from '../../utils'
import { DEFAULT_CONFIG } from '../../../src/config'
import { JIRA } from '../../../src/constants'
import fieldsDeploymentFilter from '../../../src/filters/fields/field_deployment_filter'
import JiraClient from '../../../src/client/client'
import * as contexts from '../../../src/filters/fields/contexts'
import * as defaultValues from '../../../src/filters/fields/default_values'


jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn(),
    },
  }
})

describe('fields_deployment', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let fieldType: ObjectType
  const deployChangeMock = deployment.deployChange as jest.MockedFunction<
    typeof deployment.deployChange
  >
  let client: JiraClient
  let paginator: clientUtils.Paginator
  const deployContextsMock = jest.spyOn(contexts, 'deployContexts').mockResolvedValue()
  const updateDefaultValuesMock = jest.spyOn(defaultValues, 'updateDefaultValues').mockResolvedValue()
  beforeEach(() => {
    deployChangeMock.mockClear()
    deployContextsMock.mockClear()
    updateDefaultValuesMock.mockClear()

    const mockCli = mockClient()
    client = mockCli.client
    paginator = mockCli.paginator
    filter = fieldsDeploymentFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
    }) as typeof filter

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, 'Field'),
    })
  })
  it('should call deployChange for all the fields expect contexts', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldType,
      {},
    )

    const change = toChange({ before: instance, after: instance })
    await filter.deploy([change])
    expect(deployChangeMock).toHaveBeenCalledWith(
      change,
      client,
      DEFAULT_CONFIG.apiDefinitions.types.Field.deployRequests,
      ['contexts'],
      undefined,
    )
  })

  it('should call updateDefaultValues and deployContexts if change is not removal', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldType,
      {},
    )

    const change = toChange({ before: instance, after: instance })
    await filter.deploy([change])

    expect(deployContextsMock).toHaveBeenCalledWith(
      change,
      client,
      DEFAULT_CONFIG.apiDefinitions
    )

    expect(updateDefaultValuesMock).toHaveBeenCalledWith(
      change,
      client,
    )
  })

  it('should not call updateDefaultValues and deployContexts if change is removal', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldType,
      {},
    )

    const change = toChange({ before: instance })
    await filter.deploy([change])

    expect(deployContextsMock).not.toHaveBeenCalled()
    expect(updateDefaultValuesMock).not.toHaveBeenCalled()
  })

  it('should add the appropriate deployment annotations to the type', async () => {
    const optionType = new ObjectType({
      elemID: new ElemID(JIRA, 'CustomFieldContextOption'),
      fields: {
        value: { refType: BuiltinTypes.STRING },
        optionId: { refType: BuiltinTypes.STRING },
        disabled: { refType: BuiltinTypes.STRING },
        position: { refType: BuiltinTypes.NUMBER },
      },
    })

    const defaultValueType = new ObjectType({
      elemID: new ElemID(JIRA, 'CustomFieldContextDefaultValue'),
      fields: {
        type: { refType: BuiltinTypes.STRING },
      },
    })

    const contextType = new ObjectType({
      elemID: new ElemID(JIRA, 'CustomFieldContext'),
      fields: {
        options: { refType: new MapType(optionType) },
        defaultValue: { refType: defaultValueType },
        projectIds: { refType: new ListType(BuiltinTypes.STRING) },
        issueTypeIds: { refType: new ListType(BuiltinTypes.STRING) },
      },
    })

    fieldType.fields.contexts = new Field(fieldType, 'contexts', new MapType(contextType))

    await filter.onFetch([fieldType])

    expect(fieldType.fields.contexts.annotations).toEqual({
      [CORE_ANNOTATIONS.CREATABLE]: true,
      [CORE_ANNOTATIONS.UPDATABLE]: true,
    })

    expect(contextType.fields.projectIds.annotations).toEqual({
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
  })
})
