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
import { InstanceElement, ObjectType, MapType, isListType, isMapType, Change, toChange } from '@salto-io/adapter-api'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { FilterWith } from '../../src/filter'
import filterCreator from '../../src/filters/convert_maps'
import mockClient from '../client'
import { generateProfileType } from '../utils'

type layoutAssignmentType = { layout: string; recordType?: string }

const generateProfileInstance = ({
  profileObj,
  instanceName,
  fields,
  layoutAssignments,
  applications,
}: {
  profileObj: ObjectType
  instanceName: string
  fields: string[]
  layoutAssignments: layoutAssignmentType[]
  applications: string[]
}): InstanceElement => (
  new InstanceElement(
    instanceName,
    profileObj,
    {
      applicationVisibilities: applications.map(
        application => ({ application, default: true, visible: false })
      ),
      layoutAssignments,
      fieldPermissions: fields.map(field => ({ field, editable: true, readable: true })),
    }
  )
)

describe('ProfileMaps filter', () => {
  const { client } = mockClient()

  describe('on fetch', () => {
    const filter = filterCreator({ client, config: { fetchProfile: buildFetchProfile({}) } }) as FilterWith<'onFetch' | 'preDeploy'>
    let profileObj: ObjectType
    let instances: InstanceElement[]

    describe('with regular instances', () => {
      const generateInstances = (objType: ObjectType): InstanceElement[] => ([
        generateProfileInstance({
          profileObj: objType,
          instanceName: 'aaa',
          applications: ['app1', 'app2'],
          fields: ['Account.AccountNumber', 'Contact.HasOptedOutOfEmail'],
          layoutAssignments: [
            { layout: 'Account-Account Layout' },
            // dots etc are escaped in the layout's name
            { layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb', recordType: 'something' },
            { layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb', recordType: 'repetition' },
            { layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb', recordType: 'repetition' },
          ],
        }),
        generateProfileInstance({
          profileObj: objType,
          instanceName: 'bbb',
          applications: ['someApp'],
          fields: ['Account.AccountNumber'],
          layoutAssignments: [
            { layout: 'Account-Account Layout' },
          ],
        }),
      ])
      beforeAll(async () => {
        profileObj = generateProfileType()
        instances = generateInstances(profileObj)
        await filter.onFetch([profileObj, ...instances])
      })

      it('should convert object field types to maps', () => {
        expect(profileObj).toEqual(generateProfileType(true))
        const fieldType = profileObj.fields.applicationVisibilities.type
        expect(isMapType(fieldType)).toBeTruthy()
        expect(isListType((fieldType as MapType).innerType)).toBeFalsy()
      })
      it('should convert instance values to maps', () => {
        expect((instances[0] as InstanceElement).value).toEqual({
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
            'Account_Account_Layout@bs': [
              { layout: 'Account-Account Layout' },
            ],
            'Account_random_characters__3B_2E_2B_3F_22aaa_27__2B__bbb@bssppppppupbs': [
              { layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb', recordType: 'something' },
              { layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb', recordType: 'repetition' },
              { layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb', recordType: 'repetition' },
            ],
          },
        })
      })
      it('should contain the original elements after fetch + preDeploy', async () => {
        const afterProfileObj = generateProfileType()
        const afterInstances = generateInstances(afterProfileObj)
        await filter.onFetch([afterProfileObj, ...afterInstances])
        const changes = instances.map(
          (inst, idx) => toChange({ before: inst, after: afterInstances[idx] })
        )
        await filter.preDeploy(changes)
        expect(afterProfileObj).toEqual(generateProfileType(false, true))
        expect(profileObj).toEqual(generateProfileType(true))
        expect(afterInstances).toEqual(generateInstances(afterProfileObj))
        expect(instances).toEqual(generateInstances(profileObj))
      })
    })

    describe('with unexpected non-unique fields', () => {
      beforeAll(async () => {
        profileObj = generateProfileType()
        instances = [
          generateProfileInstance({
            profileObj,
            instanceName: 'aaa',
            applications: ['app1', 'app2'],
            fields: ['Account.AccountNumber', 'Contact.HasOptedOutOfEmail'],
            layoutAssignments: [
              { layout: 'Account-Account Layout' },
              // dots etc are escaped in the layout's name
              { layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb', recordType: 'something' },
              { layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb', recordType: 'repetition' },
              { layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb', recordType: 'repetition' },
            ],
          }),
          generateProfileInstance({
            profileObj,
            instanceName: 'unexpected values',
            applications: ['sameApp', 'sameApp'],
            fields: ['Account.AccountNumber', 'Contact.HasOptedOutOfEmail', 'Account.AccountNumber'],
            layoutAssignments: [
              { layout: 'Account-Account Layout' },
              { layout: 'too.many.separators', recordType: 'something' },
              { layout: 'too.many.wrongIndexing', recordType: 'something' },
            ],
          }),
        ]
        await filter.onFetch([profileObj, ...instances])
      })

      it('should convert all fields with duplicates into (maps of) lists', () => {
        const fieldType = profileObj.fields.applicationVisibilities.type
        expect(isMapType(fieldType)).toBeTruthy()
        expect(isListType((fieldType as MapType).innerType)).toBeTruthy()
        expect(Array.isArray(
          (instances[1] as InstanceElement).value.applicationVisibilities.sameApp
        )).toBeTruthy()
        expect(Array.isArray(
          (instances[0] as InstanceElement).value.applicationVisibilities.app1
        )).toBeTruthy()
        expect(Array.isArray(
          (instances[1] as InstanceElement).value.fieldPermissions.Account.AccountNumber
        )).toBeTruthy()
        expect(Array.isArray(
          (instances[0] as InstanceElement).value.fieldPermissions.Contact.HasOptedOutOfEmail
        )).toBeTruthy()
      })

      it('should not fail even if there are unexpected API_NAME_SEPARATORs in the indexed value', () => {
        const inst = instances[1] as InstanceElement
        expect(inst.value.layoutAssignments).toEqual({
          'Account_Account_Layout@bs': [{ layout: 'Account-Account Layout' }],
          too: [
            { layout: 'too.many.separators', recordType: 'something' },
            { layout: 'too.many.wrongIndexing', recordType: 'something' },
          ],
        })
      })
    })
  })

  describe('deploy (pre + on)', () => {
    const filter = filterCreator({ client, config: { fetchProfile: buildFetchProfile({}) } }) as FilterWith<'preDeploy' | 'onDeploy'>
    let beforeProfileObj: ObjectType
    let afterProfileObj: ObjectType
    let beforeInstances: InstanceElement[]
    let afterInstances: InstanceElement[]
    let changes: Change[]

    const generateInstances = (objType: ObjectType): InstanceElement[] => ([
      new InstanceElement(
        'profile1',
        objType,
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
            'Account_Account_Layout@bs': [
              { layout: 'Account-Account Layout' },
            ],
            'Account_random_characters__3B_2E_2B_3F_22aaa_27__2B__bbb@bssppppppupbs': [
              { layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb', recordType: 'something' },
              { layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb', recordType: 'repetition' },
              { layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb', recordType: 'repetition' },
            ],
          },
        }
      ),
      new InstanceElement(
        'profile2',
        objType,
        {
          applicationVisibilities: {
            app1: { application: 'app1', default: false, visible: false },
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
            'Account_Account_Layout@bs': [
              { layout: 'Account-Account Layout' },
            ],
          },
        }
      ),
    ])

    beforeAll(async () => {
      beforeProfileObj = generateProfileType(true)
      beforeInstances = generateInstances(beforeProfileObj)
      afterProfileObj = generateProfileType(true)
      afterInstances = generateInstances(afterProfileObj)
      changes = beforeInstances.map((inst, idx) => (
        toChange({ before: inst, after: afterInstances[idx] })
      ))
      await filter.preDeploy(changes)
    })
    it('should convert the object back to list on preDeploy', () => {
      expect(afterProfileObj).toEqual(generateProfileType(false, true))
    })

    it('should convert the instances back to lists on preDeploy', () => {
      expect(Array.isArray(afterInstances[0].value.applicationVisibilities)).toBeTruthy()
      expect(Array.isArray(afterInstances[0].value.fieldPermissions)).toBeTruthy()
      expect(Array.isArray(afterInstances[0].value.layoutAssignments)).toBeTruthy()
      expect(Array.isArray(beforeInstances[0].value.applicationVisibilities)).toBeTruthy()
      expect(Array.isArray(beforeInstances[0].value.fieldPermissions)).toBeTruthy()
      expect(Array.isArray(beforeInstances[0].value.layoutAssignments)).toBeTruthy()
    })

    it('should return object and instances to their original form', async () => {
      await filter.onDeploy(changes)
      expect(beforeProfileObj).toEqual(generateProfileType(true))
      expect(afterProfileObj).toEqual(generateProfileType(true))
      expect(beforeInstances).toEqual(generateInstances(beforeProfileObj))
      expect(afterInstances).toEqual(generateInstances(afterProfileObj))
    })
  })

  describe('with profile maps disabled', () => {
    const filter = filterCreator({ client, config: { useOldProfiles: true, fetchProfile: buildFetchProfile({}) } }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

    it('should do nothing onFetch', async () => {
      const profileObj = generateProfileType()
      const elements = [
        profileObj,
        generateProfileInstance({
          profileObj,
          instanceName: 'aaa',
          applications: ['app1', 'app2'],
          fields: ['Account.AccountNumber', 'Contact.HasOptedOutOfEmail'],
          layoutAssignments: [],
        }),
      ]

      await filter.onFetch(elements)
      expect(profileObj).toEqual(generateProfileType())
    })

    it('should do nothing preDeploy', async () => {
      const profileObj = generateProfileType(true)
      const inst = new InstanceElement(
        'profileWithMaps',
        profileObj,
        {
          applicationVisibilities: { app1: { application: 'app1' } },
          fieldPermissions: { Account: { AccountNumber: { field: 'Account.AccountNumber' } } },
          layoutAssignments: {},
        },
      )

      await filter.preDeploy([{ action: 'add', data: { after: inst } }])
      expect(profileObj).toEqual(generateProfileType(true))
      expect(inst.value.fieldPermissions).toEqual({ Account: { AccountNumber: { field: 'Account.AccountNumber' } } })
    })

    it('should do nothing onDeploy', async () => {
      const profileObj = generateProfileType()
      const inst = generateProfileInstance({
        profileObj,
        instanceName: 'aaa',
        applications: ['app1', 'app2'],
        fields: ['Account.AccountNumber', 'Contact.HasOptedOutOfEmail'],
        layoutAssignments: [],
      })

      await filter.onDeploy([{ action: 'add', data: { after: inst } }])
      expect(inst.type).toEqual(generateProfileType())
      expect(profileObj).toEqual(generateProfileType())
      expect(Array.isArray(inst.value.fieldPermissions)).toBeTruthy()
    })
  })
})
