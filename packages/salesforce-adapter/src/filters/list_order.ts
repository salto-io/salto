import _ from 'lodash'
import {
  Element, isInstanceElement, InstanceElement, Value, isObjectType, ObjectType,
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

const ANIMATION_RULE_TYPE_NAME = 'animation_rule'
const TARGET_FIELD_NAME = 'target_field'
const ANIMATION_RULE_SORT = {
  typeName: ANIMATION_RULE_TYPE_NAME,
  fieldsToSortHierarchy: [TARGET_FIELD_NAME],
  fieldToSortBy: '',
}
const FIELD_PERMISSIONS_TYPE_NAME = 'field_permissions'
const LEAD_HISTORY_TYPE_NAME = 'lead_history'
const FIELD_FIELD_NAME = 'field'
const FIELD_PERMISSIONS_SORT = {
  typeName: FIELD_PERMISSIONS_TYPE_NAME,
  fieldsToSortHierarchy: [FIELD_FIELD_NAME],
  fieldToSortBy: '',
}
const LEAD_HISTORY_SORT = {
  typeName: LEAD_HISTORY_TYPE_NAME,
  fieldsToSortHierarchy: [FIELD_FIELD_NAME],
  fieldToSortBy: '',
}

/**
* Declare the list order filter: This filter sorts lists (which we will later on describe as sets),
* whose order of elements is non-important. The reason for the sorting is that the order of
* elements returned from salesforce can change from fetch to fetch, causing an unnecessary
* diff between blueprints.
*/
const filterCreator = (): FilterWith<'onFetch'> => ({
  /**
   * Upon fetch, order elements is specific lists
   *
   * @param elements the already discoverd elements
   */
  onFetch: async (elements: Element[]) => {
    // An internal method that receives the sort info and the records and does the sorting
    const orderListFieldsInInstances = (
      instances: InstanceElement[],
      sortFieldInfo: SortField
    ): void => {
      // Filter the instances we wish to sort their sub properties
      const instancesToChange = instances.filter(
        inst => inst.type.elemID.name === sortFieldInfo.typeName
      )
      if (instancesToChange.length === 0) {
        return
      }
      // const sortInfo = _.clone(sortFieldInfo)
      instancesToChange.forEach(elem => {
        // Get the sub fields we want to sort
        const fieldToStart = sortFieldInfo.fieldsToSortHierarchy.shift() as string
        const arrayPropertyToSort = sortFieldInfo.fieldsToSortHierarchy.pop()
        let fieldsToSort: Value[]
        if (arrayPropertyToSort) {
          fieldsToSort = sortFieldInfo.fieldsToSortHierarchy.length > 0 ? _.get(
            elem.value[fieldToStart],
            sortFieldInfo.fieldsToSortHierarchy
          ) as Value[] : elem.value[fieldToStart]
          fieldsToSort.forEach(field => {
            field[arrayPropertyToSort] = _.orderBy(
              field[arrayPropertyToSort],
              sortFieldInfo.fieldToSortBy
            )
          })
        } else {
          elem.value[fieldToStart] = _.orderBy(
            elem.value[fieldToStart],
            sortFieldInfo.fieldToSortBy
          )
        }
      })
    }

    // An internal method that receives the sort info and the ObjectTypes and does the sorting
    const orderListFieldsInTypes = (
      types: ObjectType[],
      sortFieldInfo: SortField
    ): void => {
      // Filter the types we wish to sort their sub properties
      const typesToChange = types.filter(t => t.elemID.name === sortFieldInfo.typeName)
      if (typesToChange.length === 0) {
        return
      }
      // const sortInfo = _.clone(sortFieldInfo)
      typesToChange.forEach(typeElem => {
        // eslint-disable-next-line no-underscore-dangle
        typeElem.fields[sortFieldInfo.fieldsToSortHierarchy[0]].annotations._values = _.orderBy(
          // eslint-disable-next-line no-underscore-dangle
          typeElem.fields[sortFieldInfo.fieldsToSortHierarchy[0]].annotations._values,
          undefined
        )
      })
    }
    const instanceElements = elements.filter(isInstanceElement)
    orderListFieldsInInstances(instanceElements, CLEAN_DATA_SERVICE_SORT)
    const typeElements = elements.filter(isObjectType)
    orderListFieldsInTypes(typeElements, ANIMATION_RULE_SORT)
    orderListFieldsInTypes(typeElements, FIELD_PERMISSIONS_SORT)
    orderListFieldsInTypes(typeElements, LEAD_HISTORY_SORT)
  },
})

export default filterCreator
