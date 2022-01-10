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
import { Element, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { Credentials } from '../src/auth'
import { credsLease, realAdapter } from './adapter'
import { DEFAULT_API_DEFINITIONS } from '../src/config'
import 'jest-extended'

jest.setTimeout(30 * 1000)

describe('Jira E2E', () => {
  let fetchedElements: Element[]
  let credLease: CredsLease<Credentials>

  beforeAll(async () => {
    credLease = await credsLease()
    const adapterAttr = realAdapter({ credentials: credLease.value })
    const { elements } = await adapterAttr.adapter.fetch({
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
    it.each(Object.keys(DEFAULT_API_DEFINITIONS.types))('%s', expectedType => {
      expect(fetchedTypes).toContain(expectedType)
    })
  })
  it('should fetch project with schemes', () => {
    const projectInstance = fetchedElements
      .filter(isInstanceElement)
      .find(e => e.elemID.typeName === 'Project')
    expect(projectInstance?.value).toContainKeys([
      'workflowScheme',
      'permissionScheme',
      'notificationScheme',
      'issueTypeScreenScheme',
      'fieldConfigurationScheme',
    ])
  })
})
