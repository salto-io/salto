import _ from 'lodash'
import { isInstanceElement, isObjectType } from 'adapter-api'
import Filter from './filter'
import { apiName } from '../transformer'

export const VALIDATION_RULE_TYPE = 'validation_rule'
export const VALIDATION_RULE_ANNOTATION = 'validation_rules'

export const filter: Filter = {
  onDiscover: async (_client, elements) => {
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
  onAdd: async (_client, _after) => [],
  onUpdate: async (_client, _before, _after) => [],
  onRemove: async (_client, _before) => [],
}
