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

import { ElemID, getChangeData, InstanceElement, isInstanceChange, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { parseDefinition } from '../financial_layout_parsing/financial_layout_parser'
import { FINANCIAL_LAYOUT, NETSUITE } from '../constants'
import { FilterCreator } from '../filter'
import { financiallayoutType as oldfinanciallayout } from '../autogen/types/standard_types/financiallayout'
import { financiallayoutType } from '../financial_layout_parsing/parsed_financial_layout'

const filterCreator: FilterCreator = ({ elementsSource }) => ({
  onFetch: async elements => {
    const { type: financiallayout, innerTypes } = financiallayoutType()

    const cloneFinancialLayout = (instance: InstanceElement): InstanceElement =>
      new InstanceElement(instance.elemID.name, financiallayout, instance.value, instance.path, instance.annotations)

    const assignFinancialLayoutValues = async (
      instance: InstanceElement,
      oldInstance: InstanceElement
    ): Promise<void> => {
      Object.assign(instance.value, await parseDefinition(instance.value.layout))
      if (values.isDefined(oldInstance?.value.layout)) {
        if (_.isEqual(await parseDefinition(instance.value.layout),
          await parseDefinition(oldInstance.value.layout))) {
          // if instances only differ by definition we keep the old
          // definition to avoid creating a change
          instance.value.layout = oldInstance.value.layout
        }
      }
    }
    _.remove(elements, e => isObjectType(e) && e.elemID.name === FINANCIAL_LAYOUT)
    _.remove(elements, e => isObjectType(e) && e.elemID.isEqual(new ElemID(NETSUITE, 'financiallayout_dependencies')))


    const instances = _.remove(elements, e => isInstanceElement(e)
    && e.elemID.typeName === FINANCIAL_LAYOUT)

    elements.push(financiallayout)
    elements.push(...Object.values(innerTypes))

    const parsedInstances = await Promise.all(
      instances.filter(isInstanceElement)
        .map(cloneFinancialLayout)
        .map(async (instance: InstanceElement) => {
          await assignFinancialLayoutValues(instance, await elementsSource.get(instance.elemID))
          return instance
        })
    )
    elements.push(...parsedInstances)
  },
  preDeploy: async changes => {
    const financiallayout = oldfinanciallayout().type
    const removeValuesFromInstance = (instance: InstanceElement): void => {
      instance.value = _.pickBy(instance.value, (_val, key) => key in financiallayout.fields)
    }

    changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === FINANCIAL_LAYOUT)
      .forEach(instance => removeValuesFromInstance(instance))
  },
})

export default filterCreator
