/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { Element, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuard, validateReferenceExpression } from './utils'

export type DependencyDirection = 'input' | 'output'

type DependencyOccurrence = {
  direction?: DependencyDirection
  location?: ReferenceExpression
}
export type DetailedDependency = {
  reference: ReferenceExpression
  occurrences?: DependencyOccurrence[]
}
export type FlatDetailedDependency = {
  reference: ReferenceExpression
} & DependencyOccurrence

const dependencyOccurrenceSchema = Joi.object({
  direction: Joi.string().valid('input', 'output').optional(),
  location: Joi.custom(validateReferenceExpression('location')).optional(),
})

const detailedDependencySchema = Joi.object({
  reference: Joi.custom(validateReferenceExpression('reference')).required(),
  occurrences: Joi.array().items(dependencyOccurrenceSchema).optional(),
})

export const isDetailedDependency = createSchemeGuard<DetailedDependency>(
  detailedDependencySchema,
  'received invalid detailed dependency',
)

/**
 * Add additional generated dependencies while keeping the structure sorted and filtered
 */
export const extendGeneratedDependencies = (elem: Element, newDependencies: FlatDetailedDependency[]): void => {
  if (newDependencies.length === 0) {
    return
  }

  /**
   * Remove entries that are not adding information:
   * - For each direction (input/output), prefer an entry with a specific location
   * - For each location, prefer an entry with a specific direction
   * - Do not include a no-location no-direction entry if any other entries are listed
   */
  const preferSpecific = (occurrences?: DependencyOccurrence[]): DependencyOccurrence[] | undefined => {
    if (
      occurrences === undefined ||
      occurrences.length === 0 ||
      occurrences.every(oc => oc.location === undefined && oc.direction === undefined)
    ) {
      return undefined
    }

    const byDirection = _.groupBy(occurrences, oc => oc.direction ?? '')
    const byLocation = _.groupBy(occurrences, oc => oc.location?.elemID.getFullName() ?? '')
    return occurrences.filter(
      ({ location, direction }) =>
        (location !== undefined &&
          (direction !== undefined ||
            byLocation[location.elemID.getFullName()]?.every(entry => entry.direction === undefined))) ||
        (direction !== undefined &&
          (location !== undefined || byDirection[direction]?.every(entry => entry.location === undefined))),
    )
  }
  const occurrenceIndex = (item: DependencyOccurrence): string =>
    [item.direction ?? '', item.location?.elemID.getFullName() ?? ''].join(':')

  const existingDepsLookup = _.keyBy(
    collections.array.makeArray(elem.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]),
    ({ reference }) => reference.elemID.getFullName(),
  )
  const newDepsLookup = _.mapValues(
    _.groupBy(newDependencies, ({ reference }) => reference.elemID.getFullName()),
    items => ({
      reference: items[0].reference,
      occurrences: _.uniqBy(
        items.map(({ reference: _ref, ...occurrences }) => occurrences),
        occurrenceIndex,
      ),
    }),
  )
  const allDeps: Record<string, DetailedDependency> = _.mergeWith(
    {},
    existingDepsLookup,
    newDepsLookup,
    (existingDeps: DetailedDependency | undefined, newDeps: DetailedDependency) => {
      if (existingDeps === undefined) {
        return newDeps
      }
      return {
        reference: newDeps.reference,
        occurrences: _.sortedUniqBy(
          _.sortBy([...(existingDeps.occurrences ?? []), ...(newDeps.occurrences ?? [])], occurrenceIndex),
          occurrenceIndex,
        ),
      }
    },
  )

  const filteredUniqueDeps = Object.values(allDeps)
    .map(dep => ({
      ...dep,
      occurrences: preferSpecific(dep.occurrences),
    }))
    .map(dep => (dep.occurrences === undefined ? _.omit(dep, 'occurrences') : dep))

  elem.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] = _.sortBy(filteredUniqueDeps, ({ reference }) =>
    reference.elemID.getFullName(),
  )
}
