import _ from 'lodash'
import {
  Element, InstanceElement, Value, Values, Type, findElement, ElemID, findInstances,
  findObjectType,
} from 'adapter-api'
import wu from 'wu'
import { INSTANCE_FULL_NAME_FIELD, SALESFORCE } from '../constants'
import { FilterWith } from '../filter'

interface SortField {
  typeName: string // The Object Type we wish to sort its instances
  path: string[] // The properties hierarchy to the required list property we wish to sort
  // The property by which we sort the objects in the array (its name as string). Or:
  // A comparison function that will be used in ordering the list elements
  fieldOrCallbackToSortBy?: string | ((value: Value) => number)
}

export const CLEAN_DATA_SERVICE_TYPE_NAME = 'clean_data_service'
export const CLEAN_RULES_FIELD_NAME = 'clean_rules'
export const FIELD_MAPPINGS_FIELD_NAME = 'field_mappings'
export const FIELD_MAPPINGS_FIELD_TO_SORT_BY = 'developer_name'
const CLEAN_DATA_SERVICE_SORT = {
  typeName: CLEAN_DATA_SERVICE_TYPE_NAME,
  path: [CLEAN_RULES_FIELD_NAME, FIELD_MAPPINGS_FIELD_NAME],
  fieldOrCallbackToSortBy: FIELD_MAPPINGS_FIELD_TO_SORT_BY,
}
export const BUSINESS_PROCESS_TYPE_NAME = 'business_process'
export const VALUES_FIELD_NAME = 'values'
export const VALUES_FIELD_TO_SORT_BY = INSTANCE_FULL_NAME_FIELD

export const ANIMATION_RULE_TYPE_NAME = 'animation_rule'
export const TARGET_FIELD_NAME = 'target_field'
const ANIMATION_RULE_SORT = {
  typeName: ANIMATION_RULE_TYPE_NAME,
  path: [TARGET_FIELD_NAME],
}
export const FIELD_PERMISSIONS_TYPE_NAME = 'field_permissions'
export const LEAD_HISTORY_TYPE_NAME = 'lead_history'
export const FIELD_FIELD_NAME = 'field'
const FIELD_PERMISSIONS_SORT = {
  typeName: FIELD_PERMISSIONS_TYPE_NAME,
  path: [FIELD_FIELD_NAME],
}
const LEAD_HISTORY_SORT = {
  typeName: LEAD_HISTORY_TYPE_NAME,
  path: [FIELD_FIELD_NAME],
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
   * @param elements the already discovered elements
   */
  onFetch: async (elements: Element[]) => {
    // An internal method that receives the sort info and the records and does the sorting
    const orderListFieldsInInstances = (
      elems: Element[],
      sortFieldInfo: SortField
    ): void => {
      // Filter the instances we wish to sort their sub properties
      const instancesToChange = findInstances(elems, new ElemID(SALESFORCE, sortFieldInfo.typeName))
      wu(instancesToChange).forEach(elem => {
        // First, for each element clone the sortFieldInfo since we perform changes on it during
        // the sorting operation:
        const sortFieldInfoCopy = _.cloneDeep(sortFieldInfo)
        // Get the initial field to start with, this one is special because it is the only one
        // accessed by elem.value[fieldToStart], while the rest of the path is accessed by .
        const fieldToStart = sortFieldInfoCopy.path.shift() as string
        const arrayPropertyToSort = sortFieldInfoCopy.path.pop()
        let fieldsToSort: Value[]
        // If we have an additional nested property to sort
        if (arrayPropertyToSort) {
          // If the path still remains after the initial field and the property to sort,
          // get the elements in that path, otherwise get the elements from the fieldToStart
          fieldsToSort = sortFieldInfoCopy.path.length > 0 ? _.get(
            elem.value[fieldToStart],
            sortFieldInfoCopy.path
          ) : elem.value[fieldToStart]
          if (_.isArray(fieldsToSort)) {
            // The purpose of the following foreach is to sort the items in each field required to
            // be sorted (there can be many list/array fields to sort)
            fieldsToSort
              .filter(field => _.isArray(field[arrayPropertyToSort]))
              .forEach(field => {
                field[arrayPropertyToSort] = _.orderBy(
                  field[arrayPropertyToSort],
                  sortFieldInfoCopy.fieldOrCallbackToSortBy
                )
              })
          }
        // We don't have an additional property to sort, and we sort the elements inside the
        // initial field at the top level (right below to elem.value)
        } else if (_.isArray(elem.value[fieldToStart])) {
          elem.value[fieldToStart] = _.orderBy(
            elem.value[fieldToStart],
            sortFieldInfoCopy.fieldOrCallbackToSortBy
          )
        }
      })
    }

    // An internal method that receives the sort info and the ObjectTypes and does the sorting
    const orderListFieldsInTypes = (
      elems: Element[],
      sortFieldInfo: SortField
    ): void => {
      // Filter the types we wish to sort their sub properties
      const typeToChange = findObjectType(elems, new ElemID(SALESFORCE, sortFieldInfo.typeName))
      if (!typeToChange) {
        return
      }
      let valuesToSort = typeToChange.fields[sortFieldInfo.path[0]]?.annotations[Type.VALUES]
      if (_.isArray(valuesToSort)) {
        valuesToSort = valuesToSort.sort()
      }
    }
    orderListFieldsInInstances(elements, CLEAN_DATA_SERVICE_SORT)
    // Order the opportunity stages items in the business process' values field according to the
    // opportunity stages picklist values.
    const opportunityStageElem = new ElemID(SALESFORCE, 'standard_value_set', 'instance', 'opportunity_stage')
    const opportunityStage = findElement(elements, opportunityStageElem) as InstanceElement
    if (opportunityStage && _.isArray(opportunityStage.value.standard_value)) {
      const BUSINESS_PROCESS_VALUES_SORT = {
        typeName: BUSINESS_PROCESS_TYPE_NAME,
        path: [VALUES_FIELD_NAME],
        fieldOrCallbackToSortBy: (stage: Value): number => {
          const orderedStageNames = opportunityStage.value.standard_value
            .map((val: Values) => val[INSTANCE_FULL_NAME_FIELD])
          return orderedStageNames.indexOf(stage[INSTANCE_FULL_NAME_FIELD])
        },
      }
      orderListFieldsInInstances(elements, BUSINESS_PROCESS_VALUES_SORT)
    }
    orderListFieldsInTypes(elements, ANIMATION_RULE_SORT)
    orderListFieldsInTypes(elements, FIELD_PERMISSIONS_SORT)
    orderListFieldsInTypes(elements, LEAD_HISTORY_SORT)
  },
})

export default filterCreator
