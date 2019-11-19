import {
  Element, ElemID, findInstances, findElement, Value, InstanceElement,
} from 'adapter-api'
import wu from 'wu'
import _ from 'lodash'
import { SALESFORCE, INSTANCE_FULL_NAME_FIELD } from '../constants'
import { FilterCreator } from '../filter'

export const ACTIONS = 'actions'

/**
 * The filter that handles business process values order
 */
const filterCreator: FilterCreator = () => ({
  /**
   * Order the opportunity stages items in the business process according to the opportunity stages
   * picklist values.
   *
   * @param allElements
   */
  onFetch: async (allElements: Element[]): Promise<void> => {
    const opportunityStageElem = new ElemID(SALESFORCE, 'standard_value_set', 'instance', 'opportunity_stage')
    const opportunityStage = findElement(allElements, opportunityStageElem)
    // If the opportunity stages picklist isn't found, no point in proceeding with the sorting
    if (opportunityStage) {
      const businessProcesses = findInstances(allElements, new ElemID(SALESFORCE, 'business_process'))
      wu(businessProcesses).forEach(process => {
        // Create a map to contain all the values of the business process that maps between the
        // full name and the object
        const valuesMap = new Map<string, Value>()
        if (process.value.values) {
          process.value.values.forEach(
            (val: { [x: string]: string; INSTANCE_FULL_NAME_FIELD: string }) => {
              // Decode the full_name field which sometimes appears in utf-8
              val[INSTANCE_FULL_NAME_FIELD] = decodeURIComponent(val[INSTANCE_FULL_NAME_FIELD])
              valuesMap.set(val[INSTANCE_FULL_NAME_FIELD], val)
            }
          )
          // Iterate over the opportunityStage, check if each of its elements' full_name is in the
          // map, if yes then insert the value to a new array.
          const newValues: Value[] = []
          const opportunityStages = (opportunityStage as InstanceElement).value.standard_value
          if (opportunityStages && _.isArray(opportunityStages)) {
            opportunityStages.forEach(val => {
              if (valuesMap.has(val[INSTANCE_FULL_NAME_FIELD])) {
                newValues.push(valuesMap.get(val[INSTANCE_FULL_NAME_FIELD]))
              }
            })
          }
          // Put that new array instead of the unsorted array.
          process.value.values = newValues
        }
      })
    }
  },
})

export default filterCreator
