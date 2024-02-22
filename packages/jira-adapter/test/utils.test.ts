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

import { client as clientUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { hasSoftwareProject, isAllFreeLicense, isJiraSoftwareFreeLicense } from '../src/utils'
import { createEmptyType, getAccountInfoInstance, mockClient } from './utils'
import { JIRA } from '../src/constants'
import JiraClient from '../src/client/client'

describe('utils', () => {
  let accountInfo: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  const accountInfoType = createEmptyType('AccountInfo')
  describe('isJiraSoftwareFreeLicense', () => {
    it('should return true if license is free', async () => {
      const accountInfoInstanceFree = getAccountInfoInstance(true)
      elementsSource = buildElementsSourceFromElements([accountInfoInstanceFree])
      expect(await isJiraSoftwareFreeLicense(elementsSource)).toBeTruthy()
    })
    it('should return false if license is not free', async () => {
      const accountInfoInstanceFree = getAccountInfoInstance(false)
      elementsSource = buildElementsSourceFromElements([accountInfoInstanceFree])
      expect(await isJiraSoftwareFreeLicense(elementsSource)).toBeFalsy()
    })
    it('should return true if there is no account info instance', async () => {
      elementsSource = buildElementsSourceFromElements([])
      expect(await isJiraSoftwareFreeLicense(elementsSource)).toBeTruthy()
    })
    it('should return true if there is no jira software license', async () => {
      accountInfo = new InstanceElement('_config', accountInfoType, {
        license: {
          applications: [
            {
              id: 'jira-serviceDesk',
              plan: 'PAID',
            },
          ],
        },
      })
      elementsSource = buildElementsSourceFromElements([accountInfo])
      expect(await isJiraSoftwareFreeLicense(elementsSource)).toBeTruthy()
    })
    it('should return true if account info does not have applications', async () => {
      accountInfo = new InstanceElement('_config', accountInfoType, {
        license: {},
      })
      elementsSource = buildElementsSourceFromElements([accountInfo])
      expect(await isJiraSoftwareFreeLicense(elementsSource)).toBeTruthy()
    })
  })
  describe('isAllFreeLicense', () => {
    it('should return true if all licenses are free', async () => {
      accountInfo = new InstanceElement(
        '_config',
        new ObjectType({
          elemID: new ElemID(JIRA, 'AccountInfo'),
        }),
        {
          license: {
            applications: [
              {
                id: 'jira-serviceDesk',
                plan: 'FREE',
              },
              {
                id: 'jira-software',
                plan: 'FREE',
              },
            ],
          },
        },
      )
      elementsSource = buildElementsSourceFromElements([accountInfo])
      expect(await isAllFreeLicense(elementsSource)).toBeTruthy()
    })
    it('should return false if one license is not free', async () => {
      accountInfo = new InstanceElement(
        '_config',
        new ObjectType({
          elemID: new ElemID(JIRA, 'AccountInfo'),
        }),
        {
          license: {
            applications: [
              {
                id: 'jira-serviceDesk',
                plan: 'FREE',
              },
              {
                id: 'jira-software',
                plan: 'BUSINESS',
              },
            ],
          },
        },
      )
      elementsSource = buildElementsSourceFromElements([accountInfo])
      expect(await isAllFreeLicense(elementsSource)).toBeFalsy()
    })
    it('should return true if account info does not have applications', async () => {
      accountInfo = new InstanceElement('_config', accountInfoType, {
        license: {},
      })
      elementsSource = buildElementsSourceFromElements([accountInfo])
      expect(await isAllFreeLicense(elementsSource)).toBeFalsy()
    })
    it('should return true if there is no account info instance', async () => {
      elementsSource = buildElementsSourceFromElements([])
      expect(await isAllFreeLicense(elementsSource)).toBeFalsy()
    })
  })
  describe('hasSoftwareProject', () => {
    let client: JiraClient
    let connection: MockInterface<clientUtils.APIConnection>
    beforeEach(() => {
      const { client: cli, connection: conn } = mockClient(false)
      client = cli
      connection = conn
      connection.get.mockImplementation(async url => {
        if (url === '/rest/api/3/project/search') {
          return {
            status: 200,
            data: {
              values: [
                {
                  projectTypeKey: 'service_desk',
                },
                {
                  projectTypeKey: 'software',
                },
              ],
            },
          }
        }
        throw new Error(`unexpected url: ${url}`)
      })
    })
    it('should return true if there is software project', async () => {
      expect(await hasSoftwareProject(client)).toEqual(true)
    })
    it('should return true if api thorws an error', async () => {
      connection.get.mockRejectedValueOnce(new Error('test'))
      expect(await hasSoftwareProject(client)).toEqual(true)
    })
    it('should return false if there is no software project', async () => {
      connection.get.mockImplementation(async url => {
        if (url === '/rest/api/3/project/search') {
          return {
            status: 200,
            data: {
              values: [
                {
                  projectTypeKey: 'service_desk',
                },
                {
                  projectTypeKey: 'service_desk',
                },
              ],
            },
          }
        }
        throw new Error(`unexpected url: ${url}`)
      })
      expect(await hasSoftwareProject(client)).toEqual(false)
    })
  })
})
