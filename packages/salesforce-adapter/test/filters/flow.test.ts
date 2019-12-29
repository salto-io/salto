import {
  ObjectType, ElemID, Field, BuiltinTypes, ANNOTATION_TYPES,
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
          [ANNOTATION_TYPES.VALUES]: values,
        }),
    },
  })

  it('remove restriction values from flow_metadata_value.name', () => {
    filter.onFetch([mockFlow])
    expect(mockFlow.fields.name.annotations[ANNOTATION_TYPES.VALUES]).toEqual(values)
    expect(mockFlow.fields.name
      .annotations[ANNOTATION_TYPES.RESTRICTION][ANNOTATION_TYPES.ENFORCE_VALUE]).toBe(false)
  })
})
