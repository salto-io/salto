import {
  ObjectType, Field, BuiltinTypes, CORE_ANNOTATIONS, RESTRICTION_ANNOTATIONS,
} from 'adapter-api'
import filterCreator, { FLOW_METADATA_TYPE_ID } from '../../src/filters/flow'

describe('flow filter', () => {
  const filter = filterCreator()
  const elemID = FLOW_METADATA_TYPE_ID
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
      .annotations[CORE_ANNOTATIONS.RESTRICTION][RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]).toBe(false)
  })
})
