import _ from 'lodash'
import { Element, isObjectType, ElemID, findInstances } from 'adapter-api'
import { FilterCreator } from '../filter'
import { apiName } from '../transformers/transformer'
import { SALESFORCE } from '../constants'

export const VALIDATION_RULE_TYPE_ID = new ElemID(SALESFORCE, 'validation_rule')
export const VALIDATION_RULE_ANNOTATION = 'validation_rules'

const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const rulesByObject = _([...findInstances(elements, VALIDATION_RULE_TYPE_ID)])
      // validation rules fullName's format is related_object_name.rule_name
      .groupBy(e => apiName(e).split('.')[0])
      .value()

    elements
      .filter(isObjectType)
      .forEach(obj => {
        const rules = rulesByObject[apiName(obj)]
        if (rules) {
          obj.annotate({
            [VALIDATION_RULE_ANNOTATION]: rules.map(r => r.elemID.getFullName()).sort(),
          })
        }
      })
  },
})

export default filterCreator
