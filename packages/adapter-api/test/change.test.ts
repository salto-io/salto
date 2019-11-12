import {
  ObjectType, ElemID, BuiltinTypes, Field, InstanceElement,
} from '../src/elements'
import { getChangeElement } from '../src/change'

describe('change.ts', () => {
  const objElemID = new ElemID('adapter', 'type')
  const obj = new ObjectType({
    elemID: objElemID,
    fields: {
      field: new Field(objElemID, 'field', BuiltinTypes.STRING),
    },
  })
  const inst = new InstanceElement('inst', obj, { field: 'val' })

  it('should getChangeElement for removal change', () => {
    const elem = getChangeElement({
      action: 'remove',
      data: { before: obj },
    })
    expect(elem).toBe(obj)
  })

  it('should getChangeElement for add change', () => {
    const elem = getChangeElement({
      action: 'add',
      data: { after: inst },
    })
    expect(elem).toBe(inst)
  })

  it('should getChangeElement for modification change', () => {
    const { field } = obj.fields
    const elem = getChangeElement({
      action: 'modify',
      data: { before: field, after: field },
    })
    expect(elem).toBe(field)
  })
})
