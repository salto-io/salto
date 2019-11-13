import _ from 'lodash'
import {
  Element, isInstanceElement, InstanceElement, Value, isObjectType, ObjectType, Type,
} from 'adapter-api'
import { FilterWith } from '../filter'

interface SortField {
  typeName: string // The Object Type we wish to sort its instances
  path: string[] // The properties hierarchy to the required list property we wish to sort
  fieldToSortBy?: string // The property by which we sort the objects in the array
}

export const CLEAN_DATA_SERVICE_TYPE_NAME = 'clean_data_service'
export const CLEAN_RULES_FIELD_NAME = 'clean_rules'
export const FIELD_MAPPINGS_FIELD_NAME = 'field_mappings'
export const FIELD_MAPPINGS_FIELD_TO_SORT_BY = 'developer_name'
const CLEAN_DATA_SERVICE_SORT = {
  typeName: CLEAN_DATA_SERVICE_TYPE_NAME,
  path: [CLEAN_RULES_FIELD_NAME, FIELD_MAPPINGS_FIELD_NAME],
  fieldToSortBy: FIELD_MAPPINGS_FIELD_TO_SORT_BY,
}

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
      instancesToChange.forEach(elem => {
        // Get the initial field to start with, this one is special because it is the only one
        // accessed by elem.value[fieldToStart], while the rest of the path is accessed by .
        const fieldToStart = sortFieldInfo.path.shift() as string
        const arrayPropertyToSort = sortFieldInfo.path.pop()
        let fieldsToSort: Value[]
        // If we have an additional nested property to sort
        if (arrayPropertyToSort) {
          // If the path still remains after the initial field and the property to sort,
          // get the elements in that path, otherwise get the elements from the fieldToStart
          fieldsToSort = sortFieldInfo.path.length > 0 ? _.get(
            elem.value[fieldToStart],
            sortFieldInfo.path
          ) : elem.value[fieldToStart]
          if (_.isArray(fieldsToSort)) {
            // The purpose of the following foreach is to sort the items in each field required to
            // be sorted (there can be many list/array fields to sort)
            fieldsToSort.forEach(field => {
              if (_.isArray(field[arrayPropertyToSort])) {
                field[arrayPropertyToSort] = _.orderBy(
                  field[arrayPropertyToSort],
                  sortFieldInfo.fieldToSortBy
                )
              }
            })
          }
        // We don't have an additional property to sort, and we sort the elements inside the
        // initial field at the top level (right below to elem.value)
        } else if (_.isArray(elem.value[fieldToStart])) {
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
        const field = typeElem.fields[sortFieldInfo.path[0]]
        if (field === undefined) {
          return
        }
        const { annotations } = field
        if (_.isArray(annotations[Type.VALUES])) {
          annotations[Type.VALUES] = _.orderBy(annotations[Type.VALUES])
        }
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
