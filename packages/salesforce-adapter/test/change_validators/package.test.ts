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
import { BuiltinTypes, ElemID, Field, InstanceElement, ObjectType, toChange, createRefToElmWithValue } from '@salto-io/adapter-api'
import packageValidator, {
  PACKAGE_VERSION_FIELD_NAME,
} from '../../src/change_validators/package'
import {
  API_NAME,
  CUSTOM_OBJECT, INSTALLED_PACKAGE_METADATA,
  INSTANCE_FULL_NAME_FIELD,
  METADATA_TYPE,
  OBJECTS_PATH,
  SALESFORCE,
} from '../../src/constants'
import { Types } from '../../src/transformers/transformer'
import { createField } from '../utils'

describe('package change validator', () => {
  let obj: ObjectType
  let inst: InstanceElement
  beforeEach(() => {
    obj = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'obj'),
      path: [SALESFORCE, OBJECTS_PATH, 'obj'],
    })
    inst = new InstanceElement('inst', obj, {})
  })
  const addField = (apiName?: string): Field => {
    const newField = new Field(
      obj, 'field', BuiltinTypes.STRING, apiName === undefined ? {} : { [API_NAME]: apiName },
    )
    obj.fields.field = newField
    return newField
  }
  describe('onAdd', () => {
    describe('Object', () => {
      it('should have no change errors when adding an object without namespace with __e suffix', async () => {
        obj.annotate({ [API_NAME]: 'TestEvent2__e' })
        const changeErrors = await packageValidator([toChange({ after: obj })])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have change error when adding a custom object with namespace', async () => {
        obj.annotate({
          [API_NAME]: 'MyNamespace__ObjectName__c',
          [METADATA_TYPE]: CUSTOM_OBJECT,
        })
        const changeErrors = await packageValidator([toChange({ after: obj })])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(obj.elemID)
      })

      it('should have no change errors when adding an object with namespace', async () => {
        obj.annotate({ [API_NAME]: 'MyNamespace__ObjectName__c' })
        const changeErrors = await packageValidator([toChange({ after: obj })])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have change error when adding an object containing field with namespace', async () => {
        obj.annotate({ [API_NAME]: 'ObjectName__c' })
        addField(`${obj.annotations[API_NAME]}.MyNamespace__FieldName__c`)
        const changeErrors = await packageValidator(
          [{ after: obj }, { after: obj.fields.field }].map(toChange)
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(obj.fields.field.elemID)
      })

      it('should have no change errors when adding an object without namespace', async () => {
        obj.annotate({ [API_NAME]: 'ObjectName__c' })
        const changeErrors = await packageValidator([toChange({ after: obj })])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change errors when adding an object without apiName', async () => {
        const changeErrors = await packageValidator([toChange({ after: obj })])
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('Instance', () => {
      it('should not have change errors when adding an instance with namespace', async () => {
        inst.value[INSTANCE_FULL_NAME_FIELD] = 'MyNamespace__InstanceName__c'
        const changeErrors = await packageValidator([toChange({ after: inst })])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change errors when adding an instance without namespace', async () => {
        inst.value[INSTANCE_FULL_NAME_FIELD] = 'InstanceName__c'
        const changeErrors = await packageValidator([toChange({ after: inst })])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change errors when adding an instance without fullName', async () => {
        const changeErrors = await packageValidator([toChange({ after: inst })])
        expect(changeErrors).toHaveLength(0)
      })
    })
  })

  describe('onRemove', () => {
    describe('Object', () => {
      it('should have no change errors when removing an object with namespace', async () => {
        obj.annotate({ [API_NAME]: 'MyNamespace__ObjectName__c' })
        const changeErrors = await packageValidator([toChange({ before: obj })])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have change error when removing an object with namespace', async () => {
        obj.annotate({
          [API_NAME]: 'MyNamespace__ObjectName__c',
          [METADATA_TYPE]: CUSTOM_OBJECT,
        })
        const changeErrors = await packageValidator([toChange({ before: obj })])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(obj.elemID)
      })

      it('should have change error when removing an object containing field with namespace', async () => {
        obj.annotate({ [API_NAME]: 'ObjectName__c' })
        addField(`${obj.annotations[API_NAME]}.MyNamespace__FieldName__c`)
        const changeErrors = await packageValidator(
          [{ before: obj }, { before: obj.fields.field }].map(toChange)
        )
        expect(changeErrors).toHaveLength(2)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(obj.fields.field.elemID)
        expect(changeErrors[1].severity).toEqual('Error')
        expect(changeErrors[1].elemID).toEqual(obj.elemID)
      })

      it('should have no change errors when removing an object without namespace', async () => {
        obj.annotate({ [API_NAME]: 'ObjectName__c' })
        const changeErrors = await packageValidator([toChange({ before: obj })])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change errors when removing an object without apiName', async () => {
        const changeErrors = await packageValidator([toChange({ before: obj })])
        expect(changeErrors).toHaveLength(0)
      })
    })

    it('should have no change errors when removing an instance with namespace', async () => {
      inst.value[INSTANCE_FULL_NAME_FIELD] = 'MyNamespace__InstanceName__c'
      const changeErrors = await packageValidator([toChange({ before: inst })])
      expect(changeErrors).toHaveLength(0)
    })
  })

  describe('onUpdate', () => {
    describe('modify field with namespace', () => {
      describe('when modifying a forbidden property', () => {
        it('should have change error', async () => {
          obj.annotate({ [API_NAME]: 'ObjectName__c' })
          const beforeField = createField(obj, Types.primitiveDataTypes.Lookup, `${obj.annotations[API_NAME]}.MyNamespace__FieldName__c`)
          const afterField = beforeField.clone()
          afterField.annotations.modifyMe = 'modified'
          afterField.refType = createRefToElmWithValue(Types.primitiveDataTypes.MasterDetail)
          const changeErrors = await packageValidator(
            [toChange({ before: beforeField, after: afterField })]
          )
          expect(changeErrors).toHaveLength(1)
          expect(changeErrors[0].severity).toEqual('Error')
          expect(changeErrors[0].elemID).toEqual(beforeField.elemID)
        })
      })

      describe('when modifying an allowed property', () => {
        it('should not have change error', async () => {
          obj.annotate({ [API_NAME]: 'ObjectName__c' })
          const beforeField = createField(obj, Types.primitiveDataTypes.Lookup, `${obj.annotations[API_NAME]}.MyNamespace__FieldName__c`, { inlineHelpText: 'inlineHelpText' })
          const afterField = beforeField.clone()
          afterField.annotations.inlineHelpText = 'modified'
          const changeErrors = await packageValidator(
            [toChange({ before: beforeField, after: afterField })]
          )
          expect(changeErrors).toBeEmpty()
        })
      })
    })
    describe('add field', () => {
      it('should have change error when adding a field with namespace to an object', async () => {
        const newField = addField('ObjectName__c.MyNamespace__FieldName__c')
        const changeErrors = await packageValidator([toChange({ after: newField })])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(newField.elemID)
      })

      it('should have no change error when adding a field without namespace to an object', async () => {
        const newField = addField('ObjectName__c.FieldName__c')
        const changeErrors = await packageValidator([toChange({ after: newField })])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change error when adding a field without namespace to a packaged object', async () => {
        const newField = addField('MyNamespace__ObjectName__c.FieldName')
        const changeErrors = await packageValidator([toChange({ after: newField })])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change error when adding a field without apiName to an object', async () => {
        const newField = addField()
        const changeErrors = await packageValidator([toChange({ after: newField })])
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('remove field', () => {
      it('should have change error when removing a field with namespace from an object', async () => {
        const oldField = addField('ObjectName__c.MyNamespace__FieldName__c')
        const changeErrors = await packageValidator([toChange({ before: oldField })])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(oldField.elemID)
      })

      it('should have no change error when removing a field without namespace from an object', async () => {
        const oldField = addField('ObjectName__c.FieldName__c')
        const changeErrors = await packageValidator([toChange({ before: oldField })])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change error when removing a custom field from a packaged object', async () => {
        const oldField = addField('MyNamespace__ObjectName__c.FieldName')
        const changeErrors = await packageValidator([toChange({ before: oldField })])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change error when removing a field without apiName from an object', async () => {
        const oldField = addField()
        const changeErrors = await packageValidator([toChange({ before: oldField })])
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('installed package instance modification', () => {
      it('should have change error when modifying an InstalledPackage instance version', async () => {
        obj.annotate({ [METADATA_TYPE]: INSTALLED_PACKAGE_METADATA })
        inst.value[INSTANCE_FULL_NAME_FIELD] = 'MyNamespace__InstanceName__c'
        inst.value[PACKAGE_VERSION_FIELD_NAME] = '1.0'
        const after = inst.clone()
        after.value[PACKAGE_VERSION_FIELD_NAME] = '1.1'
        const changeErrors = await packageValidator([toChange({ before: inst, after })])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(after.elemID)
      })
    })
  })
})
