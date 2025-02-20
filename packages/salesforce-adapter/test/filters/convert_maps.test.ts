/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  PrimitiveType,
  TypeReference,
  ReferenceExpression,
  getChangeData,
} from '@salto-io/adapter-api'
import { resolveChangeElement } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/convert_maps'
import { generateProfileType, generatePermissionSetType, defaultFilterContext, createCustomObjectType } from '../utils'
import { createInstanceElement, Types } from '../../src/transformers/transformer'
import { mockTypes } from '../mock_elements'
import { FilterWith } from './mocks'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { FIELD_ANNOTATIONS, ORDERED_MAP_PREFIX } from '../../src/constants'
import { getLookUpName, salesforceAdapterResolveValues } from '../../src/transformers/reference_mapping'
import { isOrderedMapTypeOrRefType } from '../../src/filters/utils'

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
    applicationVisibilities: applications.map(application => ({
      application,
      default: true,
      visible: false,
    })),
    layoutAssignments,
    fieldPermissions: fields.map(field => ({
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
    applicationVisibilities: applications.map(application => ({
      application,
      default: true,
      visible: false,
    })),
    fieldPermissions: fields.map(field => ({
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
                layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                recordType: 'something',
              },
              {
                layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                recordType: 'repetition',
              },
              {
                layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
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
          const fieldType = await profileObj.fields.applicationVisibilities.getType()
          expect(isMapType(fieldType)).toBeTruthy()
          expect(isListType((fieldType as MapType).getInnerType())).toBeFalsy()
        })
        it('should mark the fields that are used for keys as _required=true', async () => {
          expect(profileObj).toEqual(generateProfileType(true))
          const fieldType = await profileObj.fields.applicationVisibilities.getType()
          expect(isMapType(fieldType)).toBeTruthy()
          expect(isListType((fieldType as MapType).getInnerType())).toBeFalsy()
        })
        it('should convert instance values to maps', () => {
          expect(instances[0].value).toEqual({
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
              'Account_random_characters__3B_2E_2B_3F_22aaa_27__2B__bbb@bssppppppupbs': [
                {
                  layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'something',
                },
                {
                  layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'repetition',
                },
                {
                  layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
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
          const changes = instances.map((inst, idx) => toChange({ before: inst, after: afterInstances[idx] }))
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
                  layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'something',
                },
                {
                  layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'repetition',
                },
                {
                  layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'repetition',
                },
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

        it('should convert all fields with duplicates into (maps of) lists', async () => {
          const fieldType = await profileObj.fields.applicationVisibilities.getType()
          expect(isMapType(fieldType)).toBeTruthy()
          expect(isListType(await (fieldType as MapType).getInnerType())).toBeTruthy()
          expect(Array.isArray(instances[1].value.applicationVisibilities.sameApp)).toBeTruthy()
          expect(Array.isArray(instances[0].value.applicationVisibilities.app1)).toBeTruthy()
          expect(Array.isArray(instances[1].value.fieldPermissions.Account.AccountNumber)).toBeTruthy()
          expect(Array.isArray(instances[0].value.fieldPermissions.Contact.HasOptedOutOfEmail)).toBeTruthy()
        })

        it('should not fail even if there are unexpected API_NAME_SEPARATORs in the indexed value', () => {
          const inst = instances[1]
          expect(inst.value.layoutAssignments).toEqual({
            'Account_Account_Layout@bs': [{ layout: 'Account-Account Layout' }],
            too: [
              { layout: 'too.many.separators', recordType: 'something' },
              { layout: 'too.many.wrongIndexing', recordType: 'something' },
            ],
          })
        })
      })

      describe('with invalid values', () => {
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
                layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                recordType: 'something',
              },
              {
                layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                recordType: 'repetition',
              },
              {
                layout: 12 as unknown as string,
                recordType: 'repetition',
              },
              {
                layout: undefined as unknown as string,
                recordType: 'repetition',
              },
              {
                layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
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

        it('should convert instance values to maps while dropping invalid keys', () => {
          expect(instances[0].value).toEqual({
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
              'Account_random_characters__3B_2E_2B_3F_22aaa_27__2B__bbb@bssppppppupbs': [
                {
                  layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'something',
                },
                {
                  layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'repetition',
                },
                {
                  layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'repetition',
                },
              ],
            },
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
            'Account_random_characters__3B_2E_2B_3F_22aaa_27__2B__bbb@bssppppppupbs': [
              {
                layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                recordType: 'something',
              },
              {
                layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                recordType: 'repetition',
              },
              {
                layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
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
        changes = beforeInstances.map((inst, idx) => toChange({ before: inst, after: afterInstances[idx] }))
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
  })
  describe('Permission Set Maps filter', () => {
    describe('on fetch', () => {
      const filter = filterCreator({
        config: { ...defaultFilterContext },
      }) as FilterWith<'onFetch' | 'preDeploy'>
      let permissionSetObj: ObjectType
      let instances: InstanceElement[]

      describe('with regular instances', () => {
        const generatePermissionSetInstances = (objType: ObjectType): InstanceElement[] => [
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
          const fieldType = await permissionSetObj.fields.applicationVisibilities.getType()
          expect(isMapType(fieldType)).toBeTruthy()
          expect(isListType((fieldType as MapType).getInnerType())).toBeFalsy()
        })
        it('should mark the fields that are used for keys as _required=true', async () => {
          expect(permissionSetObj).toEqual(generatePermissionSetType(true))
          const fieldType = await permissionSetObj.fields.applicationVisibilities.getType()
          expect(isMapType(fieldType)).toBeTruthy()
          expect(isListType((fieldType as MapType).getInnerType())).toBeFalsy()
        })
        it('should convert instance values to maps', () => {
          expect(instances[0].value).toEqual({
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
          const afterInstances = generatePermissionSetInstances(afterPermissionSetObj)
          await filter.onFetch([afterPermissionSetObj, ...afterInstances])
          const changes = instances.map((inst, idx) => toChange({ before: inst, after: afterInstances[idx] }))
          await filter.preDeploy(changes)
          expect(afterPermissionSetObj).toEqual(generatePermissionSetType(false, true))
          expect(permissionSetObj).toEqual(generatePermissionSetType(true))
          expect(afterInstances).toEqual(generatePermissionSetInstances(afterPermissionSetObj))
          expect(instances).toEqual(generatePermissionSetInstances(permissionSetObj))
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

      const generatePermissionSetInstances = (objType: ObjectType): InstanceElement[] => [
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
        changes = beforeInstances.map((inst, idx) => toChange({ before: inst, after: afterInstances[idx] }))
        await filter.preDeploy(changes)
      })
      it('should convert the object back to list on preDeploy', () => {
        expect(afterPermissionSetObj).toEqual(generatePermissionSetType(false, true))
      })

      it('should convert the instances back to lists on preDeploy', () => {
        expect(Array.isArray(afterInstances[0].value.applicationVisibilities)).toBeTruthy()
        expect(Array.isArray(afterInstances[0].value.fieldPermissions)).toBeTruthy()
        expect(Array.isArray(beforeInstances[0].value.applicationVisibilities)).toBeTruthy()
        expect(Array.isArray(beforeInstances[0].value.fieldPermissions)).toBeTruthy()
      })

      it('should return object and instances to their original form', async () => {
        await filter.onDeploy(changes)
        expect(beforePermissionSetObj).toEqual(generatePermissionSetType(true))
        expect(afterPermissionSetObj).toEqual(generatePermissionSetType(true))
        expect(beforeInstances).toEqual(generatePermissionSetInstances(beforePermissionSetObj))
        expect(afterInstances).toEqual(generatePermissionSetInstances(afterPermissionSetObj))
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
        const attachmentsType = await emailTemplateType.fields.attachments.getType()
        expect(isMapType(attachmentsType)).toBeTruthy()
      })
    })
  })

  describe('Maintain order', () => {
    const gvsType = mockTypes.GlobalValueSet
    const gvs = new InstanceElement('MyGVS', gvsType, {
      customValue: [
        { fullName: 'val1', default: true, label: 'value1' },
        { fullName: 'val2', default: false, label: 'value2' },
      ],
    })
    let elements: Element[]
    type FilterType = FilterWith<'onFetch'>
    let filter: FilterType
    beforeAll(async () => {
      elements = [gvs, gvsType]
      filter = filterCreator({
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({ fetchParams: { optionalFeatures: { picklistsAsMaps: true } } }),
        },
      }) as FilterType
      await filter.onFetch(elements)
    })

    it('should convert field type to ordered map', async () => {
      const fieldType = await gvsType.fields.customValue.getType()
      expect(fieldType.elemID.typeName).toEqual(`${ORDERED_MAP_PREFIX}CustomValue`)
    })

    describe('when fetch is partial', () => {
      it('should create correct OrderedMap types', async () => {
        await filter.onFetch([gvsType])
        expect(gvsType.fields.customValue.getTypeSync().elemID.name).toEqual(`${ORDERED_MAP_PREFIX}CustomValue`)
      })
    })

    it('should convert instance value to map ', () => {
      expect(gvs.value.customValue.values).toBeDefined()
      expect(gvs.value.customValue.values).toEqual({
        val1: { fullName: 'val1', default: true, label: 'value1' },
        val2: { fullName: 'val2', default: false, label: 'value2' },
      })
    })
  })

  describe('Convert CustomObject field annotations by type', () => {
    let picklistType: PrimitiveType
    let multiselectPicklistType: PrimitiveType
    let myCustomObj: ObjectType
    let elements: Element[]
    type FilterType = FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
    let filter: FilterType
    let mappedReference: ReferenceExpression
    beforeEach(async () => {
      // Clone the types to avoid changing the original types and affecting other tests.
      picklistType = Types.primitiveDataTypes.Picklist.clone()
      multiselectPicklistType = Types.primitiveDataTypes.MultiselectPicklist.clone()
      const referencedInstance = createInstanceElement({ fullName: 'val1' }, mockTypes.ApexClass)
      mappedReference = new ReferenceExpression(referencedInstance.elemID, referencedInstance)
      myCustomObj = createCustomObjectType('MyCustomObj', {
        fields: {
          myPicklist: {
            refType: picklistType,
            annotations: {
              [FIELD_ANNOTATIONS.VALUE_SET]: [
                { fullName: mappedReference, default: true, label: 'value1' },
                { fullName: 'val2', default: false, label: 'value2' },
              ],
            },
          },
          myMultiselectPicklist: {
            refType: multiselectPicklistType,
            annotations: {
              [FIELD_ANNOTATIONS.VALUE_SET]: [
                { fullName: 'val1', default: true, label: 'value1' },
                { fullName: 'val2', default: false, label: 'value2' },
              ],
            },
          },
        },
      })

      elements = [myCustomObj, picklistType, multiselectPicklistType]
      filter = filterCreator({
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({ fetchParams: { optionalFeatures: { picklistsAsMaps: true } } }),
        },
      }) as FilterType
    })

    describe('onFetch', () => {
      beforeEach(async () => {
        await filter.onFetch(elements)
      })

      it('should convert Picklist valueSet type to ordered map', async () => {
        expect(myCustomObj.fields.myPicklist.getTypeSync()).toEqual(picklistType)
        const valueSetType = picklistType.annotationRefTypes.valueSet as TypeReference<ObjectType>
        expect(valueSetType.elemID.typeName).toEqual(`${ORDERED_MAP_PREFIX}valueSet`)
        expect(valueSetType.type?.fields.values.refType.elemID.typeName).toEqual('Map<salesforce.valueSet>')
        expect(valueSetType.type?.fields.order.refType.elemID.typeName).toEqual('List<salesforce.valueSet>')
        expect(picklistType.annotationRefTypes.valueSet?.elemID.name).toEqual(`${ORDERED_MAP_PREFIX}valueSet`)
        expect(
          elements
            .filter(isObjectType)
            .filter(isOrderedMapTypeOrRefType)
            .map(orderedMapType => orderedMapType.elemID.name),
        ).toEqual([`${ORDERED_MAP_PREFIX}valueSet`])
      })

      it('should convert MultiselectPicklist valueSet type to ordered map', async () => {
        expect(myCustomObj.fields.myMultiselectPicklist.getTypeSync()).toEqual(multiselectPicklistType)
        const valueSetType = multiselectPicklistType.annotationRefTypes.valueSet as TypeReference<ObjectType>
        expect(valueSetType.elemID.typeName).toEqual(`${ORDERED_MAP_PREFIX}valueSet`)
        expect(valueSetType.type?.fields.values.refType.elemID.typeName).toEqual('Map<salesforce.valueSet>')
        expect(valueSetType.type?.fields.order.refType.elemID.typeName).toEqual('List<salesforce.valueSet>')
        expect(multiselectPicklistType.annotationRefTypes.valueSet?.elemID.name).toEqual(
          `${ORDERED_MAP_PREFIX}valueSet`,
        )
        expect(
          elements
            .filter(isObjectType)
            .filter(isOrderedMapTypeOrRefType)
            .map(orderedMapType => orderedMapType.elemID.name),
        ).toEqual([`${ORDERED_MAP_PREFIX}valueSet`])
      })

      it('should convert annotation value to map (Picklist)', () => {
        expect(myCustomObj.fields.myPicklist.annotations.valueSet.values).toBeDefined()
        expect(myCustomObj.fields.myPicklist.annotations.valueSet.values).toEqual({
          val1: { fullName: mappedReference, default: true, label: 'value1' },
          val2: { fullName: 'val2', default: false, label: 'value2' },
        })
      })

      it('should convert annotation value to map (MultiselectPicklist)', () => {
        expect(myCustomObj.fields.myMultiselectPicklist.annotations.valueSet.values).toBeDefined()
        expect(myCustomObj.fields.myMultiselectPicklist.annotations.valueSet.values).toEqual({
          val1: { fullName: 'val1', default: true, label: 'value1' },
          val2: { fullName: 'val2', default: false, label: 'value2' },
        })
      })
      describe('when fetch is partial', () => {
        it('should create correct OrderedMap types', async () => {
          await filter.onFetch([picklistType])
          expect(picklistType.annotationRefTypes?.[FIELD_ANNOTATIONS.VALUE_SET]?.elemID.name).toEqual(
            `${ORDERED_MAP_PREFIX}valueSet`,
          )
        })
      })
    })

    describe('preDeploy + onDeploy', () => {
      let changes: Change[]
      beforeEach(async () => {
        // This fetch will convert the Picklist valueSet type to OrderedMap
        await filter.onFetch([myCustomObj, picklistType, multiselectPicklistType])
        const resolvedChange = await resolveChangeElement(
          toChange({ after: myCustomObj }),
          getLookUpName(buildFetchProfile({ fetchParams: {} })),
          salesforceAdapterResolveValues,
        )
        changes = [resolvedChange]
        myCustomObj = getChangeData(resolvedChange)
        await filter.preDeploy(changes)
      })

      it('should convert the object back to list on preDeploy (Picklist)', () => {
        expect(myCustomObj.fields.myPicklist.annotations.valueSet).toBeDefined()
        // The valueSet should be converted back to a list. Since we're not running reference resolution, we need to
        // peel back the reference layer first.
        expect(myCustomObj.fields.myPicklist.annotations.valueSet).toEqual([
          { fullName: 'val1', default: true, label: 'value1' },
          { fullName: 'val2', default: false, label: 'value2' },
        ])
      })

      it('should convert the object back to list on preDeploy (MultiselectPicklist)', () => {
        expect(myCustomObj.fields.myMultiselectPicklist.annotations.valueSet).toBeDefined()
        // The valueSet should be converted back to a list. Since we're not running reference resolution, we need to
        // peel back the reference layer first.
        expect(myCustomObj.fields.myMultiselectPicklist.annotations.valueSet).toEqual([
          { fullName: 'val1', default: true, label: 'value1' },
          { fullName: 'val2', default: false, label: 'value2' },
        ])
      })

      it('should convert the object back to map on onDeploy (Picklist)', async () => {
        // Simulate reference resolution.
        myCustomObj.fields.myPicklist.annotations.valueSet = [
          { fullName: 'val1', default: true, label: 'value1' },
          { fullName: 'val2', default: false, label: 'value2' },
        ]

        await filter.onDeploy(changes)
        expect(myCustomObj.fields.myPicklist.annotations.valueSet.values).toBeDefined()
        expect(myCustomObj.fields.myPicklist.annotations.valueSet.values).toEqual({
          val1: { fullName: 'val1', default: true, label: 'value1' },
          val2: { fullName: 'val2', default: false, label: 'value2' },
        })
      })
    })
  })
})
