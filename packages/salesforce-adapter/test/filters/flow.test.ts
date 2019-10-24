import {
  ObjectType, ElemID, Field, BuiltinTypes, Type,
} from 'adapter-api'
import filterCreator from '../../src/filters/flow'
import { SALESFORCE } from '../../src/constants'

describe('flow filter', () => {
  const filter = filterCreator()
  const elemID = new ElemID(SALESFORCE, 'flow_metadata_value')
  const values = ['ObjectType', 'TriggerType', 'ObjectVariable', 'OldObjectVariable',
    'RecursiveCountVariable', 'EventType']
  const mockFlow = new ObjectType({
    elemID,
    fields: {
      name: new Field(elemID, 'name', BuiltinTypes.STRING,
        {
          [Type.VALUES]: values,
        }),
    },
  })

  it('remove restriction values from flow_metadata_value.name', () => {
    filter.onDiscover([mockFlow])
    expect(mockFlow.fields.name.annotations[Type.VALUES]).toEqual(values)
    expect(mockFlow.fields.name.annotations[Type.RESTRICTION][Type.ENFORCE_VALUE]).toBe(false)
  })
})
