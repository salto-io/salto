import {
  ObjectType, ElemID, Field, BuiltinTypes, Type,
} from 'adapter-api'
import filterCreator from '../../src/filters/flow'
import { SALESFORCE } from '../../src/constants'

describe('flow filter', () => {
  const filter = filterCreator()
  const elemID = new ElemID(SALESFORCE, 'flow_metadata_value')
  const mockFlow = new ObjectType({
    elemID,
    fields: {
      name: new Field(elemID, 'name', BuiltinTypes.STRING,
        {
          [Type.VALUES]: ['ObjectType', 'TriggerType', 'ObjectVariable', 'OldObjectVariable',
            'RecursiveCountVariable', 'EventType'],
        }),
    },
  })

  it('remove restriction values from flow_metadata_value.name', () => {
    filter.onDiscover([mockFlow])
    expect(mockFlow.fields.name.annotations[Type.VALUES]).toBeUndefined()
  })
})
