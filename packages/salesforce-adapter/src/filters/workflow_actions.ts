import {
  Element, ObjectType, ElemID, Field, findObjectType, findInstances, isInstanceElement, FieldMap,
} from 'adapter-api'
import _ from 'lodash'
import wu from 'wu'
import { SALESFORCE } from '../constants'
import { FilterCreator } from '../filter'

export const ACTIONS = 'actions'
export const WORKFLOW_RULE = 'workflow_rule'
export const WORKFLOW_ACTIONS = 'workflow_actions'
export const WORKFLOW_FIELD_TO_TYPE_MAP = {
  ALERT: ['alerts', 'workflow_alert'],
  FIELD_UPDATE: ['field_updates', 'workflow_field_update'],
  OUTBOUND_MESSAGE: ['outbound_messages', 'workflow_outbound_message'],
  KNOWLEDGE_PUBLISH: ['knowledge_publishes', 'workflow_knowledge_publish'],
  TASK: ['tasks', 'workflow_task'],
  SEND: ['send', 'workflow_send'],
}

const FIELDS_TO_ASSIGN = [
  WORKFLOW_FIELD_TO_TYPE_MAP.ALERT[0],
  WORKFLOW_FIELD_TO_TYPE_MAP.FIELD_UPDATE[0],
  WORKFLOW_FIELD_TO_TYPE_MAP.OUTBOUND_MESSAGE[0],
  WORKFLOW_FIELD_TO_TYPE_MAP.KNOWLEDGE_PUBLISH[0],
  WORKFLOW_FIELD_TO_TYPE_MAP.TASK[0],
  WORKFLOW_FIELD_TO_TYPE_MAP.SEND[0],
]

const OBJECT_TYPES_TO_REMOVE = new Set(
  [WORKFLOW_FIELD_TO_TYPE_MAP.ALERT[1],
    WORKFLOW_FIELD_TO_TYPE_MAP.FIELD_UPDATE[1],
    WORKFLOW_FIELD_TO_TYPE_MAP.OUTBOUND_MESSAGE[1],
    WORKFLOW_FIELD_TO_TYPE_MAP.KNOWLEDGE_PUBLISH[1],
    WORKFLOW_FIELD_TO_TYPE_MAP.TASK[1],
    WORKFLOW_FIELD_TO_TYPE_MAP.SEND[1],
    WORKFLOW_RULE]
)

/**
 * Embed actions inside workflow records
 */
const filterCreator: FilterCreator = () => ({
  /**
   * Add the various actions to the workflow rule object type and discard records whose data
   * is already embedded in the workflow records
   *
   * @param allElements
   */
  onFetch: async (allElements: Element[]): Promise<void> => {
    /**
     * Modifies the workflow_rule object type to contain the various types of actions in
     * the actions field.
     * @param elements the list of elements
     */
    const changeWorkFlowRule = (elements: Element[]): void => {
      const workFlowRuleObjectType = findObjectType(
        elements,
        new ElemID(SALESFORCE, WORKFLOW_RULE)
      )
      if (!workFlowRuleObjectType) {
        return
      }

      const getFields = (
        elems: Element[],
        fieldsToObjectTypesMap: Record<string, string[]>
      ): FieldMap => {
        const actionsElemId = new ElemID(SALESFORCE, WORKFLOW_ACTIONS)
        const result: FieldMap = {}
        Object.values(fieldsToObjectTypesMap).forEach(mapping => {
          result[mapping[0]] = new Field(
            actionsElemId, mapping[0], findObjectType(
              elems,
              new ElemID(SALESFORCE, mapping[1])
            ) as ObjectType, {}, true
          )
        })
        return result
      }

      const actionsElemId = new ElemID(SALESFORCE, WORKFLOW_ACTIONS)
      const workflowActionsType = new ObjectType({
        elemID: actionsElemId,
        fields: getFields(elements, WORKFLOW_FIELD_TO_TYPE_MAP),
      })
      workflowActionsType.path = ['types', 'subtypes', WORKFLOW_ACTIONS]
      const actionField = workFlowRuleObjectType.fields[ACTIONS]
      actionField.type = workflowActionsType
      elements.push(workflowActionsType)
    }

    /**
     * Change the instances to contain the various action data inside their actions field
     * @param elements the list of elements
     */
    const changeWorkFlowInstances = (elements: Element[]): void => {
      const workflows = findInstances(elements, new ElemID(SALESFORCE, 'workflow'))
      wu(workflows).map(w => w.value).forEach(value => {
        value.rules.actions = {}
        const { actions } = value.rules
        const workflowFields = _(FIELDS_TO_ASSIGN)
          .map(field => [field, value[field]])
          .fromPairs()
          .pickBy() // filter undefined values
          .value()

        Object.assign(actions, workflowFields)
      })
    }

    /**
     * Remove records that are already nested inside the workflow records to prevent data
     * duplications.
     * @param elements the list of elements
     */
    const removeNestedInstances = (elements: Element[]): void => {
      _.remove(elements,
        elem => isInstanceElement(elem) && OBJECT_TYPES_TO_REMOVE.has(elem.type.elemID.name))
    }

    changeWorkFlowRule(allElements)
    changeWorkFlowInstances(allElements)
    removeNestedInstances(allElements)
  },
})

export default filterCreator
