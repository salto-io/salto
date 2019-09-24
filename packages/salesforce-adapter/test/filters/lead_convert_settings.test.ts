import _ from 'lodash'
import {
  ObjectType, ElemID, InstanceElement, Element, Field, BuiltinTypes,
} from 'adapter-api'
import { bpCase } from '../../src/transformer'
import filterCreator, {
  LEAD_CONVERT_SETTINGS_TYPE, LEAD_TYPE, CONVERT_SETTINGS_ANNOTATION,
  OBJECT_MAPPING_FIELD, MAPPING_FIELDS_FIELD,
} from '../../src/filters/lead_convert_settings'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

describe('Test layout filter', () => {
  const { client } = mockClient()
  const filter = filterCreator({ client }) as FilterWith<'onDiscover'> & FilterWith<'onUpdate'>

  const mockLead = new ObjectType(
    { elemID: new ElemID(constants.SALESFORCE, LEAD_TYPE) }
  )

  const fullName = bpCase(constants.METADATA_OBJECT_NAME_FIELD)
  const elemID = new ElemID(constants.SALESFORCE, LEAD_CONVERT_SETTINGS_TYPE)
  const mockConvertSettingsType = new ObjectType(
    {
      elemID,
      fields: {
        [fullName]: new Field(elemID, fullName, BuiltinTypes.STRING),
        fake: new Field(elemID, 'fake', BuiltinTypes.BOOLEAN),
      },
    }
  )

  const mockConvertSettingsInstance = new InstanceElement(
    new ElemID(constants.SALESFORCE, LEAD_CONVERT_SETTINGS_TYPE,
      'lead_convert_settings'), mockConvertSettingsType,
    {
      [fullName]: 'full',
      [OBJECT_MAPPING_FIELD]: {
        [MAPPING_FIELDS_FIELD]: 'mapping',
      },
      fake: 'true',
    }
  )

  let testElements: Element[]

  beforeEach(() => {
    testElements = [_.cloneDeep(mockLead),
      _.cloneDeep(mockConvertSettingsType),
      _.cloneDeep(mockConvertSettingsInstance)]
  })

  describe('on discover', () => {
    let leadPostFilter: ObjectType

    beforeEach(async () => {
      await filter.onDiscover(testElements)
      leadPostFilter = testElements.find(e => e.elemID.name === LEAD_TYPE) as ObjectType
    })

    it('should add annotations to lead', async () => {
      expect(leadPostFilter.annotationTypes[CONVERT_SETTINGS_ANNOTATION].elemID.name)
        .toBe(LEAD_CONVERT_SETTINGS_TYPE)
      expect(leadPostFilter.annotations[CONVERT_SETTINGS_ANNOTATION]).toBeDefined()
    })

    it('should convert to lists', async () => {
      const value = leadPostFilter.annotations[CONVERT_SETTINGS_ANNOTATION]
      expect(Array.isArray(value[OBJECT_MAPPING_FIELD])).toBeTruthy()
      expect(Array.isArray(value[OBJECT_MAPPING_FIELD][0][MAPPING_FIELDS_FIELD])).toBeTruthy()
    })

    it('should convert to right type', async () => {
      const value = leadPostFilter.annotations[CONVERT_SETTINGS_ANNOTATION]
      expect(value.fake).toBeTruthy()
    })

    it('should remove full_name', async () => {
      const value = leadPostFilter.annotations[CONVERT_SETTINGS_ANNOTATION]
      expect(value[fullName]).toBeUndefined()
      const type = leadPostFilter.annotationTypes[CONVERT_SETTINGS_ANNOTATION] as ObjectType
      expect(type.fields[fullName]).toBeUndefined()
    })
  })
})
