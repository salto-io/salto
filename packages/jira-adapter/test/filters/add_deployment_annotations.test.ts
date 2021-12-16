/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ElemID, ObjectType } from '@salto-io/adapter-api'
import { filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { JiraConfig } from '../../src/config'
import { JIRA } from '../../src/constants'
import addDeploymentAnnotationsFilter from '../../src/filters/add_deployment_annotations'
import { getDefaultAdapterConfig, mockClient } from '../utils'

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    elements: {
      ...actual.elements,
      swagger: {
        ...actual.elements.swagger,
        addDeploymentAnnotations: jest.fn(),
      },
    },
  }
})

describe('addDeploymentAnnotationsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let adapterConfig: JiraConfig
  beforeEach(async () => {
    const { client, paginator } = mockClient()
    adapterConfig = await getDefaultAdapterConfig()

    filter = addDeploymentAnnotationsFilter({
      client,
      paginator,
      config: {
        ...adapterConfig,
        swaggers: [{} as elementUtils.swagger.LoadedSwagger],
      },
    }) as typeof filter
  })

  it('should pass the endpoint to addDeploymentAnnotations', async () => {
    await filter.onFetch([new ObjectType({ elemID: new ElemID(JIRA, 'someType') })])
    expect(elementUtils.swagger.addDeploymentAnnotations).toHaveBeenCalledWith(
      [expect.any(ObjectType)],
      expect.any(Object),
      adapterConfig.apiDefinitions,
    )
  })
})
