/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { addAliasToElements, AliasData } from '../add_alias'
import { APIDefinitionsOptions, queryWithDefault } from '../definitions'
import { AdapterFilterCreator } from '../filter_utils'

/**
 * Add aliases to instances according to definitions.
 */
export const addAliasFilterCreator =
  <TResult extends void | filter.FilterResult, TOptions extends APIDefinitionsOptions = {}>(): AdapterFilterCreator<
    {},
    TResult,
    {},
    TOptions
  > =>
  ({ definitions }) => ({
    name: 'addAliasFilter',
    onFetch: async (elements: Element[]) => {
      if (definitions.fetch !== undefined) {
        const { instances } = definitions.fetch
        const defQuery = queryWithDefault(instances)
        const elementsMap = _.groupBy(elements.filter(isInstanceElement), e => e.elemID.typeName)
        const allDefs = defQuery.getAll()
        const aliasMap = Object.entries(allDefs).reduce<Record<string, AliasData>>((currentRecord, [typeName, def]) => {
          const aliasData = def.element?.topLevel?.alias
          if (aliasData === undefined) {
            return currentRecord
          }
          return {
            ...currentRecord,
            [typeName]: aliasData,
          }
        }, {})
        addAliasToElements({ elementsMap, aliasMap })
      }
    },
  })
