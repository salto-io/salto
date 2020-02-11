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
import { BuiltinTypes, ElemID, Field, InstanceElement, ObjectType } from 'adapter-api'
import packageValidator, {
  INSTALLED_PACKAGE_METADATA,
  PACKAGE_VERSION_NUMBER_FIELD_NAME,
} from '../../src/change_validators/package'
import { API_NAME, INSTANCE_FULL_NAME_FIELD, METADATA_TYPE } from '../../src/constants'

describe('package change validator', () => {
  let obj: ObjectType
  let inst: InstanceElement
  beforeEach(() => {
    obj = new ObjectType({
      elemID: new ElemID('salesforce', 'obj'),
    })
    inst = new InstanceElement('inst', obj, {})
  })
  describe('onAdd', () => {
    describe('Object', () => {
      it('should have change error when adding an object with namespace', async () => {
        obj.annotate({ [API_NAME]: 'MyNamespace__ObjectName__c' })
        const changeErrors = await packageValidator.onAdd(obj)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(obj.elemID)
      })

      it('should have change error when adding an object containing field with namespace', async () => {
        obj.annotate({ [API_NAME]: 'ObjectName__c' })
        obj.fields.field = new Field(obj.elemID, 'field', BuiltinTypes.STRING,
          { [API_NAME]: `${obj.annotations[API_NAME]}.MyNamespace__FieldName__c` })
        const changeErrors = await packageValidator.onAdd(obj)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(obj.fields.field.elemID)
      })

      it('should have no change errors when adding an object without namespace', async () => {
        obj.annotate({ [API_NAME]: 'ObjectName__c' })
        const changeErrors = await packageValidator.onAdd(obj)
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change errors when adding an object without apiName', async () => {
        const changeErrors = await packageValidator.onAdd(obj)
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('Instance', () => {
      it('should have change error when adding an instance with namespace', async () => {
        inst.value[INSTANCE_FULL_NAME_FIELD] = 'MyNamespace__InstanceName__c'
        const changeErrors = await packageValidator.onAdd(inst)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(inst.elemID)
      })

      it('should have no change errors when adding an instance without namespace', async () => {
        inst.value[INSTANCE_FULL_NAME_FIELD] = 'InstanceName__c'
        const changeErrors = await packageValidator.onAdd(inst)
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change errors when adding an instance without fullName', async () => {
        const changeErrors = await packageValidator.onAdd(inst)
        expect(changeErrors).toHaveLength(0)
      })
    })
  })

  describe('onRemove', () => {
    describe('Object', () => {
      it('should have change error when removing an object with namespace', async () => {
        obj.annotate({ [API_NAME]: 'MyNamespace__ObjectName__c' })
        const changeErrors = await packageValidator.onRemove(obj)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(obj.elemID)
      })

      it('should have change error when removing an object containing field with namespace', async () => {
        obj.annotate({ [API_NAME]: 'ObjectName__c' })
        obj.fields.field = new Field(obj.elemID, 'field', BuiltinTypes.STRING,
          { [API_NAME]: `${obj.annotations[API_NAME]}.MyNamespace__FieldName__c` })
        const changeErrors = await packageValidator.onRemove(obj)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(obj.fields.field.elemID)
      })

      it('should have no change errors when removing an object without namespace', async () => {
        obj.annotate({ [API_NAME]: 'ObjectName__c' })
        const changeErrors = await packageValidator.onRemove(obj)
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change errors when removing an object without apiName', async () => {
        const changeErrors = await packageValidator.onRemove(obj)
        expect(changeErrors).toHaveLength(0)
      })
    })
    describe('Instance', () => {
      it('should have change error when removing an instance with namespace', async () => {
        inst.value[INSTANCE_FULL_NAME_FIELD] = 'MyNamespace__InstanceName__c'
        const changeErrors = await packageValidator.onRemove(inst)
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(inst.elemID)
      })

      it('should have no change errors when removing an instance without namespace', async () => {
        inst.value[INSTANCE_FULL_NAME_FIELD] = 'InstanceName__c'
        const changeErrors = await packageValidator.onRemove(inst)
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change errors when removing an instance without fullName', async () => {
        const changeErrors = await packageValidator.onRemove(inst)
        expect(changeErrors).toHaveLength(0)
      })
    })
  })

  describe('onUpdate', () => {
    describe('add field', () => {
      it('should have change error when adding a field with namespace to an object', async () => {
        const newField = new Field(obj.elemID, 'field', BuiltinTypes.STRING,
          { [API_NAME]: 'ObjectName__c.MyNamespace__FieldName__c' })
        const changeErrors = await packageValidator.onUpdate([{
          action: 'add',
          data: { after: newField },
        }])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(newField.elemID)
      })

      it('should have no change error when adding a field without namespace to an object', async () => {
        const newField = new Field(obj.elemID, 'field', BuiltinTypes.STRING,
          { [API_NAME]: 'ObjectName__c.FieldName__c' })
        const changeErrors = await packageValidator.onUpdate([{
          action: 'add',
          data: { after: newField },
        }])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change error when adding a field without namespace to a packaged object', async () => {
        const newField = new Field(obj.elemID, 'field', BuiltinTypes.STRING,
          { [API_NAME]: 'MyNamespace__ObjectName__c.FieldName' })
        const changeErrors = await packageValidator.onUpdate([{
          action: 'add',
          data: { after: newField },
        }])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change error when adding a field without apiName to an object', async () => {
        const newField = new Field(obj.elemID, 'field', BuiltinTypes.STRING, {})
        const changeErrors = await packageValidator.onUpdate([{
          action: 'add',
          data: { after: newField },
        }])
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('remove field', () => {
      it('should have change error when removing a field with namespace from an object', async () => {
        const oldField = new Field(obj.elemID, 'field', BuiltinTypes.STRING,
          { [API_NAME]: 'ObjectName__c.MyNamespace__FieldName__c' })
        const changeErrors = await packageValidator.onUpdate([{
          action: 'remove',
          data: { before: oldField },
        }])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(oldField.elemID)
      })

      it('should have no change error when removing a field without namespace from an object', async () => {
        const oldField = new Field(obj.elemID, 'field', BuiltinTypes.STRING,
          { [API_NAME]: 'ObjectName__c.FieldName__c' })
        const changeErrors = await packageValidator.onUpdate([{
          action: 'remove',
          data: { before: oldField },
        }])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change error when removing a custom field from a packaged object', async () => {
        const oldField = new Field(obj.elemID, 'field', BuiltinTypes.STRING,
          { [API_NAME]: 'MyNamespace__ObjectName__c.FieldName' })
        const changeErrors = await packageValidator.onUpdate([{
          action: 'remove',
          data: { before: oldField },
        }])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change error when removing a field without apiName from an object', async () => {
        const oldField = new Field(obj.elemID, 'field', BuiltinTypes.STRING, {})
        const changeErrors = await packageValidator.onUpdate([{
          action: 'remove',
          data: { before: oldField },
        }])
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('installed package instance modification', () => {
      it('should have change error when modifying an InstalledPackage instance version', async () => {
        obj.annotate({ [METADATA_TYPE]: INSTALLED_PACKAGE_METADATA })
        inst.value[INSTANCE_FULL_NAME_FIELD] = 'MyNamespace__InstanceName__c'
        inst.value[PACKAGE_VERSION_NUMBER_FIELD_NAME] = '1.0'
        const afterInst = inst.clone()
        afterInst.value[PACKAGE_VERSION_NUMBER_FIELD_NAME] = '1.1'
        const changeErrors = await packageValidator.onUpdate([{
          action: 'modify',
          data: { before: inst, after: afterInst },
        }])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(afterInst.elemID)
      })
    })
  })
})
