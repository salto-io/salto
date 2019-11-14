import {
  Element, ObjectType, ElemID, Field, findObjectType, findInstances, isInstanceElement,
} from 'adapter-api'
import _ from 'lodash'
import wu from 'wu'
import { SALESFORCE } from '../constants'
import { FilterCreator } from '../filter'

export const ACTIONS = 'actions'
export const WORKFLOW_ALERT = 'workflow_alert'
export const WORKFLOW_FIELD_UPDATE = 'workflow_field_update'
export const WORKFLOW_OUTBOUND_MESSAGE = 'workflow_outbound_message'
export const WORKFLOW_KNOWLEDGE_PUBLISH = 'workflow_knowledge_publish'
export const WORKFLOW_TASK = 'workflow_task'
export const WORKFLOW_SEND = 'workflow_send'
export const WORKFLOW_RULE = 'workflow_rule'
export const WORKFLOW_ACTIONS = 'workflow_actions'
export const ALERTS_FIELD_NAME = 'alerts'
export const FIELD_UPDATES_FIELD_NAME = 'field_updates'
export const OUTBOUND_MESSAGES_FIELD_NAME = 'outbound_messages'
export const TASKS_FIELD_NAME = 'tasks'
export const KNOWLEDGE_PUBLISHES_FIELD_NAME = 'knowledge_publishes'
export const SEND_FIELD_NAME = 'send'

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

      const actionsElemId = new ElemID(SALESFORCE, WORKFLOW_ACTIONS)
      const workflowActionsType = new ObjectType({
        elemID: actionsElemId,
        fields: {
          [ALERTS_FIELD_NAME]: new Field(
            actionsElemId, ALERTS_FIELD_NAME, findObjectType(
              elements,
              new ElemID(SALESFORCE, WORKFLOW_ALERT)
            ) as ObjectType, {}, true
          ),
          [FIELD_UPDATES_FIELD_NAME]: new Field(
            actionsElemId, FIELD_UPDATES_FIELD_NAME, findObjectType(
              elements,
              new ElemID(SALESFORCE, WORKFLOW_FIELD_UPDATE)
            ) as ObjectType, {}, true
          ),
          [OUTBOUND_MESSAGES_FIELD_NAME]: new Field(
            actionsElemId, OUTBOUND_MESSAGES_FIELD_NAME, findObjectType(
              elements,
              new ElemID(SALESFORCE, WORKFLOW_OUTBOUND_MESSAGE)
            ) as ObjectType, {}, true
          ),
          [TASKS_FIELD_NAME]: new Field(
            actionsElemId, TASKS_FIELD_NAME, findObjectType(
              elements,
              new ElemID(SALESFORCE, WORKFLOW_TASK)
            ) as ObjectType, {}, true
          ),
          [KNOWLEDGE_PUBLISHES_FIELD_NAME]: new Field(
            actionsElemId, KNOWLEDGE_PUBLISHES_FIELD_NAME, findObjectType(
              elements,
              new ElemID(SALESFORCE, WORKFLOW_KNOWLEDGE_PUBLISH)
            ) as ObjectType, {}, true
          ),
          [SEND_FIELD_NAME]: new Field(
            actionsElemId, SEND_FIELD_NAME, findObjectType(
              elements,
              new ElemID(SALESFORCE, WORKFLOW_SEND)
            ) as ObjectType, {}, true
          ),
        },
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
      wu(workflows).forEach(workflow => {
        workflow.value.rules.actions = {}
        const { actions } = workflow.value.rules
        const fieldsToAssign = [ALERTS_FIELD_NAME,
          FIELD_UPDATES_FIELD_NAME,
          OUTBOUND_MESSAGES_FIELD_NAME,
          TASKS_FIELD_NAME,
          KNOWLEDGE_PUBLISHES_FIELD_NAME,
          SEND_FIELD_NAME]
        fieldsToAssign.forEach(field => {
          if (workflow.value[field]) {
            _.assign(
              actions,
              { [field]: workflow.value[field] }
            )
          }
        })
      })
    }

    /**
     * Remove records that are already nested inside the workflow records to prevent data
     * duplications.
     * @param elements the list of elements
     */
    const removeNestedInstances = (elements: Element[]): void => {
      _.remove(elements, elem => isInstanceElement(elem) && (
        [WORKFLOW_ALERT,
          WORKFLOW_FIELD_UPDATE,
          WORKFLOW_OUTBOUND_MESSAGE,
          WORKFLOW_KNOWLEDGE_PUBLISH,
          WORKFLOW_TASK,
          WORKFLOW_SEND,
          WORKFLOW_RULE].includes(elem.type.elemID.name)
      ))
    }

    changeWorkFlowRule(allElements)
    changeWorkFlowInstances(allElements)
    removeNestedInstances(allElements)
  },
})

export default filterCreator
