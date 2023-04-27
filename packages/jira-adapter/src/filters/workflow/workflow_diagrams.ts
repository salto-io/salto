/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import _ from 'lodash'
import { BuiltinTypes, CORE_ANNOTATIONS, Element, ElemID, Field, isInstanceElement, ListType, ObjectType, Values } from '@salto-io/adapter-api'
import { elements as adapterComponentsElements } from '@salto-io/adapter-components'
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { addAnnotationRecursively, findObject } from '../../utils'
import { JIRA, WORKFLOW_STATUS_TYPE_NAME, WORKFLOW_TRANSITION_TYPE_NAME } from '../../constants'
import { FilterCreator } from '../../filter'
import { isWorkflowInstance, TransitionFrom, WorkflowInstance } from './types'
import JiraClient from '../../client/client'

const log = logger(module)

type StatusDiagramFields = {
    id: string
    name: string
    x: string
    y: string
    statusId: string
    initial?: boolean
}

type TransitionDiagramFields = {
    id: string
    name: string
    sourceId: string
    targetId: string
    sourceAngle: string
    targetAngle: string
}

type WorkflowLayout = {
    statuses: StatusDiagramFields[]
    transitions: TransitionDiagramFields[]
}

type WorkflowDiagramResponse = {
  layout: WorkflowLayout
}

type StatusDiagramDeploy = {
  id: string
  x?: string
  y?: string
}

type TransitionDiagramDeploy = {
  id: string
  sourceAngle?: string
  targetAngle?: string
  sourceId: string
  targetId: string
}

export type WorkflowDiagramMaps = {
  statusIdToStatus: Record<string, StatusDiagramFields>
  statusIdToStepId: Record<string, string>
  actionKeyToTransition: Record<string, TransitionDiagramFields>
}

const INITIAL_TRANSITION_TYPE = 'initial'

const addObjectTypesAnnotation = async (objectTypes: ObjectType[]): Promise<void> => {
  objectTypes.forEach(async objectType => {
    await addAnnotationRecursively(objectType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(objectType, CORE_ANNOTATIONS.UPDATABLE)
    objectType.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    objectType.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
  })
}

const createWorkflowDiagramFieldsTypes = (): {
  transitionFromType: ObjectType
  statusDirectionType: ObjectType
} => {
  const transitionFromType = new ObjectType({
    elemID: new ElemID(JIRA, 'TransitionFrom'),
    fields: {
      id: { refType: BuiltinTypes.STRING },
      sourceAngle: { refType: BuiltinTypes.NUMBER },
      targetAngle: { refType: BuiltinTypes.NUMBER },
    },
    path: [JIRA, adapterComponentsElements.TYPES_PATH, adapterComponentsElements.SUBTYPES_PATH, 'TransitionFrom'],
  })
  const statusDirectionType = new ObjectType({
    elemID: new ElemID(JIRA, 'StatusDirection'),
    fields: {
      x: { refType: BuiltinTypes.NUMBER },
      y: { refType: BuiltinTypes.NUMBER },
    },
    path: [JIRA, adapterComponentsElements.TYPES_PATH, adapterComponentsElements.SUBTYPES_PATH, 'StatusDirection'],
  })
  return { transitionFromType, statusDirectionType }
}

const isValidDiagramResponse = (response: unknown): response is WorkflowDiagramResponse => {
  const { error } = Joi.object({
    layout: Joi.object({
      statuses: Joi.array().items(Joi.object({
        statusId: Joi.number(),
        id: Joi.string(),
        x: Joi.number(),
        y: Joi.number(),
      }).unknown(true)),
      transitions: Joi.array().items(Joi.object({
        name: Joi.string(),
        id: Joi.string(),
        sourceId: Joi.string(),
        targetId: Joi.string(),
        sourceAngle: Joi.number(),
        targetAngle: Joi.number(),
      }).unknown(true)),
    }).unknown(true).required(),
  }).unknown(true).required().validate(response)

  if (error !== undefined) {
    return false
  }
  return true
}

const getTransitionKey = (from: string, name: string): string =>
  [from, name].join('-')

const convertTransitionKeyToActionKey = (key: string, statusIdToStepId: Record<string, string>):string => {
  const splittedKey = key.split('-')
  return [statusIdToStepId[splittedKey[0]], splittedKey.slice(1).join('-')].join('-')
}

const getTransitionFrom = (transitionName: string, statusIdToStepId: Record<string, string>,
  actionKeyToTransition: Record<string, TransitionDiagramFields>, statusId?: string)
  : TransitionFrom => {
  const actionKey = convertTransitionKeyToActionKey(getTransitionKey(statusId ?? '', transitionName), statusIdToStepId)
  if (actionKeyToTransition[actionKey] === undefined) {
    throw new Error(`Fail to get Workflow Transition ${transitionName} Diagram values`)
  }
  return { id: statusId === INITIAL_TRANSITION_TYPE ? undefined : statusId,
    sourceAngle: actionKeyToTransition[actionKey].sourceAngle,
    targetAngle: actionKeyToTransition[actionKey].targetAngle }
}

export const removeWorkflowDiagramFields = (element: WorkflowInstance): void => {
  element.value.statuses
    ?.filter(status => status.direction !== undefined)
    .forEach(status => {
      delete status.direction
    })
  element.value.transitions
    ?.filter((transition:Values) => transition.from !== undefined)
    .forEach((transition: Values) => {
      const { type } = transition
      if (type === INITIAL_TRANSITION_TYPE) {
        delete transition.from
      } else {
        transition.from = transition.from.map((from:TransitionFrom) => from.id)
      }
    })
}

const buildStatusDiagramFields = (workflow: WorkflowInstance, statusIdToStepId: Record<string, string>)
  :StatusDiagramDeploy[] | undefined =>
  workflow.value.statuses
    ?.map(status => (
      { id: statusIdToStepId[status.id as string],
        x: status.direction?.x,
        y: status.direction?.y }
    ))

const buildTransitionsDiagramFields = (workflow: WorkflowInstance, statusIdToStepId: Record<string, string>,
  actionKeyToTransition: Record<string, TransitionDiagramFields>)
  : (TransitionDiagramDeploy | undefined)[] | undefined =>
  workflow.value.transitions
    ?.flatMap(transition => {
      const { name, type } = transition
      return transition.from
        ?.map((from: TransitionFrom | string) => {
          if (typeof from !== 'string') {
            // transition type may be 'initial' or 'directed' in here
            const fromId = type === INITIAL_TRANSITION_TYPE ? INITIAL_TRANSITION_TYPE : from.id
            if (fromId === undefined || name === undefined) {
              throw new Error(`Fail to deploy Workflow ${workflow.value.name} Transition ${transition.name} diagram values`)
            }
            const transitionDiagramFields = actionKeyToTransition[getTransitionKey(statusIdToStepId[fromId], name)]
            if (transitionDiagramFields === undefined) {
              throw new Error(`Fail to deploy Workflow ${workflow.value.name} Transition ${transition.name} diagram values`)
            }
            return {
              id: transitionDiagramFields.id,
              sourceAngle: from.sourceAngle,
              targetAngle: from.targetAngle,
              sourceId: transitionDiagramFields.sourceId,
              targetId: transitionDiagramFields.targetId,
            }
          }
          return undefined
        })
    }).filter(val => !_.isUndefined(val))

export const isHasDiagramFields = (instance: WorkflowInstance): boolean => {
  const statusesDirections = instance.value.statuses
    ?.map(status => status.direction)
    .filter(direction => !_.isUndefined(direction))
  const transitionsFrom = instance.value.transitions
    .flatMap(transition => transition.from)
    .filter(from => !_.isUndefined(from) && typeof from !== 'string'
      && (!_.isUndefined(from.targetAngle) || !_.isUndefined(from.sourceAngle)))
  return (!_.isUndefined(statusesDirections) && statusesDirections.length > 0)
    || (!_.isUndefined(transitionsFrom) && transitionsFrom.length > 0)
}


export const deployWorkflowDiagram = async (workflow: WorkflowInstance, client: JiraClient,
  { statusIdToStepId, actionKeyToTransition }
  : WorkflowDiagramMaps): Promise<void> => {
  const statuses = buildStatusDiagramFields(workflow, statusIdToStepId)
  const transitions = buildTransitionsDiagramFields(workflow, statusIdToStepId, actionKeyToTransition)

  const response = await client.postPrivate({
    url: '/rest/workflowDesigner/latest/workflows',
    data: {
      draft: false,
      name: workflow.value.name,
      layout: { statuses, transitions },
    },
  })
  if (response.status !== 200) {
    throw new Error(`Fail to post Workflow ${workflow.value.name} diagram values with status ${response.status}`)
  }
}

export const buildDiagramMaps = (async ({ client, workflow }:
  {client: JiraClient
    workflow: WorkflowInstance
  }):Promise<WorkflowDiagramMaps> => {
  const { name } = workflow.value
  const statusIdToStatus: Record<string, StatusDiagramFields> = {}
  const statusIdToStepId: Record<string, string> = {}
  const actionKeyToTransition: Record<string, TransitionDiagramFields> = {}
  if (name === undefined) {
    throw new Error('Fail to get workflow diagram values because it\'s name is undefined')
  }
  const response = await client.getPrivate({
    url: '/rest/workflowDesigner/1.0/workflows',
    queryParams: {
      name,
    },
  })
  if (!isValidDiagramResponse(response.data)) {
    throw new Error(`Fail to get the workflow ${workflow.value.name} diagram values due to an invalid response`)
  }
  const { layout } = response.data
  layout.statuses.forEach(status => {
    statusIdToStatus[status.statusId] = status
  })
  layout.transitions.forEach(transition => {
    actionKeyToTransition[getTransitionKey(transition.sourceId, transition.name)] = transition
  })
  workflow.value.statuses?.forEach(status => {
    if (status.id !== undefined) {
      statusIdToStepId[status.id as string] = statusIdToStatus[status.id].id
    }
  })
  const initialStepId = layout.statuses
    .filter(status => status.initial) // there is always only one initial status
    .map(status => status.id)[0]
  statusIdToStepId.initial = initialStepId
  return { statusIdToStatus, statusIdToStepId, actionKeyToTransition }
})

export const insertWorkflowDiagramFields = (workflow: WorkflowInstance,
  { statusIdToStatus, statusIdToStepId, actionKeyToTransition }: WorkflowDiagramMaps)
  : void => {
  workflow.value.statuses?.forEach(status => {
    if (status.id !== undefined) {
      status.direction = { x: statusIdToStatus[status.id].x,
        y: statusIdToStatus[status.id].y }
    }
  })
  workflow.value.transitions?.forEach(transition => {
    if (transition.type === INITIAL_TRANSITION_TYPE) {
      transition.from = [getTransitionFrom(transition.name ?? '', statusIdToStepId, actionKeyToTransition, INITIAL_TRANSITION_TYPE)]
    } else {
      transition.from = transition
        .from?.map(from => (
          typeof from === 'string'
            ? getTransitionFrom(transition.name ?? '', statusIdToStepId, actionKeyToTransition, from)
            : from
        ))
    }
  })
}

const filter: FilterCreator = ({ client }) => ({
  name: 'workflowDiagramFilter',
  onFetch: async (elements: Element[]) => {
    const { transitionFromType, statusDirectionType } = createWorkflowDiagramFieldsTypes()
    await addObjectTypesAnnotation([transitionFromType, statusDirectionType])

    const transitionType = findObject(elements, WORKFLOW_TRANSITION_TYPE_NAME)
    if (transitionType !== undefined) {
      transitionType.fields.from = new Field(transitionType, 'transitionFrom', new ListType(transitionFromType))
      transitionType.fields.from.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
      transitionType.fields.from.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    }
    const workflowStatusType = findObject(elements, WORKFLOW_STATUS_TYPE_NAME)
    if (workflowStatusType !== undefined) {
      workflowStatusType.fields.direction = new Field(workflowStatusType, 'direction', statusDirectionType)
      workflowStatusType.fields.direction.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
      workflowStatusType.fields.direction.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    }
    elements.push(transitionFromType)
    elements.push(statusDirectionType)

    await Promise.all(elements
      .filter(isInstanceElement)
      .filter(isWorkflowInstance)
      .map(async workflow => {
        try {
          const workflowDiagramMaps = await buildDiagramMaps(
            { client, workflow }
          )
          insertWorkflowDiagramFields(workflow, workflowDiagramMaps)
        } catch (e) {
          log.error(e.message)
        }
      }))
  },
})
export default filter
