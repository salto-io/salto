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

import { BuiltinTypes, CORE_ANNOTATIONS, Element, ElemID, Field, isInstanceElement, ListType, ObjectType } from '@salto-io/adapter-api'
import { elements as adapterComponentsElements } from '@salto-io/adapter-components'
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { addAnnotationRecursively, findObject, setFieldDeploymentAnnotations } from '../../utils'
import { JIRA, WORKFLOW_STATUS_TYPE_NAME, WORKFLOW_TRANSITION_TYPE_NAME, WORKFLOW_TYPE_NAME } from '../../constants'
import { FilterCreator } from '../../filter'
import { isWorkflowInstance, StatusLocation, TransitionFrom, WorkflowInstance } from './types'
import JiraClient from '../../client/client'

const log = logger(module)

type StatusDiagramFields = {
    id: string
    name: string
    x?: string
    y?: string
    statusId: string
    initial?: boolean
}

type TransitionDiagramFields = {
    id: string
    name: string
    sourceId: string
    targetId: string
    sourceAngle?: string
    targetAngle?: string
}

type WorkflowLayout = {
    statuses: StatusDiagramFields[]
    transitions: TransitionDiagramFields[]
    loopedTransitionContainer?: StatusLocation
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
  loopedTransitionContainer?: StatusLocation
}

const INITIAL_TRANSITION_TYPE = 'initial'

const addObjectTypesAnnotation = async (objectTypes: ObjectType[]): Promise<void> => {
  objectTypes.forEach(async objectType => {
    await addAnnotationRecursively(objectType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(objectType, CORE_ANNOTATIONS.UPDATABLE)
  })
}

const createWorkflowDiagramFieldsTypes = (): {
  transitionFromType: ObjectType
  statusLocationType: ObjectType
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
  const statusLocationType = new ObjectType({
    elemID: new ElemID(JIRA, 'StatusLocation'),
    fields: {
      x: { refType: BuiltinTypes.NUMBER },
      y: { refType: BuiltinTypes.NUMBER },
    },
    path: [JIRA, adapterComponentsElements.TYPES_PATH, adapterComponentsElements.SUBTYPES_PATH, 'StatusLocation'],
  })
  return { transitionFromType, statusLocationType }
}
const WORKFLOW_DIAGRAM_SCHEME = Joi.object({
  layout: Joi.object({
    statuses: Joi.array().items(Joi.object({
      statusId: Joi.number(),
      id: Joi.string().required(),
      x: Joi.number(),
      y: Joi.number(),
    }).unknown(true)),
    transitions: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      id: Joi.string().required(),
      sourceId: Joi.string(),
      targetId: Joi.string(),
      sourceAngle: Joi.number(),
      targetAngle: Joi.number(),
    }).unknown(true)),
    loopedTransitionContainer: Joi.object({
      x: Joi.number(),
      y: Joi.number(),
    }).unknown(true),
  }).unknown(true).required(),
}).unknown(true).required()

const isWorkflowDiagramResponse = createSchemeGuard<WorkflowDiagramResponse>(WORKFLOW_DIAGRAM_SCHEME, 'Received an invalid workflow diagram response')

const getTransitionKey = (from: string, name: string): string =>
  [from, name].join('-')

const convertTransitionKeyToActionKey = (key: string, statusIdToStepId: Record<string, string>):string => {
  const splittedKey = key.split('-')
  return [statusIdToStepId[splittedKey[0]], splittedKey.slice(1).join('-')].join('-')
}

const getTransitionFrom = (transitionName: string, statusIdToStepId: Record<string, string>,
  actionKeyToTransition: Record<string, TransitionDiagramFields>, statusId: string)
  : TransitionFrom => {
  const actionKey = convertTransitionKeyToActionKey(
    getTransitionKey(statusId, transitionName), statusIdToStepId
  )
  if (actionKeyToTransition[actionKey] === undefined) {
    throw new Error(`Fail to get Workflow Transition ${transitionName} Diagram values`)
  }
  return { id: statusId === INITIAL_TRANSITION_TYPE ? undefined : statusId,
    sourceAngle: actionKeyToTransition[actionKey].sourceAngle,
    targetAngle: actionKeyToTransition[actionKey].targetAngle }
}


export const removeWorkflowDiagramFields = (element: WorkflowInstance): void => {
  element.value.statuses
    ?.filter(status => status.location !== undefined)
    .forEach(status => {
      delete status.location
    })
  Object.values(element.value.transitions)
    .filter(transition => transition.from !== undefined)
    .forEach(transition => {
      const { type } = transition
      if (type === INITIAL_TRANSITION_TYPE) {
        delete transition.from
      } else if (transition.from !== undefined) {
        transition.from = transition.from.map(from => (typeof from !== 'string' && from.id !== undefined
          ? from.id
          : from))
      }
    })
  delete element.value.diagramInitialEntry
  delete element.value.diagramGlobalLoopedTransition
}

const buildStatusDiagramFields = (workflow: WorkflowInstance, statusIdToStepId: Record<string, string>)
  :StatusDiagramDeploy[] | undefined => {
  const statuses = workflow.value.statuses
    ?.map(status => {
      if (typeof status.id !== 'string') {
        throw new Error(`Fail to deploy Workflow ${workflow.value.name} Status ${status.name} Diagram values`)
      }
      return { id: statusIdToStepId[status.id],
        x: status.location?.x,
        y: status.location?.y }
    })
  if (workflow.value.diagramInitialEntry && statuses) {
    statuses.push({
      id: statusIdToStepId.initial,
      x: workflow.value.diagramInitialEntry.x,
      y: workflow.value.diagramInitialEntry.y,
    })
  }
  return statuses
}

const buildTransitionsDiagramFields = (workflow: WorkflowInstance, statusIdToStepId: Record<string, string>,
  actionKeyToTransition: Record<string, TransitionDiagramFields>)
  : (TransitionDiagramDeploy | undefined)[] | undefined =>
  Object.values(workflow.value.transitions)
    .flatMap(transition => {
      const { name, type } = transition
      return transition.from
        ?.map((from: TransitionFrom | string) => {
          if (typeof from !== 'string') {
            // transition type may be 'initial' or 'directed' in here
            const fromId = type === INITIAL_TRANSITION_TYPE ? INITIAL_TRANSITION_TYPE : from.id
            if (fromId === undefined || name === undefined) {
              throw new Error(`Fail to deploy Workflow ${workflow.value.name} Transition ${name} diagram values`)
            }
            const transitionDiagramFields = actionKeyToTransition[getTransitionKey(statusIdToStepId[fromId], name)]
            if (transitionDiagramFields === undefined) {
              throw new Error(`Fail to deploy Workflow ${workflow.value.name} Transition ${name} diagram values`)
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
    }).filter(val => val !== undefined)

export const hasDiagramFields = (instance: WorkflowInstance): boolean => {
  const statusesLocations = instance.value.statuses
    ?.map(status => status.location)
    .filter(location => location !== undefined)
  const transitionsFrom = Object.values(instance.value.transitions)
    .flatMap(transition => transition.from)
    .filter(from => from !== undefined && typeof from !== 'string'
      && (from.targetAngle !== undefined || from.sourceAngle !== undefined))
  return (statusesLocations !== undefined && statusesLocations.length > 0)
    || (transitionsFrom !== undefined && transitionsFrom.length > 0)
}


const buildDiagramMaps = async ({ client, workflow }:
  {
    client: JiraClient
    workflow: WorkflowInstance
  }):Promise<WorkflowDiagramMaps> => {
  const { name } = workflow.value
  const statusIdToStatus: Record<string, StatusDiagramFields> = {}
  const statusIdToStepId: Record<string, string> = {}
  const actionKeyToTransition: Record<string, TransitionDiagramFields> = {}
  if (name === undefined) {
    throw new Error('Fail to get workflow diagram values because its name is undefined')
  }
  const response = await client.getPrivate({
    url: '/rest/workflowDesigner/1.0/workflows',
    queryParams: {
      name,
    },
  })
  if (!isWorkflowDiagramResponse(response.data)) {
    throw new Error(`Fail to get the workflow ${workflow.value.name} diagram values due to an invalid response`)
  }
  const { layout } = response.data
  layout.statuses.forEach(status => {
    if (status.initial) {
      statusIdToStatus.initial = status
    } else {
      statusIdToStatus[status.statusId] = status
    }
  })
  layout.transitions.forEach(transition => {
    actionKeyToTransition[getTransitionKey(transition.sourceId, transition.name)] = transition
  })
  workflow.value.statuses?.forEach(status => {
    if (typeof status.id === 'string') {
      statusIdToStepId[status.id as string] = statusIdToStatus[status.id as string].id
    }
  })
  const [initialStepId] = layout.statuses
    .filter(status => status.initial) // there is always only one initial status
    .map(status => status.id)
  statusIdToStepId.initial = initialStepId
  const { loopedTransitionContainer } = layout
  return { statusIdToStatus, statusIdToStepId, actionKeyToTransition, loopedTransitionContainer }
}

const insertWorkflowDiagramFields = (workflow: WorkflowInstance,
  { statusIdToStatus, statusIdToStepId, actionKeyToTransition, loopedTransitionContainer }: WorkflowDiagramMaps)
  : void => {
  workflow.value.statuses?.forEach(status => {
    if (typeof status.id === 'string') {
      status.location = { x: statusIdToStatus[status.id as string].x,
        y: statusIdToStatus[status.id as string].y }
    }
  })
  workflow.value.diagramInitialEntry = {
    x: statusIdToStatus.initial?.x,
    y: statusIdToStatus.initial?.y,
  }
  workflow.value.diagramGlobalLoopedTransition = loopedTransitionContainer
  Object.values(workflow.value.transitions).forEach(transition => {
    const transitionName = transition.name
    if (transition.type === INITIAL_TRANSITION_TYPE && transitionName !== undefined) {
      transition.from = [getTransitionFrom(
        transitionName, statusIdToStepId, actionKeyToTransition, INITIAL_TRANSITION_TYPE
      )]
    } else if (transition.from !== undefined && transitionName !== undefined) {
      transition.from = transition
        .from.map(from => (
          typeof from === 'string'
            ? getTransitionFrom(transitionName, statusIdToStepId, actionKeyToTransition, from)
            : from
        ))
    }
  })
}

export const deployWorkflowDiagram = async (
  {
    instance,
    client,
  }
  : {
    instance: WorkflowInstance
    client: JiraClient
  }): Promise<void> => {
  const workflowDiagramMaps = await buildDiagramMaps({ client, workflow: instance })
  const { statusIdToStepId, actionKeyToTransition } = workflowDiagramMaps
  const statuses = buildStatusDiagramFields(instance, statusIdToStepId)
  const transitions = buildTransitionsDiagramFields(instance, statusIdToStepId, actionKeyToTransition)
  const layout = instance.value.diagramGlobalLoopedTransition !== undefined
    ? { statuses, transitions, loopedTransitionContainer: instance.value.diagramGlobalLoopedTransition }
    : { statuses, transitions }
  const response = await client.postPrivate({
    url: '/rest/workflowDesigner/latest/workflows',
    data: {
      draft: false,
      name: instance.value.name,
      layout,
    },
  })
  if (response.status !== 200) {
    throw new Error(`Fail to post Workflow ${instance.value.name} diagram values with status ${response.status}`)
  }
}

const filter: FilterCreator = ({ client }) => ({
  name: 'workflowDiagramFilter',
  onFetch: async (elements: Element[]) => {
    const { transitionFromType, statusLocationType } = createWorkflowDiagramFieldsTypes()
    await addObjectTypesAnnotation([transitionFromType, statusLocationType])

    const transitionType = findObject(elements, WORKFLOW_TRANSITION_TYPE_NAME)
    if (transitionType !== undefined) {
      transitionType.fields.from = new Field(transitionType, 'transitionFrom', new ListType(transitionFromType))
      setFieldDeploymentAnnotations(transitionType, 'from')
    }
    const workflowStatusType = findObject(elements, WORKFLOW_STATUS_TYPE_NAME)
    if (workflowStatusType !== undefined) {
      workflowStatusType.fields.location = new Field(workflowStatusType, 'location', statusLocationType)
      setFieldDeploymentAnnotations(workflowStatusType, 'location')
    }
    const workflowType = findObject(elements, WORKFLOW_TYPE_NAME)
    if (workflowType !== undefined) {
      workflowType.fields.diagramInitialEntry = new Field(workflowType, 'diagramInitialEntry', statusLocationType)
      setFieldDeploymentAnnotations(workflowType, 'diagramInitialEntry')
      workflowType.fields.diagramGlobalLoopedTransition = new Field(workflowType, 'diagramGlobalLoopedTransition', statusLocationType)
      setFieldDeploymentAnnotations(workflowType, 'diagramGlobalLoopedTransition')
    }
    elements.push(transitionFromType)
    elements.push(statusLocationType)

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
          log.error(`Failed to get the workflow diagram of ${workflow.elemID.getFullName()}: ${(e as Error).message}`)
        }
      }))
  },
})
export default filter
