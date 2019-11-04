import _ from 'lodash'
import {
  Element, isInstanceElement, InstanceElement, Value,
} from 'adapter-api'
import { FilterWith } from '../filter'

interface SortField {
  typeName: string // The Object Type we wish to sort its instances
  fieldsToSortHierarchy: string[] // The properties hierarchy to the required list property
  fieldToSortBy: string // The property by which we sort the objects in the array
}

const CLEAN_DATA_SERVICE_TYPE_NAME = 'clean_data_service'
const CLEAN_RULES_FIELD_NAME = 'clean_rules'
const FIELD_MAPPINGS_FIELD_NAME = 'field_mappings'
const FIELD_MAPPINGS_FIELD_TO_SORT_BY = 'developer_name'
const CLEAN_DATA_SERVICE_SORT = {
  typeName: CLEAN_DATA_SERVICE_TYPE_NAME,
  fieldsToSortHierarchy: [CLEAN_RULES_FIELD_NAME, FIELD_MAPPINGS_FIELD_NAME],
  fieldToSortBy: FIELD_MAPPINGS_FIELD_TO_SORT_BY,
}

/**
* Declare the list order filter: This filter sorts lists (which we will later on describe as sets),
* whose order of elements is non-important. The reason for the sorting is that the order of
* elements returned from salesforce can change from fetch to fetch, causing an unnecessary
* diff between blueprints.
*/
const filterCreator = (): FilterWith<'onFetch'> => ({
  /**
   * Upon discover, rename assignment rules instances
   *
   * @param elements the already discoverd elements
   */
  onFetch: async (elements: Element[]) => {
    // An internal method that receives the sort info and does the sorting
    const orderListFields = (
      instances: InstanceElement[],
      sortFieldInfo: SortField
    ): void => {
      // Filter the instances we wish to sortt their sub properties
      const instancesToChange = instances.find(e => e.type.elemID.name === sortFieldInfo.typeName)
      if (!instancesToChange) {
        return
      }

      const instancesToChangeArray = _.isArray(
        instancesToChange
      ) ? instancesToChange : [instancesToChange]

      const getFieldsRecursively = (currentLevel: Value[], fieldHierarchy: string[]): Value[] => {
        if (fieldHierarchy.length === 1) {
          return currentLevel
        }
        const currentField = fieldHierarchy[0]
        const subFields = currentLevel.map(obj => {
          if (obj instanceof InstanceElement) {
            return obj.value[currentField]
          }
          return obj[currentField]
        })

        return getFieldsRecursively(_.flatten(subFields), _.drop(fieldHierarchy))
      }
      // Get the sub fields we want to sort
      const fieldsToSort = getFieldsRecursively(
        instancesToChangeArray,
        sortFieldInfo.fieldsToSortHierarchy
      )
      const arrayPropertyToSort = sortFieldInfo.fieldsToSortHierarchy.pop() as string
      fieldsToSort.forEach(field => {
        field[arrayPropertyToSort] = _.orderBy(
          field[arrayPropertyToSort],
          sortFieldInfo.fieldToSortBy
        )
      })
    }
    const instanceElements = elements.filter(isInstanceElement)

    orderListFields(instanceElements, CLEAN_DATA_SERVICE_SORT)
  },
})

export default filterCreator
