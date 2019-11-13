import wu from 'wu'
import {
  Element, ElemID, findInstances,
} from 'adapter-api'
import { FilterCreator } from '../filter'
import { apiName, bpCase } from '../transformer'
import { SALESFORCE } from '../constants'

export const ASSIGNMENT_RULES_TYPE_ID = new ElemID(SALESFORCE, 'assignment_rules')

/**
* Declare the assignment rules filter, this filter renames assignment rules instances to match
* the names in the Salesforce UI
*/
const filterCreator: FilterCreator = () => ({
  /**
   * Upon fetch, rename assignment rules instances
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    wu(findInstances(elements, ASSIGNMENT_RULES_TYPE_ID))
      .forEach(rule => {
        // We aim to get `lead_assignment_rules` and `case_assignment_rules`, since the instance
        // name we get from the API is Lead / Case we can just use the instance name followed by
        // assignment_rules to get the desired name
        const newName = `${bpCase(apiName(rule))}_${ASSIGNMENT_RULES_TYPE_ID.name}`
        // Replace the element ID
        rule.elemID = rule.type.elemID.createNestedID('instance', newName)
      })
  },
})

export default filterCreator
