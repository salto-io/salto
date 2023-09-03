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

import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { isJiraSoftwareFreeLicense } from '../src/utils'
import { getAccountInfoInstance } from './utils'
import { JIRA } from '../src/constants'

describe('utils', () => {
  let accountInfo: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  let isFree: boolean
  describe('isJiraSoftwareFreeLicense', () => {
    it('should return true if license is free', async () => {
      const accountInfoInstanceFree = getAccountInfoInstance(true)
      elementsSource = buildElementsSourceFromElements([accountInfoInstanceFree])
      isFree = await isJiraSoftwareFreeLicense(elementsSource)
      expect(isFree).toBeTruthy()
    })
    it('should return false if license is not free', async () => {
      const accountInfoInstanceFree = getAccountInfoInstance(false)
      elementsSource = buildElementsSourceFromElements([accountInfoInstanceFree])
      isFree = await isJiraSoftwareFreeLicense(elementsSource)
      expect(isFree).toBeFalsy()
    })
    it('should return true if there is no account info instance', async () => {
      elementsSource = buildElementsSourceFromElements([])
      isFree = await isJiraSoftwareFreeLicense(elementsSource)
      expect(isFree).toBeTruthy()
    })
    it('should return true if there is no jira software license', async () => {
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
                plan: 'PAID',
              },
            ],
          },
        }
      )
      elementsSource = buildElementsSourceFromElements([accountInfo])
      isFree = await isJiraSoftwareFreeLicense(elementsSource)
      expect(isFree).toBeTruthy()
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
        }
      )
      elementsSource = buildElementsSourceFromElements([accountInfo])
      isFree = await isJiraSoftwareFreeLicense(elementsSource)
      expect(isFree).toBeTruthy()
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
        }
      )
      elementsSource = buildElementsSourceFromElements([accountInfo])
      isFree = await isJiraSoftwareFreeLicense(elementsSource)
      expect(isFree).toBeFalsy()
    })
  })
})
