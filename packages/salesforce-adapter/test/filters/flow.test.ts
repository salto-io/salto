import {
  ObjectType, ElemID, Field, BuiltinTypes, CORE_ANNOTATIONS,
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
          [CORE_ANNOTATIONS.VALUES]: values,
        }),
    },
  })

  it('remove restriction values from flow_metadata_value.name', () => {
    filter.onFetch([mockFlow])
    expect(mockFlow.fields.name.annotations[CORE_ANNOTATIONS.VALUES]).toEqual(values)
    expect(mockFlow.fields.name
      .annotations[CORE_ANNOTATIONS.RESTRICTION][CORE_ANNOTATIONS.ENFORCE_VALUE]).toBe(false)
  })
})
