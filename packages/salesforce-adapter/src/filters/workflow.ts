import {
  Change,
  Element, ElemID, InstanceElement, isInstanceElement, Value,
} from 'adapter-api'
import { SaveResult, UpsertResult } from 'jsforce'
import { collections } from '@salto/lowerdash'
import _ from 'lodash'
import { API_NAME_SEPERATOR, INSTANCE_FULL_NAME_FIELD, SALESFORCE } from '../constants'
import { FilterCreator } from '../filter'
import { apiName, sfCase, toMetadataInfo } from '../transformers/transformer'

const { makeArray } = collections.array

export const WORKFLOW_FIELD_TO_TYPE = {
  alerts: 'workflow_alert',
  // eslint-disable-next-line @typescript-eslint/camelcase
  field_updates: 'workflow_field_update',
  // eslint-disable-next-line @typescript-eslint/camelcase
  flow_actions: 'workflow_flow_action',
  // eslint-disable-next-line @typescript-eslint/camelcase
  outbound_messages: 'workflow_outbound_message',
  // eslint-disable-next-line @typescript-eslint/camelcase
  knowledge_publishes: 'workflow_knowledge_publish',
  tasks: 'workflow_task',
  rules: 'workflow_rule',
}

export const WORKFLOW_TYPE_ID = new ElemID(SALESFORCE, 'workflow')
export const isWorkflowInstance = (instance: InstanceElement): boolean =>
  instance.type.elemID.isEqual(WORKFLOW_TYPE_ID)

const filterCreator: FilterCreator = ({ client }) => ({
  /**
   * Upon fetch, modify the full_names of the inner types of the workflow to contain
   * the workflow full_name (e.g. MyWorkflowAlert -> Lead.MyWorkflowAlert)
   */
  onFetch: async (elements: Element[]) => {
    const modifyInnerTypesFullName = (workflowInstance: InstanceElement): void =>
      Object.keys(WORKFLOW_FIELD_TO_TYPE)
        .forEach(fieldName => {
          const fieldValues = workflowInstance.value[fieldName]
          makeArray(fieldValues)
            .forEach(innerValue => {
              innerValue[INSTANCE_FULL_NAME_FIELD] = [apiName(workflowInstance),
                innerValue[INSTANCE_FULL_NAME_FIELD]].join(API_NAME_SEPERATOR)
            })
        })

    const modifyPath = (workflowInstance: InstanceElement): void => {
      if (workflowInstance.path) {
        workflowInstance.path = [...workflowInstance.path.slice(0, -2),
          'workflow_rules',
          `${workflowInstance.elemID.name}_workflow_rules`]
      }
    }

    elements
      .filter(isInstanceElement)
      .filter(isWorkflowInstance)
      .forEach(wfInst => {
        modifyInnerTypesFullName(wfInst)
        modifyPath(wfInst)
      })
  },

  /**
   * Upon update, create/update/delete each inner type of the workflow separately
   */
  onUpdate: async (before: Element, after: Element, _changes: ReadonlyArray<Change>):
    Promise<(SaveResult| UpsertResult)[]> => {
    if (!(isInstanceElement(before) && isInstanceElement(after) && isWorkflowInstance(after))) {
      return []
    }

    const handleWorkflowChanges = async (fieldName: string, typeName: string):
      Promise<(SaveResult | UpsertResult)[][]> => {
      const getFullNameToFieldValue = (inst: InstanceElement): Record<string, Value> =>
        _(makeArray(inst.value[fieldName]))
          .map(val => [val[INSTANCE_FULL_NAME_FIELD], val])
          .fromPairs()
          .value()

      const nameToBeforeVal = getFullNameToFieldValue(before)
      const nameToAfterVal = getFullNameToFieldValue(after)
      if (_.isEqual(nameToBeforeVal, nameToAfterVal)) {
        return Promise.resolve([])
      }
      return Promise.all([
        client.upsert(typeName,
          Object.entries(nameToAfterVal)
            .filter(([fullName, _val]) => _.isUndefined(nameToBeforeVal[fullName]))
            .map(([fullName, val]) => toMetadataInfo(fullName, val))),
        client.update(typeName,
          Object.entries(nameToAfterVal)
            .filter(([fullName, val]) => nameToBeforeVal[fullName]
              && !_.isEqual(val, nameToBeforeVal[fullName]))
            .map(([fullName, val]) => toMetadataInfo(fullName, val))),
        client.delete(typeName,
          Object.keys(nameToBeforeVal)
            .filter(fullName => _.isUndefined(nameToAfterVal[fullName]))),
      ])
    }

    return _.flatten(_.flatten((await Promise.all(
      Object.entries(WORKFLOW_FIELD_TO_TYPE)
        .map(([name, type]) => handleWorkflowChanges(name, sfCase(type)))
    ))))
  },

  /**
   * Upon add, create each inner type of the workflow separately
   */
  onAdd: async (after: Element): Promise<SaveResult[]> => {
    if (!(isInstanceElement(after) && isWorkflowInstance(after))) {
      return []
    }
    const afterWorkflowInstance = after as InstanceElement
    return _.flatten(await Promise.all(Object.entries(WORKFLOW_FIELD_TO_TYPE)
      .map(([name, type]) =>
        client.upsert(sfCase(type),
          makeArray(afterWorkflowInstance.value[name])
            .map(val => toMetadataInfo(val[INSTANCE_FULL_NAME_FIELD], val))))))
  },

  /**
   * Upon remove, delete each inner type of the workflow separately
   */
  onRemove: async (before: Element): Promise<SaveResult[]> => {
    if (!(isInstanceElement(before) && isWorkflowInstance(before))) {
      return []
    }
    return _.flatten(await Promise.all(Object.entries(WORKFLOW_FIELD_TO_TYPE)
      .map(([name, type]) =>
        client.delete(sfCase(type),
          makeArray(before.value[name])
            .map(val => val[INSTANCE_FULL_NAME_FIELD])))))
  },
})

export default filterCreator
