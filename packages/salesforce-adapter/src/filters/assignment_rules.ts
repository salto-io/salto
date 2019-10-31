import _ from 'lodash'
import {
  Element, isInstanceElement, ElemID,
} from 'adapter-api'
import { FilterCreator } from '../filter'
import { apiName, bpCase } from '../transformer'

export const ASSIGNMENT_RULES_TYPE_NAME = 'assignment_rules'

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
    _(elements)
      .filter(isInstanceElement)
      .filter(e => e.type.elemID.name === ASSIGNMENT_RULES_TYPE_NAME)
      .forEach(rule => {
        // We aim to get `lead_assignment_rules` and `case_assignment_rules`, since the instance
        // name we get from the API is Lead / Case we can just use the instance name followed by
        // assignment_rules to get the desired name
        const newName = `${bpCase(apiName(rule))}_${ASSIGNMENT_RULES_TYPE_NAME}`
        // Replace the element ID
        rule.elemID = new ElemID(rule.elemID.adapter, newName)
      })
  },
})

export default filterCreator
