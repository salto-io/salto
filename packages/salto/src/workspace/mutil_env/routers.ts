import { getChangeElement } from 'adapter-api'
import _ from 'lodash'
import { ElementsSource } from '../elements_source'
import {
  projectChange, projectElementToEnv, createAddChange, createRemoveChange,
} from './projections'
import { DetailedChange } from '../../core/plan'

export interface RoutedChanges {
    primarySource?: DetailedChange[]
    commonSource?: DetailedChange[]
    secondarySources?: Record<string, DetailedChange[]>
}

export const routeFetch = async (
  change: DetailedChange,
  primarySource: ElementsSource,
  commonSource: ElementsSource
): Promise<RoutedChanges> => {
  if (change.action === 'add') {
    return { commonSource: [change] }
  }
  const currentChanges = await projectChange(change, primarySource)
  const commonChanges = await projectChange(change, commonSource)
  return {
    primarySource: currentChanges,
    commonSource: commonChanges,
  }
}

export const routeCompact = async (
  change: DetailedChange,
  primarySource: ElementsSource,
  commonSource: ElementsSource,
  secondarySources: Record<string, ElementsSource>
): Promise<RoutedChanges> => {
  // This is an add change, which means the element is not in common.
  // so we will add it to the current action enviornment.
  if (change.action === 'add') {
    return { primarySource: [change] }
  }
  // In remove and modify changes, we need to remove the current value from
  // common, add it to the inactive envs, and apply the actual change to the
  // active env.
  const changeElement = getChangeElement(change)
  const currentEnvChanges = await projectChange(change, primarySource)
  const commonChangeProjection = await projectElementToEnv(changeElement, commonSource)
  if (!commonChangeProjection) {
    return { primarySource: currentEnvChanges }
  }
  // This means that the change effects the common source.
  // Get will *always* return an element here, since new elements were already routed to
  // the target source.
  const currentCommonElement = await commonSource.get(changeElement.elemID)
  // Keeping the parser happy, this will never happen (see above)
  if (!currentCommonElement) {
    throw Error('Missing element in common')
  }
  // Add the changed part of common to the target source
  const addCommonProjectionToCurrentChanges = await projectChange(
    createAddChange(commonChangeProjection),
    primarySource
  )
  // Add the old value of common to the inactive sources
  const secondaryChanges = _.fromPairs(
    await Promise.all(
      _.entries(secondarySources)
        .map(([name, source]) => [
          name,
          projectChange(createAddChange(currentCommonElement), source),
        ])
    )
  )
  return {
    primarySource: [...currentEnvChanges, ...addCommonProjectionToCurrentChanges],
    commonSource: [createRemoveChange(currentCommonElement)],
    secondarySources: secondaryChanges,
  }
}

export const routeChanges = async (
  changes: DetailedChange[],
  primarySource: ElementsSource,
  commonSource: ElementsSource,
  secondarySources: Record<string, ElementsSource>,
  compact: boolean
): Promise<RoutedChanges> => {
  const routedChanges = await Promise.all(changes.map(c => (compact
    ? routeCompact(c, primarySource, commonSource, secondarySources)
    : routeFetch(c, primarySource, commonSource))))
  return {
    primarySource: _.flatten(routedChanges.map(r => r.primarySource || [])),
    commonSource: _.flatten(routedChanges.map(r => r.commonSource || [])),
    secondarySources: _.mergeWith(
      {},
      ...routedChanges.map(r => r.secondarySources || {}),
      (objValue: DetailedChange[], srcValue: DetailedChange[]) => [...objValue, ...srcValue]
    ),
  }
}
