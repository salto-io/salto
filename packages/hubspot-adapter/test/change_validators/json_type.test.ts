import { InstanceElement, ObjectType, ElemID, BuiltinTypes, CORE_ANNOTATIONS, Field } from 'adapter-api'
import jsonTypeValidator from '../../src/change_validators/json_type'

describe('json type change validator', () => {
  let instance: InstanceElement
  let object: ObjectType
  beforeEach(() => {
    object = new ObjectType({
      elemID: new ElemID('hubspot', 'obj'),
      fields: {
        f: new Field(
          new ElemID('hubspot, f'), 'f', BuiltinTypes.JSON, {
            name: 'f',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
      },
    })
    instance = new InstanceElement('instance', object, {})
  })

  describe('onAdd', () => {
    it('should fail when value is not a valid json', async () => {
      instance.value.f = '{'
      const changeErrors = await jsonTypeValidator.onAdd(instance)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })

    it('should not have errors if value is a valid json', async () => {
      instance.value.f = '{ "a": "bba" }'
      const changeErrors = await jsonTypeValidator.onAdd(instance)
      expect(changeErrors).toHaveLength(0)
    })
  })

  describe('onUpdate', () => {
    let after: InstanceElement
    beforeEach(() => {
      after = instance.clone()
    })

    it('should fail on update value with bad json', async () => {
      after.value.f = '{'
      const changeErrors = await jsonTypeValidator.onUpdate([{
        action: 'modify',
        data: { after, before: instance },
      }])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
    })

    it('should not have errors if modified value is a valid json', async () => {
      after.value.f = '{ "a": "bba" }'
      const changeErrors = await jsonTypeValidator.onUpdate([{
        action: 'modify',
        data: { after, before: instance },
      }])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
