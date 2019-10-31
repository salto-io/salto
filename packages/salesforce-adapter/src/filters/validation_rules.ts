import _ from 'lodash'
import { Element, isInstanceElement, isObjectType } from 'adapter-api'
import { FilterCreator } from '../filter'
import { apiName } from '../transformer'

export const VALIDATION_RULE_TYPE = 'validation_rule'
export const VALIDATION_RULE_ANNOTATION = 'validation_rules'

const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const rulesByObject = _(elements)
      .filter(isInstanceElement)
      .filter(e => e.type.elemID.name === VALIDATION_RULE_TYPE)
      // validation rules fullName's format is related_object_name.rule_name
      .groupBy(e => apiName(e).split('.')[0])
      .value()

    elements
      .filter(isObjectType)
      .forEach(obj => {
        const rules = rulesByObject[apiName(obj)]
        if (rules) {
          obj.annotate({ [VALIDATION_RULE_ANNOTATION]: rules.map(r => r.elemID.getFullName()) })
        }
      })
  },
})

export default filterCreator
