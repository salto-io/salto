/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Element, isInstanceElement, InstanceElement, ElemID } from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { DAG } from '@salto-io/dag'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { NoOptionsFilterCreator } from '../filter_utils'

const log = logger(module)

export type PathMapperFunc = (instance: InstanceElement) =>
  | {
      // the elem id of the instance to nest this instance's path under
      nestUnder: ElemID
      // the suffix to add when nesting
      pathSuffix: string[]
    }
  | undefined

/**
 * Shared filter for customizing element paths based on other elements, with a custom function.
 * Dependencies are used for correct traversal (cycles should be avoided).
 * Paths are nested as follows: <the path of the nestUnder instance, excluding the filename>/<path suffix>
 */
export const customPathsFilterCreator: <TResult extends void | filter.FilterResult = void>(
  pathMapper: PathMapperFunc,
) => NoOptionsFilterCreator<TResult> = pathMapper => () => ({
  name: 'customPaths',
  onFetch: async (elements: Element[]): Promise<void> => {
    const instancesByElemID = _.keyBy(elements.filter(isInstanceElement), e => e.elemID.getFullName())
    const mappersByElemID = _.pickBy(
      _.mapValues(instancesByElemID, inst => pathMapper(inst)),
      lowerdashValues.isDefined,
    )

    const graph = new DAG<undefined>()
    Object.entries(mappersByElemID).forEach(([id, { nestUnder }]) => {
      graph.addNode(id, [nestUnder.getFullName()], undefined)
    })
    graph.walkSync(id => {
      const mapper = mappersByElemID[id]
      if (mapper === undefined) {
        // nothing to update
        return
      }
      const { nestUnder, pathSuffix } = mapper
      const instance = instancesByElemID[id]
      const parent = instancesByElemID[nestUnder.getFullName()]
      if (parent === undefined) {
        log.warn(
          'could not update path for elem %s because the parent %s does not exist',
          instance.elemID.getFullName(),
          nestUnder.getFullName(),
        )
        return
      }
      const parentPath = parent.path
      if (parentPath === undefined) {
        log.warn(
          'could not update path for elem %s because the parent %s does not have a path',
          instance.elemID.getFullName(),
          nestUnder.getFullName(),
        )
        return
      }
      const newPath = [...parentPath.slice(0, -1), ...pathSuffix]
      log.trace('updating path for instance %s from %s to %s', instance.elemID.getFullName(), instance.path, newPath)
      instance.path = newPath
    })
  },
})
