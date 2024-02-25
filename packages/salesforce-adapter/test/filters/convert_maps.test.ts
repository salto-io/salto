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
import {
  Element,
  InstanceElement,
  ObjectType,
  MapType,
  isListType,
  isMapType,
  Change,
  toChange,
  isObjectType,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/convert_maps'
import {
  generateProfileType,
  generatePermissionSetType,
  defaultFilterContext,
} from '../utils'
import { createInstanceElement } from '../../src/transformers/transformer'
import { mockTypes } from '../mock_elements'
import { FilterWith } from './mocks'

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
}): InstanceElement =>
  new InstanceElement(instanceName, profileObj, {
    applicationVisibilities: applications.map((application) => ({
      application,
      default: true,
      visible: false,
    })),
    layoutAssignments,
    fieldPermissions: fields.map((field) => ({
      field,
      editable: true,
      readable: true,
    })),
  })

const generatePermissionSetInstance = ({
  permissionSetObj,
  instanceName,
  fields,
  applications,
}: {
  permissionSetObj: ObjectType
  instanceName: string
  fields: string[]
  applications: string[]
}): InstanceElement =>
  new InstanceElement(instanceName, permissionSetObj, {
    applicationVisibilities: applications.map((application) => ({
      application,
      default: true,
      visible: false,
    })),
    fieldPermissions: fields.map((field) => ({
      field,
      editable: true,
      readable: true,
    })),
  })

describe('Convert maps filter', () => {
  describe('Profile Maps filter', () => {
    describe('on fetch', () => {
      const filter = filterCreator({
        config: { ...defaultFilterContext },
      }) as FilterWith<'onFetch' | 'preDeploy'>
      let profileObj: ObjectType
      let instances: InstanceElement[]

      describe('with regular instances', () => {
        const generateInstances = (objType: ObjectType): InstanceElement[] => [
          generateProfileInstance({
            profileObj: objType,
            instanceName: 'aaa',
            applications: ['app1', 'app2'],
            fields: ['Account.AccountNumber', 'Contact.HasOptedOutOfEmail'],
            layoutAssignments: [
              { layout: 'Account-Account Layout' },
              // dots etc are escaped in the layout's name
              {
                layout:
                  'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                recordType: 'something',
              },
              {
                layout:
                  'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                recordType: 'repetition',
              },
              {
                layout:
                  'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                recordType: 'repetition',
              },
            ],
          }),
          generateProfileInstance({
            profileObj: objType,
            instanceName: 'bbb',
            applications: ['someApp'],
            fields: ['Account.AccountNumber'],
            layoutAssignments: [{ layout: 'Account-Account Layout' }],
          }),
        ]
        beforeAll(async () => {
          profileObj = generateProfileType()
          instances = generateInstances(profileObj)
          await filter.onFetch([profileObj, ...instances])
        })

        it('should convert object field types to maps', async () => {
          expect(profileObj).toEqual(generateProfileType(true))
          const fieldType =
            await profileObj.fields.applicationVisibilities.getType()
          expect(isMapType(fieldType)).toBeTruthy()
          expect(isListType((fieldType as MapType).getInnerType())).toBeFalsy()
        })
        it('should mark the fields that are used for keys as _required=true', async () => {
          expect(profileObj).toEqual(generateProfileType(true))
          const fieldType =
            await profileObj.fields.applicationVisibilities.getType()
          expect(isMapType(fieldType)).toBeTruthy()
          expect(isListType((fieldType as MapType).getInnerType())).toBeFalsy()
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
              'Account_random_characters__3B_2E_2B_3F_22aaa_27__2B__bbb@bssppppppupbs':
                [
                  {
                    layout:
                      'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                    recordType: 'something',
                  },
                  {
                    layout:
                      'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                    recordType: 'repetition',
                  },
                  {
                    layout:
                      'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                    recordType: 'repetition',
                  },
                ],
            },
          })
        })
        it('should contain the original elements after fetch + preDeploy', async () => {
          const afterProfileObj = generateProfileType()
          const afterInstances = generateInstances(afterProfileObj)
          await filter.onFetch([afterProfileObj, ...afterInstances])
          const changes = instances.map((inst, idx) =>
            toChange({ before: inst, after: afterInstances[idx] }),
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
                {
                  layout:
                    'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'something',
                },
                {
                  layout:
                    'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'repetition',
                },
                {
                  layout:
                    'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'repetition',
                },
              ],
            }),
            generateProfileInstance({
              profileObj,
              instanceName: 'unexpected values',
              applications: ['sameApp', 'sameApp'],
              fields: [
                'Account.AccountNumber',
                'Contact.HasOptedOutOfEmail',
                'Account.AccountNumber',
              ],
              layoutAssignments: [
                { layout: 'Account-Account Layout' },
                { layout: 'too.many.separators', recordType: 'something' },
                { layout: 'too.many.wrongIndexing', recordType: 'something' },
              ],
            }),
          ]
          await filter.onFetch([profileObj, ...instances])
        })

        it('should convert all fields with duplicates into (maps of) lists', async () => {
          const fieldType =
            await profileObj.fields.applicationVisibilities.getType()
          expect(isMapType(fieldType)).toBeTruthy()
          expect(
            isListType(await (fieldType as MapType).getInnerType()),
          ).toBeTruthy()
          expect(
            Array.isArray(
              (instances[1] as InstanceElement).value.applicationVisibilities
                .sameApp,
            ),
          ).toBeTruthy()
          expect(
            Array.isArray(
              (instances[0] as InstanceElement).value.applicationVisibilities
                .app1,
            ),
          ).toBeTruthy()
          expect(
            Array.isArray(
              (instances[1] as InstanceElement).value.fieldPermissions.Account
                .AccountNumber,
            ),
          ).toBeTruthy()
          expect(
            Array.isArray(
              (instances[0] as InstanceElement).value.fieldPermissions.Contact
                .HasOptedOutOfEmail,
            ),
          ).toBeTruthy()
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
      const filter = filterCreator({
        config: defaultFilterContext,
      }) as FilterWith<'preDeploy' | 'onDeploy'>
      let beforeProfileObj: ObjectType
      let afterProfileObj: ObjectType
      let beforeInstances: InstanceElement[]
      let afterInstances: InstanceElement[]
      let changes: Change[]

      const generateInstances = (objType: ObjectType): InstanceElement[] => [
        new InstanceElement('profile1', objType, {
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
            'Account_Account_Layout@bs': [{ layout: 'Account-Account Layout' }],
            'Account_random_characters__3B_2E_2B_3F_22aaa_27__2B__bbb@bssppppppupbs':
              [
                {
                  layout:
                    'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'something',
                },
                {
                  layout:
                    'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'repetition',
                },
                {
                  layout:
                    'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'repetition',
                },
              ],
          },
        }),
        new InstanceElement('profile2', objType, {
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
            'Account_Account_Layout@bs': [{ layout: 'Account-Account Layout' }],
          },
        }),
      ]

      beforeAll(async () => {
        beforeProfileObj = generateProfileType(true)
        beforeInstances = generateInstances(beforeProfileObj)
        afterProfileObj = generateProfileType(true)
        afterInstances = generateInstances(afterProfileObj)
        changes = beforeInstances.map((inst, idx) =>
          toChange({ before: inst, after: afterInstances[idx] }),
        )
        await filter.preDeploy(changes)
      })
      it('should convert the object back to list on preDeploy', () => {
        expect(afterProfileObj).toEqual(generateProfileType(false, true))
      })

      it('should convert the instances back to lists on preDeploy', () => {
        expect(
          Array.isArray(afterInstances[0].value.applicationVisibilities),
        ).toBeTruthy()
        expect(
          Array.isArray(afterInstances[0].value.fieldPermissions),
        ).toBeTruthy()
        expect(
          Array.isArray(afterInstances[0].value.layoutAssignments),
        ).toBeTruthy()
        expect(
          Array.isArray(beforeInstances[0].value.applicationVisibilities),
        ).toBeTruthy()
        expect(
          Array.isArray(beforeInstances[0].value.fieldPermissions),
        ).toBeTruthy()
        expect(
          Array.isArray(beforeInstances[0].value.layoutAssignments),
        ).toBeTruthy()
      })

      it('should return object and instances to their original form', async () => {
        await filter.onDeploy(changes)
        expect(beforeProfileObj).toEqual(generateProfileType(true))
        expect(afterProfileObj).toEqual(generateProfileType(true))
        expect(beforeInstances).toEqual(generateInstances(beforeProfileObj))
        expect(afterInstances).toEqual(generateInstances(afterProfileObj))
      })
    })
  })
  describe('Permission Set Maps filter', () => {
    describe('on fetch', () => {
      const filter = filterCreator({
        config: { ...defaultFilterContext },
      }) as FilterWith<'onFetch' | 'preDeploy'>
      let permissionSetObj: ObjectType
      let instances: InstanceElement[]

      describe('with regular instances', () => {
        const generatePermissionSetInstances = (
          objType: ObjectType,
        ): InstanceElement[] => [
          generatePermissionSetInstance({
            permissionSetObj: objType,
            instanceName: 'aaa',
            applications: ['app1', 'app2'],
            fields: ['Account.AccountNumber', 'Contact.HasOptedOutOfEmail'],
          }),
          generatePermissionSetInstance({
            permissionSetObj: objType,
            instanceName: 'bbb',
            applications: ['someApp'],
            fields: ['Account.AccountNumber'],
          }),
        ]
        beforeAll(async () => {
          permissionSetObj = generatePermissionSetType()
          instances = generatePermissionSetInstances(permissionSetObj)
          await filter.onFetch([permissionSetObj, ...instances])
        })

        it('should convert object field types to maps', async () => {
          expect(permissionSetObj).toEqual(generatePermissionSetType(true))
          const fieldType =
            await permissionSetObj.fields.applicationVisibilities.getType()
          expect(isMapType(fieldType)).toBeTruthy()
          expect(isListType((fieldType as MapType).getInnerType())).toBeFalsy()
        })
        it('should mark the fields that are used for keys as _required=true', async () => {
          expect(permissionSetObj).toEqual(generatePermissionSetType(true))
          const fieldType =
            await permissionSetObj.fields.applicationVisibilities.getType()
          expect(isMapType(fieldType)).toBeTruthy()
          expect(isListType((fieldType as MapType).getInnerType())).toBeFalsy()
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
          })
        })
        it('should contain the original elements after fetch + preDeploy', async () => {
          const afterPermissionSetObj = generatePermissionSetType()
          const afterInstances = generatePermissionSetInstances(
            afterPermissionSetObj,
          )
          await filter.onFetch([afterPermissionSetObj, ...afterInstances])
          const changes = instances.map((inst, idx) =>
            toChange({ before: inst, after: afterInstances[idx] }),
          )
          await filter.preDeploy(changes)
          expect(afterPermissionSetObj).toEqual(
            generatePermissionSetType(false, true),
          )
          expect(permissionSetObj).toEqual(generatePermissionSetType(true))
          expect(afterInstances).toEqual(
            generatePermissionSetInstances(afterPermissionSetObj),
          )
          expect(instances).toEqual(
            generatePermissionSetInstances(permissionSetObj),
          )
        })
      })
    })

    describe('deploy (pre + on)', () => {
      const filter = filterCreator({
        config: defaultFilterContext,
      }) as FilterWith<'preDeploy' | 'onDeploy'>
      let beforePermissionSetObj: ObjectType
      let afterPermissionSetObj: ObjectType
      let beforeInstances: InstanceElement[]
      let afterInstances: InstanceElement[]
      let changes: Change[]

      const generatePermissionSetInstances = (
        objType: ObjectType,
      ): InstanceElement[] => [
        new InstanceElement('profile1', objType, {
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
        }),
        new InstanceElement('profile2', objType, {
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
        }),
      ]

      beforeAll(async () => {
        beforePermissionSetObj = generatePermissionSetType(true)
        beforeInstances = generatePermissionSetInstances(beforePermissionSetObj)
        afterPermissionSetObj = generatePermissionSetType(true)
        afterInstances = generatePermissionSetInstances(afterPermissionSetObj)
        changes = beforeInstances.map((inst, idx) =>
          toChange({ before: inst, after: afterInstances[idx] }),
        )
        await filter.preDeploy(changes)
      })
      it('should convert the object back to list on preDeploy', () => {
        expect(afterPermissionSetObj).toEqual(
          generatePermissionSetType(false, true),
        )
      })

      it('should convert the instances back to lists on preDeploy', () => {
        expect(
          Array.isArray(afterInstances[0].value.applicationVisibilities),
        ).toBeTruthy()
        expect(
          Array.isArray(afterInstances[0].value.fieldPermissions),
        ).toBeTruthy()
        expect(
          Array.isArray(beforeInstances[0].value.applicationVisibilities),
        ).toBeTruthy()
        expect(
          Array.isArray(beforeInstances[0].value.fieldPermissions),
        ).toBeTruthy()
      })

      it('should return object and instances to their original form', async () => {
        await filter.onDeploy(changes)
        expect(beforePermissionSetObj).toEqual(generatePermissionSetType(true))
        expect(afterPermissionSetObj).toEqual(generatePermissionSetType(true))
        expect(beforeInstances).toEqual(
          generatePermissionSetInstances(beforePermissionSetObj),
        )
        expect(afterInstances).toEqual(
          generatePermissionSetInstances(afterPermissionSetObj),
        )
      })
    })
  })

  describe('Convert inner field to map', () => {
    let elements: Element[]
    type FilterType = FilterWith<'onFetch' | 'preDeploy'>
    let filter: FilterType
    beforeAll(async () => {
      const lwc = createInstanceElement(
        {
          fullName: 'lwc',
          lwcResources: {
            lwcResource: [
              { filePath: 'lwc/dir/lwc.js', source: 'lwc.ts' },
              { filePath: 'lwc/dir/__mocks__/lwc.js', source: 'lwc.ts' },
            ],
          },
        },
        mockTypes.LightningComponentBundle,
      )
      const lwcType = mockTypes.LightningComponentBundle
      elements = [lwc, lwcType]

      filter = filterCreator({
        config: { ...defaultFilterContext },
      }) as FilterType
      await filter.onFetch(elements)
    })
    describe('on fetch', () => {
      it('should convert lwcresource inner field to map ', async () => {
        const lwc = elements[0] as InstanceElement
        const fieldType = await lwc.getType()
        const lwcResourcesType = await fieldType.fields.lwcResources.getType()
        if (isObjectType(lwcResourcesType)) {
          const lwcResourceType =
            await lwcResourcesType.fields.lwcResource.getType()
          expect(isMapType(lwcResourceType)).toBeTruthy()
        }
      })
      it('should use the custom mapper to create the key', async () => {
        const lwc = elements[0] as InstanceElement
        expect(Object.keys(lwc.value.lwcResources.lwcResource)[0]).toEqual(
          'lwc_js@v',
        )
        expect(Object.keys(lwc.value.lwcResources.lwcResource)[1]).toEqual(
          '__mocks___lwc_js@uuuudv',
        )
      })
    })
  })
  describe('Convert ObjectType, even without instances', () => {
    let elements: Element[]
    type FilterType = FilterWith<'onFetch'>
    let filter: FilterType
    beforeAll(async () => {
      const emailTemplateType = mockTypes.EmailTemplate

      elements = [emailTemplateType]

      filter = filterCreator({
        config: { ...defaultFilterContext },
      }) as FilterType
      await filter.onFetch(elements)
    })
    describe('on fetch', () => {
      it('should convert field type to map ', async () => {
        const emailTemplateType = elements[0] as ObjectType
        const attachmentsType =
          await emailTemplateType.fields.attachments.getType()
        expect(isMapType(attachmentsType)).toBeTruthy()
      })
    })
  })
})
