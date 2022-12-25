/*
*                      Copyright 2022 Salto Labs Ltd.
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

import { ElemID, getChangeData, InstanceElement, isInstanceChange, isInstanceElement, isObjectType, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { FINANCIAL_LAYOUT, NETSUITE, REPORT_DEFINITION, SAVED_SEARCH } from '../constants'
import { FilterCreator } from '../filter'
import { savedsearchType } from '../saved_search_parsing/parsed_saved_search'
import { financiallayoutType } from '../financial_layout_parsing/parsed_financial_layout'
import { reportdefinitionType } from '../report_definition_parsing/parsed_report_definition'
import { parseDefinition as parseSavedSearchDefinition } from '../saved_search_parsing/saved_search_parser'
import { parseDefinition as parseReportDefintionDefinition } from '../report_definition_parsing/report_definition_parser'
import { parseDefinition as parseFinancialLayoutDefinition } from '../financial_layout_parsing/financial_layout_parser'
import { typeToParameters } from '../report_types_parser_utils'
import { ReportTypes } from '../change_validators/report_types_move_environment'

const { awu } = collections.asynciterable

const mapTypeToLayoutOrDefinition: Record<string, string> = {
  [FINANCIAL_LAYOUT]: 'layout',
  [REPORT_DEFINITION]: 'definition',
  [SAVED_SEARCH]: 'definition',
}

const typeNameToParser: Record<string, (definition: string) => Promise<ReportTypes>> = {
  [FINANCIAL_LAYOUT]: parseFinancialLayoutDefinition,
  [REPORT_DEFINITION]: parseReportDefintionDefinition,
  [SAVED_SEARCH]: parseSavedSearchDefinition,
}

const filterCreator: FilterCreator = ({ elementsSource }) => ({
  onFetch: async elements => {
    const savedSearchParams = { typeName: SAVED_SEARCH, ...savedsearchType() }
    const reportDefinitionParams = { typeName: REPORT_DEFINITION, ...reportdefinitionType() }
    const financialLayoutParams = { typeName: FINANCIAL_LAYOUT, ...financiallayoutType() }


    const cloneReportInstance = (instance: InstanceElement, type: ObjectType): InstanceElement =>
    // We create another element not using element.clone because
    // we need the new element to have a parsed save search type.
      new InstanceElement(instance.elemID.name, type, instance.value,
        instance.path, instance.annotations)

    const assignSavedSearchValues = async (
      instance: InstanceElement,
      oldInstance: InstanceElement | undefined
    ): Promise<void> => {
      const layoutOrDefinition = mapTypeToLayoutOrDefinition[instance.elemID.typeName]
      const parser = typeNameToParser[instance.elemID.typeName]
      Object.assign(instance.value, await parser(instance.value[layoutOrDefinition]))
      if (oldInstance?.value[layoutOrDefinition] !== undefined) {
        if (_.isEqual(await parser(oldInstance.value[layoutOrDefinition]),
          await parser(instance.value[layoutOrDefinition]))) {
          // In case the parsed definitions are equal that mean there is no reason
          // to change the definition string and create a change in the file.
          instance.value[layoutOrDefinition] = oldInstance.value[layoutOrDefinition]
        }
      }
    }
    await awu([reportDefinitionParams, financialLayoutParams, savedSearchParams]).forEach(async parameters => {
      const { typeName, type, innerTypes } = parameters
      _.remove(elements, e => isObjectType(e) && e.elemID.name === typeName)
      _.remove(elements, e => isObjectType(e) && e.elemID.isEqual(new ElemID(NETSUITE, typeName.concat('_dependencies'))))
      const instances = _.remove(elements, e => isInstanceElement(e)
          && e.elemID.typeName === typeName)
      elements.push(type)
      elements.push(...Object.values(innerTypes))
      const parsedInstances = await Promise.all(
        instances
          .filter(isInstanceElement)
          .map(instance => cloneReportInstance(instance, type))
          .map(async (instance: InstanceElement) => {
            await assignSavedSearchValues(instance, await elementsSource.get(instance.elemID))
            return instance
          })
      )
      elements.push(...parsedInstances)
    })
  },
  preDeploy: async changes => {
    const removeValuesFromInstance = async (instance: InstanceElement): Promise<void> => {
      instance.value = _.pickBy(instance.value, (_val, key) =>
        key in typeToParameters[instance.elemID.typeName].oldType.fields)
    }

    changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => [SAVED_SEARCH, REPORT_DEFINITION, FINANCIAL_LAYOUT].includes(instance.elemID.typeName))
      .forEach(instance => removeValuesFromInstance(instance))
  },
})

export default filterCreator
