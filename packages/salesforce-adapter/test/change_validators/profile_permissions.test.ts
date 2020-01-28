import { BuiltinTypes, ElemID, Field, ObjectType, CORE_ANNOTATIONS } from 'adapter-api'
import profilePermissionsValidator from '../../src/change_validators/profile_permissions'
import { API_NAME, FIELD_LEVEL_SECURITY_ANNOTATION, FIELD_LEVEL_SECURITY_FIELDS } from '../../src/constants'

describe('profile permissions change validator', () => {
  const obj = new ObjectType({
    elemID: new ElemID('salesforce', 'obj'),
  })

  describe('onUpdate', () => {
    const field = new Field(obj.elemID, 'field', BuiltinTypes.STRING,
      {
        [API_NAME]: 'MyNamespace__FieldName__c',
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [FIELD_LEVEL_SECURITY_ANNOTATION]: {
          [FIELD_LEVEL_SECURITY_FIELDS.EDITABLE]: ['Admin'],
          [FIELD_LEVEL_SECURITY_FIELDS.READABLE]: ['Admin'],
        },
      })
    let newField: Field

    describe('update field to be required', () => {
      beforeEach(() => {
        newField = field.clone()
        newField.annotations[CORE_ANNOTATIONS.REQUIRED] = true
      })
      it('should have change error when updating a field to be required with permissions', async () => {
        const changeErrors = await profilePermissionsValidator.onUpdate([{
          action: 'modify',
          data: { before: field, after: newField },
        }])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(newField.elemID)
      })

      it('should have no change error when adding a field required field without permissions', async () => {
        delete newField.annotations[FIELD_LEVEL_SECURITY_ANNOTATION]
        const changeErrors = await profilePermissionsValidator.onUpdate([{
          action: 'modify',
          data: { before: field, after: newField },
        }])
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('update a non required field', () => {
      beforeEach(() => {
        newField = field.clone()
      })

      it('should have no change error when updating a field to be non required with permissions', async () => {
        newField.annotations[FIELD_LEVEL_SECURITY_ANNOTATION][FIELD_LEVEL_SECURITY_FIELDS.EDITABLE].push('Standard')
        newField.annotations[FIELD_LEVEL_SECURITY_ANNOTATION][FIELD_LEVEL_SECURITY_FIELDS.READABLE].push('Standard')
        const changeErrors = await profilePermissionsValidator.onUpdate([{
          action: 'modify',
          data: { before: field, after: newField },
        }])
        expect(changeErrors).toHaveLength(0)
      })

      it('should have no change error when updating a field to be non required without permissions', async () => {
        delete newField.annotations[FIELD_LEVEL_SECURITY_ANNOTATION]
        const changeErrors = await profilePermissionsValidator.onUpdate([{
          action: 'modify',
          data: { before: field, after: newField },
        }])
        expect(changeErrors).toHaveLength(0)
      })
    })
  })
})
