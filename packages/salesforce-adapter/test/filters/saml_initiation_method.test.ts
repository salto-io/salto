import _ from 'lodash'
import {
  ObjectType, ElemID, InstanceElement, Element, Type, Field, BuiltinTypes,
} from 'adapter-api'
import filterCreator, { CANVAS_METADATA_TYPE_NAME, SAML_INIT_METHOD_FIELD_NAME }
  from '../../src/filters/saml_initiation_method'
import { SALESFORCE } from '../../src/constants'
import { bpCase } from '../../src/transformer'
import { FilterWith } from '../../src/filter'

describe('saml initiation method filter', () => {
  const typeElemID = new ElemID(SALESFORCE, CANVAS_METADATA_TYPE_NAME)
  const mockType = new ObjectType(
    {
      elemID: typeElemID,
      fields: {
        [SAML_INIT_METHOD_FIELD_NAME]: new Field(typeElemID, SAML_INIT_METHOD_FIELD_NAME,
          BuiltinTypes.STRING,
          { [Type.VALUES]: ['None', 'IdpInitiated', 'SpInitiated'] }),
      },
    }
  )

  const mockInstance = new InstanceElement(
    'fake',
    mockType,
    {
      [bpCase(SAML_INIT_METHOD_FIELD_NAME)]: '0',
    },
  )

  let testElements: Element[]

  const filter = filterCreator() as FilterWith<'onFetch'>

  beforeEach(() => {
    testElements = [
      _.clone(mockType),
      _.clone(mockInstance),
    ]
  })

  describe('on fetch', () => {
    it('should transform illegal val to None', async () => {
      await filter.onFetch(testElements)
      expect((testElements[1] as InstanceElement).value[bpCase(SAML_INIT_METHOD_FIELD_NAME)])
        .toEqual('None')
    })

    it('should keep legal val to', async () => {
      (testElements[1] as InstanceElement)
        .value[bpCase(SAML_INIT_METHOD_FIELD_NAME)] = 'IdpInitiated'
      await filter.onFetch(testElements)
      expect((testElements[1] as InstanceElement)
        .value[bpCase(SAML_INIT_METHOD_FIELD_NAME)]).toEqual('IdpInitiated')
    })
  })
})
