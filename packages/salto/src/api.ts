import {
  ObjectType, InstanceElement, Element, Value,
} from 'adapter-api'
import {
  applyActions,
} from './core/core'
import {
  getInstancesOfType, importInstancesOfType, deleteInstancesOfType,
} from './core/records'
import initAdapters from './core/adapters/adapters'
import {
  getPlan, Plan, PlanItem,
} from './core/plan'
import { Blueprint, getAllElements } from './core/blueprint'
import State from './state/state'
import { findElement, SearchResult } from './core/search'
import { mergeElements } from './core/merger'
import validateElements from './core/validator'
import { Workspace } from './workspace/workspace'
import { discoverChanges } from './core/discover'

export const mergeAndValidate = (elements: Element[]): Element[] => {
  const { merged: mergedElements, errors: mergeErrors } = mergeElements(elements)
  if (mergeErrors.length > 0) {
    throw new Error(`Failed to merge blueprints: ${mergeErrors.map(e => e.message).join('\n')}`)
  }

  const validationErrors = validateElements(mergedElements)

  if (validationErrors.length > 0) {
    throw new Error(`Failed to validate blueprints:
    ${validationErrors.map(e => e.message).join('\n')}`)
  }

  return mergedElements
}

const applyActionOnState = async (
  state: State,
  action: string,
  element: Promise<Element>
): Promise<void> => {
  switch (action) {
    case 'add':
    case 'modify':
      return state.update([await element])
    case 'remove':
      return state.remove([await element])
    default: throw new Error(`Unsupported action ${action}`)
  }
}

export const plan = async (
  blueprints: Blueprint[],
): Promise<Plan> => {
  const elements = mergeAndValidate(await getAllElements(blueprints))
  const state = new State()
  return getPlan(await state.get(), elements)
}

export const apply = async (
  blueprints: Blueprint[],
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
  shouldApply: (plan: Plan) => Promise<boolean>,
  reportProgress: (action: PlanItem) => void,
  force = false
): Promise<Plan> => {
  const elements = mergeAndValidate(await getAllElements(blueprints))
  const state = new State()
  try {
    const actionPlan = getPlan(await state.get(), elements)
    if (force || await shouldApply(actionPlan)) {
      const [adapters] = await initAdapters(elements, fillConfig)
      await applyActions(
        actionPlan,
        adapters,
        reportProgress,
        (action, element) => applyActionOnState(state, action, element)
      )
    }
    return actionPlan
  } finally {
    await state.flush()
  }
}

export const discover = async (
  workspace: Workspace,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<void> => {
  const state = new State()
  const { changes, elements } = await discoverChanges(
    workspace.elements, await state.get(), fillConfig
  )
  state.override(elements)
  await workspace.updateBlueprints(...changes)
  await Promise.all([workspace.flush(), state.flush()])
}

export const describeElement = async (
  searchWords: string[],
  blueprints: Blueprint[] = [],
): Promise<SearchResult> => {
  const allElements = await getAllElements(blueprints)
  return findElement(searchWords, allElements)
}

export const exportToCsv = async (
  typeId: string,
  blueprints: Blueprint[],
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<AsyncIterable<InstanceElement[]>> => {
  // Find the corresponding element in the state
  const state = new State()
  const stateElements = await state.get()
  const type = stateElements.find(elem => elem.elemID.getFullName() === typeId)
  if (!type) {
    throw new Error(`Couldn't find the type you are looking for: ${typeId}. Have you run salto discover yet?`)
  }
  const elements = mergeAndValidate(await getAllElements(blueprints))
  const [adapters] = await initAdapters(elements, fillConfig)

  return getInstancesOfType(type as ObjectType, adapters)
}

export const importFromCsvFile = async (
  typeId: string,
  records: Value[],
  blueprints: Blueprint[],
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<void> => {
  // Find the corresponding element in the state
  const state = new State()
  const stateElements = await state.get()
  const type = stateElements.find(elem => elem.elemID.getFullName() === typeId)
  if (!type) {
    throw new Error(`Couldn't find the type you are looking for: ${typeId}. Have you run salto discover yet?`)
  }
  const elements = mergeAndValidate(await getAllElements(blueprints))
  const [adapters] = await initAdapters(elements, fillConfig)
  await importInstancesOfType(type as ObjectType, records, adapters)
}

export const deleteFromCsvFile = async (
  typeId: string,
  records: Value[],
  blueprints: Blueprint[],
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<void> => {
  // Find the corresponding element in the state
  const state = new State()
  const stateElements = await state.get()
  const type = stateElements.find(elem => elem.elemID.getFullName() === typeId)
  if (!type) {
    throw new Error(`Couldn't find the type you are looking for: ${typeId}. Have you run salto discover yet?`)
  }
  const elements = mergeAndValidate(await getAllElements(blueprints))
  const [adapters] = await initAdapters(elements, fillConfig)
  await deleteInstancesOfType(type as ObjectType, records, adapters)
}
