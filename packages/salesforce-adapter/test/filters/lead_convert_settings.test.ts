import _ from 'lodash'
import {
  ObjectType, InstanceElement, Element, Field, BuiltinTypes,
} from 'adapter-api'
import { bpCase } from '../../src/transformer'
import filterCreator, {
  LEAD_CONVERT_SETTINGS_TYPE_ID, LEAD_TYPE_ID, CONVERT_SETTINGS_ANNOTATION,
  OBJECT_MAPPING_FIELD, MAPPING_FIELDS_FIELD,
} from '../../src/filters/lead_convert_settings'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import { findElements } from '../utils'

describe('lead convert settings filter', () => {
  const { client } = mockClient()
  const filter = filterCreator({ client }) as FilterWith<'onFetch'> & FilterWith<'onUpdate'>

  const mockLead = new ObjectType(
    { elemID: LEAD_TYPE_ID }
  )

  const fullName = bpCase(constants.METADATA_OBJECT_NAME_FIELD)
  const elemID = LEAD_CONVERT_SETTINGS_TYPE_ID
  const mockConvertSettingsType = new ObjectType(
    {
      elemID,
      fields: {
        [fullName]: new Field(elemID, fullName, BuiltinTypes.STRING),
        fake: new Field(elemID, 'fake', BuiltinTypes.BOOLEAN),
      },
      annotations: {
        [constants.METADATA_TYPE]: 'LeadConvertSettings',
      },
    }
  )

  const mockConvertSettingsInstance = new InstanceElement(
    'lead_convert_settings',
    mockConvertSettingsType,
    {
      [fullName]: 'full',
      [OBJECT_MAPPING_FIELD]: {
        [MAPPING_FIELDS_FIELD]: 'mapping',
      },
      fake: 'true',
    }
  )

  describe('on fetch', () => {
    let leadPostFilter: ObjectType
    let testElements: Element[]

    beforeEach(async () => {
      testElements = [_.cloneDeep(mockLead),
        _.cloneDeep(mockConvertSettingsType),
        _.cloneDeep(mockConvertSettingsInstance)]
      await filter.onFetch(testElements)
      leadPostFilter = findElements(testElements, LEAD_TYPE_ID.name).pop() as ObjectType
    })

    it('should add annotations to lead', async () => {
      expect(leadPostFilter.annotationTypes[CONVERT_SETTINGS_ANNOTATION].elemID)
        .toEqual(LEAD_CONVERT_SETTINGS_TYPE_ID)
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

  describe('on update', () => {
    const clientUpdate = jest.spyOn(client, 'update').mockImplementation(() => Promise.resolve([]))

    beforeEach(async () => {
      const before = _.cloneDeep(mockLead)
      before.annotations[constants.METADATA_TYPE] = 'Lead'
      before.annotationTypes[CONVERT_SETTINGS_ANNOTATION] = mockConvertSettingsType
      before.annotations[CONVERT_SETTINGS_ANNOTATION] = {}
      before.annotations[CONVERT_SETTINGS_ANNOTATION].change = true
      const after = _.cloneDeep(before)
      after.annotations[CONVERT_SETTINGS_ANNOTATION].change = false
      await filter.onUpdate(before, after, [{ action: 'modify', data: { before, after } }])
    })

    it('should call client update', async () => {
      // validate client calls
      expect(clientUpdate.mock.calls).toHaveLength(1)
    })
  })
})
