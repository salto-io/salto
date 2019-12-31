import {
  Element, ElemID, ObjectType, Values, InstanceElement,
} from 'adapter-api'
import mockClient from '../client'
import filterCreator, { INSTANCE_TYPE_FIELD, INSTANCE_VALUE_SET_FIELD } from '../../src/filters/custom_objects'
import { FilterWith } from '../../src/filter'
import {
  CUSTOM_OBJECT, FIELD_ANNOTATIONS, FIELD_DEPENDENCY_FIELDS, SALESFORCE,
  VALUE_SETTINGS_FIELDS, INSTANCE_FULL_NAME_FIELD, LABEL, VALUE_SET_FIELDS,
  VALUE_SET_DEFINITION_FIELDS, VALUE_SET_DEFINITION_VALUE_FIELDS,
} from '../../src/constants'

describe('Test field dependencies filter', () => {
  describe('on fetch', () => {
    const fieldDependenciesInstanceElement = new InstanceElement('account', new ObjectType(
      { elemID: new ElemID(SALESFORCE, CUSTOM_OBJECT) }
    ),
    { fields: [{
      [INSTANCE_FULL_NAME_FIELD]: 'picklist_field',
      [LABEL]: 'My Field Dependency',
      [INSTANCE_VALUE_SET_FIELD]: {
        [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: 'ControllingFieldName',
        [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: [
          {
            [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: ['Controlling1', 'Controlling2'],
            [VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'Val1',
          },
          {
            [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]: ['Controlling1'],
            [VALUE_SETTINGS_FIELDS.VALUE_NAME]: 'Val2',
          },
        ],
        [VALUE_SET_FIELDS.VALUE_SET_DEFINITION]: {
          [VALUE_SET_DEFINITION_FIELDS.VALUE]: [
            {
              [VALUE_SET_DEFINITION_VALUE_FIELDS.FULL_NAME]: 'Val1',
              [VALUE_SET_DEFINITION_VALUE_FIELDS.DEFAULT]: 'false',
              [VALUE_SET_DEFINITION_VALUE_FIELDS.LABEL]: 'Val1',
            },
            {
              [VALUE_SET_DEFINITION_VALUE_FIELDS.FULL_NAME]: 'Val2',
              [VALUE_SET_DEFINITION_VALUE_FIELDS.DEFAULT]: 'false',
              [VALUE_SET_DEFINITION_VALUE_FIELDS.LABEL]: 'Val2',
            },
          ],
        },
      },
      [INSTANCE_TYPE_FIELD]: 'Picklist',
    }],
    [INSTANCE_FULL_NAME_FIELD]: 'Account' })

    let testElements: Element[]
    const { client } = mockClient()
    let filter: FilterWith<'onFetch'>

    beforeEach(() => {
      testElements = [fieldDependenciesInstanceElement.clone()]
    })

    const initFilter = async (): Promise<void> => {
      filter = filterCreator({ client }) as FilterWith<'onFetch'>
      await filter.onFetch(testElements)
    }

    const assertFieldDependencyTransformation = (fieldDependencyAnnotation: Values): void => {
      expect(fieldDependencyAnnotation).toBeDefined()
      expect(fieldDependencyAnnotation[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD])
        .toEqual('ControllingFieldName')
      const valuesSettings = fieldDependencyAnnotation[FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]
      expect(valuesSettings).toBeDefined()
      expect(valuesSettings).toHaveLength(2)
      expect(valuesSettings[0][VALUE_SETTINGS_FIELDS.VALUE_NAME]).toEqual('Val1')
      expect(valuesSettings[0][VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE])
        .toEqual(['Controlling1', 'Controlling2'])
      expect(valuesSettings[1][VALUE_SETTINGS_FIELDS.VALUE_NAME]).toEqual('Val2')
      expect(valuesSettings[1][VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE])
        .toEqual(['Controlling1'])
    }

    it('should add field dependency data to a field with field dependency annotation', async () => {
      await initFilter()
      const testElement = testElements[0] as ObjectType
      const fieldDependencyAnnotation = testElement.fields.picklist_field
        .annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
      assertFieldDependencyTransformation(fieldDependencyAnnotation)
    })
  })
})
