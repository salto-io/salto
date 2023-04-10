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
import { AdapterOperations, ElemID, FetchResult, ElemIdGetter, ServiceIds, ObjectType, InstanceElement } from '@salto-io/adapter-api'
import { elements } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import MockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import { adapter as adapterCreator } from '../src/adapter_creator'
import { DEFAULT_CONFIG } from '../src/config'
import { OKTA } from '../src/constants'
import { createCredentialsInstance, createConfigInstance } from './utils'


const { generateTypes, getAllInstances } = elements.swagger

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  // only including relevant functions
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      changeValidators: actual.deployment.changeValidators,
      deployChange: jest.fn().mockImplementation(actual.elements.swagger.deployChange),
    },
    elements: {
      ...actual.elements,
      swagger: {
        flattenAdditionalProperties: actual.elements.swagger.flattenAdditionalProperties,
        generateTypes: jest.fn().mockImplementation(() => { throw new Error('generateTypes called without a mock') }),
        getAllInstances: jest.fn().mockImplementation(() => { throw new Error('getAllInstances called without a mock') }),
        addDeploymentAnnotations: jest.fn(),
      },
    },
  }
})

describe('Okta adapter', () => {
  let adapter: AdapterOperations
  let getElemIdFunc: ElemIdGetter

  beforeEach(() => {
    const elementsSource = buildElementsSourceFromElements([])
    getElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string): ElemID =>
      new ElemID(adapterName, name)

    const config = createConfigInstance(DEFAULT_CONFIG)

    adapter = adapterCreator.operations({
      elementsSource,
      credentials: createCredentialsInstance({ baseUrl: 'http:/okta.test', token: 't' }),
      config,
      getElemIdFunc,
    })
  })

  describe('fetch', () => {
    let result: FetchResult
    let oktaTestType: ObjectType
    let testInstance: InstanceElement
    let mockAxiosAdapter: MockAdapter

    beforeEach(async () => {
      oktaTestType = new ObjectType({
        elemID: new ElemID(OKTA, 'okta'),
      })
      testInstance = new InstanceElement('test', oktaTestType);

      (generateTypes as jest.MockedFunction<typeof generateTypes>)
        .mockResolvedValueOnce({
          allTypes: { OktaTest: oktaTestType },
          parsedConfigs: { OktaTest: { request: { url: 'okta' } } },
        });
      (getAllInstances as jest.MockedFunction<typeof getAllInstances>)
        .mockResolvedValue({ elements: [testInstance] })
      mockAxiosAdapter = new MockAdapter(axios)
      // mock as there are gets of users during fetch
      mockAxiosAdapter.onGet().reply(200, { })
      result = await adapter.fetch({ progressReporter: { reportProgress: () => null } })
    })

    it('should return all types and instances returned from the infrastructure', () => {
      expect(result.elements).toContain(oktaTestType)
      expect(result.elements).toContain(testInstance)
    })
  })
})
