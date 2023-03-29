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
import {
  Element,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { addAliasToInstance, AliasData } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'

const log = logger(module)


const SECOND_ITERATION_TYPES = ['FieldConfigurationItem', 'CustomFieldContext']

const aliasMap: Record<string, AliasData> = {
  Field: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  Automation: {
    aliasComponents: [{
      fieldName: 'name',
    }],
  },
  DashboardGadget: {
    aliasComponents: [{
      fieldName: 'title',
    }],
  },
  CustomFieldContext: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: '_alias',
      },
      {
        constant: 'context in',
      },
      {
        fieldName: 'name',
      }],
  },
  FieldConfigurationItem: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: 'name',
      },
      {
        fieldName: 'id',
        referenceFieldName: '_alias',
      }],
    separator: ':',
  },
  ProjectComponent: {
    aliasComponents: [
      {
        fieldName: '_parent.0',
        referenceFieldName: 'name',
      },
      {
        fieldName: 'name',
      }],
    separator: ':',
  },
}

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'addAlias',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (config.fetch.addAlias === false || config.fetch.addAlias === undefined) {
      log.info('not running addAlias filter as addAlias in the config is false')
      return
    }
    const instances = elements.filter(isInstanceElement)
    addAliasToInstance({
      instances,
      aliasMap,
      secondIterationTypeNames: SECOND_ITERATION_TYPES,
    })
  },
})

export default filterCreator
