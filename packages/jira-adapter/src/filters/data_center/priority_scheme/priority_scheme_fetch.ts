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
import { ElemIdGetter, InstanceElement, ObjectType, Values } from '@salto-io/adapter-api'
import { client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../../filter'
import { JIRA, PRIORITY_SCHEME_TYPE_NAME } from '../../../constants'
import { createPrioritySchemeType } from './types'

const { makeArray } = collections.array
const { awu } = collections.asynciterable

const fetchSchemeValues = async (paginator: clientUtils.Paginator): Promise<Values[]> => {
  const paginationArgs = {
    url: '/rest/api/2/priorityschemes',
    paginationField: 'startAt',
  }
  const schemeValues = await awu(paginator(
    paginationArgs,
    page => makeArray(page.schemes) as clientUtils.ResponseValue[]
  )).flat().toArray()
  return schemeValues
}

const createInstance = (values: Values, type: ObjectType, getElemIdFunc: ElemIdGetter | undefined): InstanceElement => {
  const serviceIds = elementUtils.createServiceIds(values, 'id', type.elemID)

  const defaultName = naclCase(values.name)

  const instanceName = getElemIdFunc && serviceIds
    ? getElemIdFunc(JIRA, serviceIds, defaultName).name
    : defaultName

  return new InstanceElement(
    instanceName,
    type,
    values,
    [JIRA, elementUtils.RECORDS_PATH, PRIORITY_SCHEME_TYPE_NAME, pathNaclCase(instanceName)]
  )
}

const transformInstance = (instance: InstanceElement): void => {
  if (!instance.value.defaultScheme) {
    delete instance.value.defaultScheme
  }
}


const filter: FilterCreator = ({ paginator, client, fetchQuery, getElemIdFunc }) => ({
  name: 'prioritySchemeFetchFilter',
  onFetch: async elements => {
    if (!client.isDataCenter || !fetchQuery.isTypeMatch(PRIORITY_SCHEME_TYPE_NAME)) {
      return
    }

    const schemeValues = await fetchSchemeValues(paginator)

    const type = createPrioritySchemeType()
    schemeValues
      .map(values => createInstance(values, type, getElemIdFunc))
      .forEach(instance => {
        transformInstance(instance)
        elements.push(instance)
      })

    elements.push(type)
  },
})

export default filter
