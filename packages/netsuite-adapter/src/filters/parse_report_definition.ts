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

import { ElemID, InstanceElement, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { isDefined } from '@salto-io/lowerdash/src/values'
import { parseDefinition } from '../report_definition_parsing/report_definition_parser'
import { NETSUITE, REPORT_DEFINITION } from '../constants'
import { FilterCreator } from '../filter'
import { reportdefinitionType } from '../report_definition_parsing/parsed_report_definition'


const filterCreator: FilterCreator = ({ elementsSource }) => ({
  onFetch: async elements => {
    const { type: reportdefinition, innerTypes } = reportdefinitionType()

    const cloneReportDefinition = (instance: InstanceElement): InstanceElement =>
    // We create another element not using element.clone because
    // we need the new element to have a parsed save search type.
      new InstanceElement(instance.elemID.name, reportdefinition, instance.value,
        instance.path, instance.annotations)

    const assignReportDefinitionValues = async (
      instance: InstanceElement,
      oldInstance: InstanceElement
    ): Promise<void> => {
      Object.assign(instance.value, await parseDefinition(instance.value.definition))
      if (isDefined(oldInstance?.value.definition)) {
        if (_.isEqual(await parseDefinition(instance.value.definition),
          await parseDefinition(oldInstance.value.definition))) {
          oldInstance.value.definition = instance.value.definition
        }
      }
    }

    _.remove(elements, e => isObjectType(e) && e.elemID.name === REPORT_DEFINITION)
    _.remove(elements, e => isObjectType(e) && e.elemID.isEqual(new ElemID(NETSUITE, 'reportdefinition_dependencies')))

    const instances = _.remove(elements, e => isInstanceElement(e)
    && e.elemID.typeName === REPORT_DEFINITION)

    elements.push(reportdefinition)
    elements.push(...Object.values(innerTypes))

    const parsedInstances = await Promise.all(
      instances.filter(isInstanceElement)
        .map(cloneReportDefinition)
        .map(async (instance: InstanceElement) => {
          await assignReportDefinitionValues(instance, await elementsSource.get(instance.elemID))
          return instance
        })
    )
    elements.push(...parsedInstances)
  },
})

export default filterCreator
