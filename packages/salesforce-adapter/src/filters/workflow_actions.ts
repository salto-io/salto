import {
  Element, isObjectType, ObjectType, ElemID, Field, isInstanceElement,
} from 'adapter-api'
import _ from 'lodash'
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
   * @param elements
   */
  onFetch: async (allElements: Element[]): Promise<void> => {
    /**
     * Modifies the workflow_rule object type to contain the various types of actions in
     * the actions field.
     * @param elements the list of elements
     */
    const changeWorkFlowRule = (elements: Element[]): void => {
      const objectTypes = elements
        .filter(isObjectType)
      const alert = objectTypes
        .find(objType => objType.elemID.name === WORKFLOW_ALERT) as ObjectType
      const fieldUpdate = objectTypes
        .find(objType => objType.elemID.name === WORKFLOW_FIELD_UPDATE) as ObjectType
      const outboundMessage = objectTypes
        .find(objType => objType.elemID.name === WORKFLOW_OUTBOUND_MESSAGE) as ObjectType
      const task = objectTypes
        .find(objType => objType.elemID.name === WORKFLOW_TASK) as ObjectType
      const knowledgePublish = objectTypes
        .find(objType => objType.elemID.name === WORKFLOW_KNOWLEDGE_PUBLISH) as ObjectType
      const send = objectTypes
        .find(objType => objType.elemID.name === WORKFLOW_SEND) as ObjectType
      const workFlowRuleObjectType = objectTypes
        .find(objType => objType.elemID.name === WORKFLOW_RULE)
      if (!workFlowRuleObjectType) {
        return
      }
      const actionField = workFlowRuleObjectType.fields[ACTIONS]
      const actionsElemId = new ElemID(SALESFORCE, WORKFLOW_ACTIONS)
      const workflowActionsType = new ObjectType({
        elemID: actionsElemId,
        fields: {
          [ALERTS_FIELD_NAME]: new Field(
            actionsElemId, ALERTS_FIELD_NAME, alert, {}, true
          ),
          [FIELD_UPDATES_FIELD_NAME]: new Field(
            actionsElemId, FIELD_UPDATES_FIELD_NAME, fieldUpdate, {}, true
          ),
          [OUTBOUND_MESSAGES_FIELD_NAME]: new Field(
            actionsElemId, OUTBOUND_MESSAGES_FIELD_NAME, outboundMessage, {}, true
          ),
          [TASKS_FIELD_NAME]: new Field(
            actionsElemId, TASKS_FIELD_NAME, task, {}, true
          ),
          [KNOWLEDGE_PUBLISHES_FIELD_NAME]: new Field(
            actionsElemId, KNOWLEDGE_PUBLISHES_FIELD_NAME, knowledgePublish, {}, true
          ),
          [SEND_FIELD_NAME]: new Field(
            actionsElemId, SEND_FIELD_NAME, send, {}, true
          ),
        },
      })
      workflowActionsType.path = ['types', 'subtypes', WORKFLOW_ACTIONS]
      actionField.type = workflowActionsType
      elements.push(workflowActionsType)
    }

    /**
     * Change the instances to contain the various action data inside their actions field
     * @param elements the list of elements
     */
    const changeWorkFlowInstances = (elements: Element[]): void => {
      const instances = elements
        .filter(isInstanceElement)
      const workflows = instances.filter(instance => instance.type.elemID.name === 'workflow')
      workflows.forEach(workflow => {
        workflow.value.rules.actions = {}
        const { actions } = workflow.value.rules
        if (workflow.value[ALERTS_FIELD_NAME]) {
          _.assign(
            actions,
            { [ALERTS_FIELD_NAME]: workflow.value[ALERTS_FIELD_NAME] }
          )
        }
        if (workflow.value[FIELD_UPDATES_FIELD_NAME]) {
          _.assign(
            actions,
            { [FIELD_UPDATES_FIELD_NAME]: workflow.value[FIELD_UPDATES_FIELD_NAME] }
          )
        }
        if (workflow.value[OUTBOUND_MESSAGES_FIELD_NAME]) {
          _.assign(
            actions,
            { [OUTBOUND_MESSAGES_FIELD_NAME]: workflow.value[OUTBOUND_MESSAGES_FIELD_NAME] }
          )
        }
        if (workflow.value[TASKS_FIELD_NAME]) {
          _.assign(
            actions,
            { [TASKS_FIELD_NAME]: workflow.value[TASKS_FIELD_NAME] }
          )
        }
        if (workflow.value[KNOWLEDGE_PUBLISHES_FIELD_NAME]) {
          _.assign(
            actions,
            { [KNOWLEDGE_PUBLISHES_FIELD_NAME]: workflow.value[KNOWLEDGE_PUBLISHES_FIELD_NAME] }
          )
        }
        if (workflow.value[SEND_FIELD_NAME]) {
          _.assign(
            actions,
            { [SEND_FIELD_NAME]: workflow.value[SEND_FIELD_NAME] }
          )
        }
      })
    }

    /**
     * Remove records that are already nested inside the workflow records to prevent data
     * duplications.
     * @param elements the list of elements
     */
    const removeNestedInstances = (elements: Element[]): void => {
      _.remove(elements, elem => isInstanceElement(elem) && (
        elem.type.elemID.name === 'workflow_alert'
          || elem.type.elemID.name === 'workflow_field_update'
          || elem.type.elemID.name === 'workflow_outbound_message'
          || elem.type.elemID.name === 'workflow_knowledge_publish'
          || elem.type.elemID.name === 'workflow_task'
          || elem.type.elemID.name === 'workflow_send'
          || elem.type.elemID.name === 'workflow_rule'
      ))
    }

    changeWorkFlowRule(allElements)
    changeWorkFlowInstances(allElements)
    removeNestedInstances(allElements)
  },
})

export default filterCreator
