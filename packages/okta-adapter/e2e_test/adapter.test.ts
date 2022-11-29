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
import { Element, isObjectType, isInstanceElement } from '@salto-io/adapter-api'
import { config as configUtils } from '@salto-io/adapter-components'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import _ from 'lodash'
import { Credentials } from '../src/auth'
import { credsLease, realAdapter } from './adapter'
import 'jest-extended'
import OktaAdapter from '../src/adapter'
import { DEFAULT_CONFIG } from '../src/config'
import { GROUP_TYPE_NAME, APPLICATION_TYPE_NAME } from '../src/constants'

jest.setTimeout(300 * 1000)

describe('Okta E2E', () => {
  let fetchedElements: Element[]
  let credLease: CredsLease<Credentials>
  let adapter: OktaAdapter

  beforeAll(async () => {
    credLease = await credsLease()
    const config = _.cloneDeep(DEFAULT_CONFIG);
    (config.apiDefinitions.types.Application.transformation as configUtils.TransformationConfig).idFields = ['name', 'status']
    const adapterAttr = realAdapter({ credentials: credLease.value }, config)
    adapter = adapterAttr.adapter
    const { elements } = await adapter.fetch({
      progressReporter:
        { reportProgress: () => null },
    })
    fetchedElements = elements
  })

  afterAll(async () => {
    if (credLease.return) {
      await credLease.return()
    }
  })

  describe('should fetch types', () => {
    let fetchedTypes: string[]

    beforeAll(() => {
      fetchedTypes = fetchedElements
        .filter(isObjectType)
        .map(e => e.elemID.typeName)
    })
    it.each(Object.keys(DEFAULT_CONFIG.apiDefinitions.types))('%s', expectedType => {
      expect(fetchedTypes).toContain(expectedType)
    })
  })

  it('should fetch default instances', () => {
    const groupInstance = fetchedElements
      .filter(isInstanceElement)
      .find(e => e.elemID.typeName === GROUP_TYPE_NAME)
    expect(groupInstance?.value).toContainKeys([
      'objectClass',
      'profile',
      'type',
      'users',
    ])
    expect(groupInstance?.value.profile?.name).toEqual('Everyone')

    const applicationInstance = fetchedElements
      .filter(isInstanceElement)
      .find(e => e.elemID.typeName === APPLICATION_TYPE_NAME)
    expect(applicationInstance?.value).toContainKeys([
      'name',
      'label',
      'status',
      'profileEnrollment',
      'accessPolicy',
    ])
    expect(applicationInstance?.value.name).toEqual('saasure')
  })
})
