/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { addAliasToElements, AliasData } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import {
  PRIORITY_TYPE_NAME,
  STATUS_TYPE_NAME,
} from '../constants'
import { JiraConfig } from '../config/config'

const log = logger(module)

const aliasMap: Record<string, AliasData> = {
  Field: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  Automation: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
  DashboardGadget: {
    aliasComponents: [
      {
        fieldName: 'title',
      },
    ],
  },
  [STATUS_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
    separator: ':',
  },
  [PRIORITY_TYPE_NAME]: {
    aliasComponents: [
      {
        fieldName: 'name',
      },
    ],
  },
}

export const addAlias = async (config: JiraConfig, elements: Element[], aliasMap: Record<string, AliasData>): Promise<void> => {
  if (config.fetch.addAlias === false || config.fetch.addAlias === undefined) {
    log.info('not running addAlias filter as addAlias in the config is false')
    return
  }
  const elementsMap = _.groupBy(elements.filter(isInstanceElement), instance => instance.elemID.typeName)
  addAliasToElements({
    elementsMap,
    aliasMap,
  })
}

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'addAlias',
  onFetch: async (elements: Element[]): Promise<void> => {
    addAlias(config, elements, aliasMap)
  },
})

export default filterCreator
