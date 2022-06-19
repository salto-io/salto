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
import { ObjectType, Element, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/profile_instance_split'
import { FilterWith } from '../../src/filter'
import { generateProfileType, defaultFilterContext } from '../utils'
import mockClient from '../client'
import { SALESFORCE, RECORDS_PATH } from '../../src/constants'

describe('Profile Instance Split filter', () => {
  const { client } = mockClient()

  describe('Map profile instances', () => {
    const filter = filterCreator({ client, config: defaultFilterContext }) as FilterWith<'onFetch'>

    let profileObj: ObjectType
    let profileInstances: InstanceElement[]
    let elements: Element[]

    beforeAll(async () => {
      profileObj = generateProfileType(true)
      profileInstances = [
        new InstanceElement(
          'profile1',
          profileObj,
          {
            applicationVisibilities: {
              app1: { application: 'app1', default: true, visible: false },
              app2: { application: 'app2', default: true, visible: false },
            },
            fieldPermissions: {
              Account: {
                AccountNumber: {
                  field: 'Account.AccountNumber',
                  editable: true,
                  readable: true,
                },
              },
              Contact: {
                HasOptedOutOfEmail: {
                  field: 'Contact.HasOptedOutOfEmail',
                  editable: true,
                  readable: true,
                },
              },
            },
            layoutAssignments: {
              // eslint-disable-next-line camelcase
              Account_Account_Layout: [
                { layout: 'Account-Account Layout' },
              ],
              // eslint-disable-next-line camelcase
              Account_random_characters_aaa___bbb: [
                { layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb', recordType: 'something' },
              ],
            },
            fullName: 'profile1',
            userLicense: 'Salesforce Platform',
          },
          ['salesforce', 'Records', 'Profile', 'profile1'],
        ),
        new InstanceElement(
          'profile2',
          profileObj,
          {
            fieldPermissions: {
              Account: {
                AccountNumber: {
                  field: 'Account.AccountNumber',
                  editable: true,
                  readable: true,
                },
              },
              Contact: {
                HasOptedOutOfEmail: {
                  field: 'Contact.HasOptedOutOfEmail',
                  editable: true,
                  readable: true,
                },
              },
            },
            fullName: 'profile2',
          },
          ['salesforce', 'Records', 'Profile', 'profile2'],
        ),
      ]

      elements = [profileObj, ...profileInstances.map(e => e.clone())]
      await filter.onFetch(elements)
    })
    it('should create a correct pathIndex', () => {
      const profElems = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'profile1')
      expect(profElems).toHaveLength(1)
      const [profile] = profElems
      expect(Array.from(profile.pathIndex?.entries() ?? []))
        .toEqual([
          [
            profile.elemID.getFullName(),
            [SALESFORCE, RECORDS_PATH, 'Profile', profile.elemID.name, 'Attributes'],
          ],
          [
            profile.elemID.createNestedID('applicationVisibilities').getFullName(),
            [SALESFORCE, RECORDS_PATH, 'Profile', profile.elemID.name, 'ApplicationVisibilities'],
          ],
          [
            profile.elemID.createNestedID('fieldPermissions').getFullName(),
            [SALESFORCE, RECORDS_PATH, 'Profile', profile.elemID.name, 'FieldPermissions'],
          ],
          [
            profile.elemID.createNestedID('layoutAssignments').getFullName(),
            [SALESFORCE, RECORDS_PATH, 'Profile', profile.elemID.name, 'LayoutAssignments'],
          ],
          [
            profile.elemID.createNestedID('fullName').getFullName(),
            [SALESFORCE, RECORDS_PATH, 'Profile', profile.elemID.name, 'Attributes'],
          ],
          [
            profile.elemID.createNestedID('userLicense').getFullName(),
            [SALESFORCE, RECORDS_PATH, 'Profile', profile.elemID.name, 'Attributes'],
          ],
        ])
      const origProfile = profileInstances.find(e => e.elemID.name === 'profile1')
      expect(profile.isEqual(origProfile as InstanceElement)).toEqual(true)
    })

    it('should only create paths in the pathIndex for defined fields', () => {
      const profElems = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'profile2')
      expect(profElems).toHaveLength(1)
      const [profile] = profElems
      expect(Array.from(profile.pathIndex?.entries() ?? []))
        .toEqual([
          [
            profile.elemID.getFullName(),
            [SALESFORCE, RECORDS_PATH, 'Profile', profile.elemID.name, 'Attributes'],
          ],
          [
            profile.elemID.createNestedID('fieldPermissions').getFullName(),
            [SALESFORCE, RECORDS_PATH, 'Profile', profile.elemID.name, 'FieldPermissions'],
          ],
          [
            profile.elemID.createNestedID('fullName').getFullName(),
            [SALESFORCE, RECORDS_PATH, 'Profile', profile.elemID.name, 'Attributes'],
          ],
        ])
      const origProfile = profileInstances.find(e => e.elemID.name === 'profile2')
      expect(profile.isEqual(origProfile as InstanceElement)).toEqual(true)
    })
  })

  describe('Old (list) profile instances', () => {
    const filter = filterCreator({ client, config: { ...defaultFilterContext, useOldProfiles: true } }) as FilterWith<'onFetch'>

    let profileObj: ObjectType
    let profileInstances: InstanceElement[]
    let elements: Element[]

    beforeAll(async () => {
      profileObj = generateProfileType(false)
      profileInstances = [
        new InstanceElement(
          'profile1',
          profileObj,
          {
            applicationVisibilities: [
              { application: 'app1', default: true, visible: false },
            ],
            fieldPermissions: [
              { field: 'Account.AccountNumber', editable: true, readable: true },
              { field: 'Contact.HasOptedOutOfEmail', editable: true, readable: true },
            ],
            fullName: 'profile1',
            userLicense: 'Salesforce Platform',
          },
          ['salesforce', 'Records', 'Profile', 'profile1'],
        ),
      ]

      elements = [profileObj, ...profileInstances.map(e => e.clone())]
      await filter.onFetch(elements)
    })
    it('should do nothing, and keep the profile as a single instance with the original path', () => {
      const profElems = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'profile1')
      expect(profElems).toHaveLength(1)
      const [profile] = profElems
      expect(Array.from(profile.pathIndex?.entries() ?? []))
        .toEqual([
          [
            profile.elemID.getFullName(),
            [SALESFORCE, RECORDS_PATH, 'Profile', profile.elemID.name],
          ],
        ])
    })
  })
})
