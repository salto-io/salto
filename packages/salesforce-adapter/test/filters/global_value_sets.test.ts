import {
  ObjectType, ElemID, Element, InstanceElement, Field, ReferenceExpression, CORE_ANNOTATIONS,
} from 'adapter-api'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import filterCreator,
{ GLOBAL_VALUE_SET, CUSTOM_VALUE, MASTER_LABEL } from '../../src/filters/global_value_sets'
import { Types } from '../../src/transformers/transformer'

const createGlobalValueSetInstanceElement = (name: string, values: string[]): InstanceElement =>
  new InstanceElement('global_value_set_test', new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'global_value_set'),
    fields: {},
    annotationTypes: {},
    annotations: { [constants.METADATA_TYPE]: GLOBAL_VALUE_SET },
  }),
  {
    [constants.INSTANCE_FULL_NAME_FIELD]: name,
    [MASTER_LABEL]: name,
    [constants.DESCRIPTION]: name,
    sorted: false,
    [CUSTOM_VALUE]: values.map(v => (
      {
        [constants.VALUE_SET_DEFINITION_VALUE_FIELDS.FULL_NAME]: v,
        [constants.VALUE_SET_DEFINITION_VALUE_FIELDS.DEFAULT]: false,
        [constants.VALUE_SET_DEFINITION_VALUE_FIELDS.LABEL]: v,
      })),
  })

const createPicklistObjectType = (
  mockElemID: ElemID,
  apiName: string,
  valueSetName: string,
): ObjectType => new ObjectType({
  elemID: mockElemID,
  fields: {
    state: new Field(
      mockElemID,
      'test',
      Types.primitiveDataTypes[constants.FIELD_TYPE_NAMES.PICKLIST],
      {
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [constants.API_NAME]: apiName,
        label: 'test label',
        [constants.VALUE_SET_FIELDS.VALUE_SET_NAME]: valueSetName,
        [constants.FIELD_ANNOTATIONS.RESTRICTED]: true,
      }
    ),
  },
  annotations: {
    [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
  },
})

/* eslint-disable jest/no-focused-tests */
describe('Global Value Sets filter', () => {
  const filter = filterCreator() as FilterWith<'onFetch'>
  const mockElemID = new ElemID(constants.SALESFORCE, 'test')
  let elements: Element[] = []

  beforeEach(() => {
    elements = [
      createGlobalValueSetInstanceElement('test1', ['val1', 'val2']),
    ]
  })

  describe('on fetch', () => {
    it('should replace value set with references', async () => {
      elements.push(createPicklistObjectType(mockElemID, 'test', 'test1'))
      await filter.onFetch(elements)
      const globalValueSetInstance = elements[0] as InstanceElement
      const customObjectType = elements[1] as ObjectType
      expect(customObjectType.fields.state.annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME])
        .toEqual(new ReferenceExpression(globalValueSetInstance.elemID
          .createNestedID(constants.INSTANCE_FULL_NAME_FIELD)))
    })

    it('should not replace value set with references if value set name does not exist', async () => {
      elements.push(createPicklistObjectType(mockElemID, 'test', 'not_exist'))
      await filter.onFetch(elements)
      const customObjectType = elements[1] as ObjectType
      expect(customObjectType.fields.state
        .annotations[constants.VALUE_SET_FIELDS.VALUE_SET_NAME])
        .toEqual('not_exist')
    })
  })
})
