/*
*                      Copyright 2020 Salto Labs Ltd.
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
import _ from 'lodash'
import {
  ElemID, InstanceElement, ObjectType, ReferenceExpression, Element, BuiltinTypes, Value,
  INSTANCE_ANNOTATIONS, isInstanceElement, Field, isObjectType,
} from '@salto-io/adapter-api'
import { FilterWith } from '../../src/filter'
import filterCreator, { addReferences } from '../../src/filters/field_references'
import { fieldNameToTypeMappingDefs } from '../../src/transformers/reference_mapping'
import mockClient from '../client'
import {
  OBJECTS_PATH, SALESFORCE, CUSTOM_OBJECT, METADATA_TYPE, INSTANCE_FULL_NAME_FIELD,
  CUSTOM_OBJECT_ID_FIELD, API_NAME, API_NAME_SEPARATOR,
} from '../../src/constants'
import { metadataType, apiName } from '../../src/transformers/transformer'
import { CUSTOM_OBJECT_TYPE_ID } from '../../src/filters/custom_objects'

describe('WorklowFieldUpdate filter', () => {
  const { client } = mockClient()

  const filter = filterCreator({ client, config: {} }) as FilterWith<'onFetch'>

  const customObjectType = new ObjectType({
    elemID: CUSTOM_OBJECT_TYPE_ID,
    fields: {
      [INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.STRING },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
  })

  const generateObjectAndInstance = ({
    type,
    objType = CUSTOM_OBJECT,
    instanceName,
    fieldName,
    fieldValue,
    parentType,
  }: {
    type: string
    objType?: string
    instanceName?: string
    fieldName: string
    fieldValue?: Value
    parentType?: string
  }): Element[] => {
    const addFields = (obj: ObjectType): void => {
      const createField = (name: string, fieldType = BuiltinTypes.STRING): Field => (
        new Field(obj, name, fieldType, { [API_NAME]: [type, name].join(API_NAME_SEPARATOR) })
      )
      obj.fields = {
        [fieldName]: createField(fieldName),
        other: createField('other'),
        ignore: createField('ignore', BuiltinTypes.NUMBER),
      }
      if (objType === CUSTOM_OBJECT) {
        obj.fields[CUSTOM_OBJECT_ID_FIELD] = createField(CUSTOM_OBJECT_ID_FIELD)
      }
    }
    if (objType === CUSTOM_OBJECT || fieldValue === undefined) {
      const customObj = new ObjectType({
        elemID: new ElemID(SALESFORCE, type, 'type', type),
        annotations: {
          [METADATA_TYPE]: objType,
          [API_NAME]: type,
        },
      })
      addFields(customObj)
      return [customObj]
    }
    const obj = new ObjectType({
      elemID: new ElemID(SALESFORCE, type),
      annotations: { [METADATA_TYPE]: objType },
    })
    addFields(obj)
    const realInstanceName = instanceName || `${type}Inst`
    const instance = new InstanceElement(
      realInstanceName,
      obj,
      {
        [INSTANCE_FULL_NAME_FIELD]: parentType
          ? [parentType, realInstanceName].join(API_NAME_SEPARATOR)
          : realInstanceName,
        [fieldName]: fieldValue,
        other: fieldValue,
        ignore: 125,
      },
      [SALESFORCE, OBJECTS_PATH, ...(parentType ? [parentType] : []), realInstanceName],
      { ...(parentType
        ? { [INSTANCE_ANNOTATIONS.PARENT]: [
          new ReferenceExpression(new ElemID(SALESFORCE, parentType)),
        ] }
        : {}) },
    )
    return [obj, instance]
  }

  const generateElements = (
  ): Element[] => ([
    customObjectType,
    ...generateObjectAndInstance({
      type: 'Account',
      fieldName: 'name',
    }),

    // site1.authorizationRequiredPage should point to page1
    ...generateObjectAndInstance({
      type: 'ApexPage',
      objType: 'ApexPage',
      instanceName: 'page1',
      fieldName: 'any',
      fieldValue: 'aaa',
    }),
    ...generateObjectAndInstance({
      type: 'CustomSite',
      objType: 'CustomSite',
      instanceName: 'site1',
      fieldName: 'authorizationRequiredPage',
      fieldValue: 'page1',
    }),
    // report53.reportType should point to Account
    ...generateObjectAndInstance({
      type: 'Report',
      objType: 'Report',
      instanceName: 'report53',
      fieldName: 'reportType',
      fieldValue: 'Account',
    }),
    // filterItem643.field should point to Account.name (default strategy)
    ...generateObjectAndInstance({
      type: 'FilterItem',
      objType: 'FilterItem',
      instanceName: 'filterItem643',
      fieldName: 'field',
      fieldValue: 'Account.name',
    }),
    // fieldUpdate54.field should point to Account.name (instanceParent)
    ...generateObjectAndInstance({
      type: 'WorkflowFieldUpdate',
      objType: 'WorkflowFieldUpdate',
      instanceName: 'fieldUpdate54',
      fieldName: 'field',
      fieldValue: 'name',
      parentType: 'Account',
    }),
    // layoutItem436.field will remain the same (Account.fffff doesn't exist)
    ...generateObjectAndInstance({
      type: 'LayoutItem',
      objType: 'LayoutItem',
      instanceName: 'layoutItem436',
      fieldName: 'field',
      fieldValue: 'fffff',
      parentType: 'Account',
    }),
  ])

  describe('on fetch', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })

    it('should resolve fields with absolute value (parent.field)', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'FilterItem'
      )[0] as InstanceElement
      expect(inst.value.field).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field?.elemId.getFullName()).toEqual('salesforce.Account.field.name')
    })

    it('should resolve when field is a regular expression', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'CustomSite'
      )[0] as InstanceElement
      expect(inst.value.authorizationRequiredPage).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.authorizationRequiredPage?.elemId.getFullName()).toEqual('salesforce.ApexPage.instance.page1')
    })

    it('should resolve custom object instances', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'Report'
      )[0] as InstanceElement
      const account = elements.filter(e => isObjectType(e) && apiName(e) === 'Account')[0]
      expect(inst.value.reportType).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.reportType?.elemId.getFullName()).toEqual(account.elemID.getFullName())
    })

    it('should resolve field with relative value using instance parent', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'WorkflowFieldUpdate'
      )[0] as InstanceElement
      expect(inst.value.field).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field?.elemId.getFullName()).toEqual('salesforce.Account.field.name')
    })

    it('should not resolve if field has no rule', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'WorkflowFieldUpdate'
      )[0] as InstanceElement
      expect(inst.value.other).not.toBeInstanceOf(ReferenceExpression)
      expect(inst.value.other).toEqual('name')
    })

    it('should not resolve if referenced does not exist', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'LayoutItem'
      )[0] as InstanceElement
      expect(inst.value.field).not.toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field).toEqual('fffff')
    })
  })

  describe('on fetch with modified serialization', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      const modifiedDefs = fieldNameToTypeMappingDefs.map(def => _.omit(def, 'serializationStrategy'))
      addReferences(elements, modifiedDefs)
    })
    afterAll(() => {
      jest.clearAllMocks()
    })

    it('should resolve fields with absolute value (parent.field)', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'FilterItem'
      )[0] as InstanceElement
      expect(inst.value.field).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field?.elemId.getFullName()).toEqual('salesforce.Account.field.name')
    })

    it('should fail to resolve field with relative value (because of the modified rule)', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && metadataType(e) === 'WorkflowFieldUpdate'
      )[0] as InstanceElement
      expect(inst.value.field).not.toBeInstanceOf(ReferenceExpression)
      expect(inst.value.field).toEqual('name')
    })
  })
})
