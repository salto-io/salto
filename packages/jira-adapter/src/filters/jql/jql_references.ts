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
import { ElemID, InstanceElement, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { extendGeneratedDependencies } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import JiraClient from '../../client/client'
import { FilterCreator } from '../../filter'
import { extractReferences, generateJqlContext } from './references_extractor'
import { isJqlParseResponse, ParsedJql } from './types'

const { awu } = collections.asynciterable

const log = logger(module)

const JQL_CHUNK_SIZE = 1000

const JQL_FIELDS = [
  { type: 'Filter', path: ['jql'] },
  { type: 'Board', path: ['subQuery'] },
  { type: 'Webhook', path: ['filters', 'issue_related_events_section'] },
]

type JqlDetails = {
  jql: string
  path: ElemID
}


const getJqls = async (instance: InstanceElement): Promise<JqlDetails[]> =>
  JQL_FIELDS
    .filter(({ type }) => type === instance.elemID.typeName)
    .map(({ path }) => ({
      path: instance.elemID.createNestedID(...path),
      jql: _.get(instance.value, path),
    }))
    .filter(({ jql }) => _.isString(jql))

const requestJqlsStructure = async (jqls: string[], client: JiraClient): Promise<ParsedJql[]> => {
  log.debug(`About to request JQL structure for ${jqls.length} unique JQLs`)

  const responses = await Promise.all(_.chunk(jqls, JQL_CHUNK_SIZE).map(async queries => {
    const response = await client.post({
      url: '/rest/api/3/jql/parse',
      data: {
        queries,
      },
      queryParams: {
        validation: 'none',
      },
    })

    if (!isJqlParseResponse(response.data)) {
      throw new Error('Received an invalid response from jqls request')
    }

    return response.data.queries
  }))

  return responses.flat()
}

const filter: FilterCreator = ({ client }) => ({
  onFetch: async elements => {
    const instances = elements.filter(isInstanceElement)

    const jqls = await awu(instances)
      .flatMap(getJqls)
      .toArray()

    const JqlsStructure = await requestJqlsStructure(
      _(jqls).map(({ jql }) => jql).uniq().value(),
      client
    )

    const jqlContext = generateJqlContext(instances)

    const jqlToReferences: Record<string, ReferenceExpression[]> = Object.fromEntries(JqlsStructure
      .map(parsedJql => [parsedJql.query, extractReferences(parsedJql.structure, jqlContext)]))

    const idToInstance = _.keyBy(instances, instance => instance.elemID.getFullName())

    jqls.forEach(({ jql, path }) => {
      const instance = idToInstance[path.createTopLevelParentID().parent.getFullName()]
      const references = jqlToReferences[jql]

      extendGeneratedDependencies(instance, references.map(reference => ({
        reference,
        location: new ReferenceExpression(path, jql),
      })))
    })
  },
})

export default filter
