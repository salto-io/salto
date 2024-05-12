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
import { Element, InstanceElement, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import {
  DOMAIN_TYPE_NAME,
  GROUP_MEMBER_TYPE_NAME,
  GROUP_TYPE_NAME,
  ROLE_ASSIGNMENT_TYPE_NAME,
  ROLE_TYPE_NAME,
  SCHEMA_TYPE_NAME,
} from '../src/constants'
import { Credentials } from '../src/auth'
import { credsLease, realAdapter, Reals } from './adapter'

const log = logger(module)

jest.setTimeout(1000 * 60 * 10)

describe('Google Workspace adapter E2E', () => {
  describe('fetch and deploy', () => {
    let credLease: CredsLease<Credentials>
    let adapterAttr: Reals
    let elements: Element[] = []

    beforeAll(async () => {
      log.resetLogCount()
      credLease = await credsLease()
      adapterAttr = realAdapter({ credentials: credLease.value, elementsSource: buildElementsSourceFromElements([]) })
      const fetchResult = await adapterAttr.adapter.fetch({
        progressReporter: { reportProgress: () => null },
      })
      elements = fetchResult.elements
    })

    afterAll(async () => {
      if (credLease.return) {
        await credLease.return()
      }
      log.info('Google Workspace adapter E2E: Log counts = %o', log.getLogCount())
    })
    describe('fetch the regular instances and types', () => {
      const expectedTypes = [
        GROUP_TYPE_NAME,
        ROLE_TYPE_NAME,
        DOMAIN_TYPE_NAME,
        ROLE_ASSIGNMENT_TYPE_NAME,
        GROUP_MEMBER_TYPE_NAME,
        SCHEMA_TYPE_NAME,
      ]
      const typesWithInstances = new Set(expectedTypes)

      let createdTypeNames: string[]
      let createdInstances: InstanceElement[]

      beforeAll(async () => {
        createdTypeNames = elements.filter(isObjectType).map(e => e.elemID.typeName)
        createdInstances = elements.filter(isInstanceElement)
      })

      it.each(expectedTypes)('should fetch %s', async typeName => {
        expect(createdTypeNames).toContain(typeName)
        if (typesWithInstances.has(typeName)) {
          expect(createdInstances.filter(instance => instance.elemID.typeName === typeName).length).toBeGreaterThan(0)
        }
      })
    })
  })
})
