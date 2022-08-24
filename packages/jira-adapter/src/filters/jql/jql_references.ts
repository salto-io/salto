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
import { extendGeneratedDependencies, walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { AUTOMATION_TYPE } from '../../constants'
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

const getAutomationJqls = (instance: InstanceElement): JqlDetails[] => {
  // maps between the automation component type (which is determined by 'type' field)
  // and the corresponding jql relative paths
  const AUTOMATION_JQL_RELATIVE_PATHS_BY_TYPE: Record<string, string[][]> = {
    'jira.jql.condition': [['rawValue']],
    'jira.issue.assign': [['value', 'jql']],
    'jira.issue.related': [['value', 'jql']],
    'jira.issues.related.condition': [['value', 'compareJql'], ['value', 'relatedJql'], ['value', 'jql']],
    'jira.jql.scheduled': [['value', 'jql']],
    JQL: [['query', 'value']],
  }

  const jqlPaths: JqlDetails[] = []
  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      const jqlRelativePaths = AUTOMATION_JQL_RELATIVE_PATHS_BY_TYPE[value.type]
      if (jqlRelativePaths !== undefined) {
        jqlRelativePaths.forEach(relativePath => {
          const jqlValue = _.get(value, relativePath)
          jqlPaths.push({
            path: path.createNestedID(...relativePath),
            jql: jqlValue,
          })
        })
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return jqlPaths.filter(({ jql }) => _.isString(jql))
}

const getJqls = async (instance: InstanceElement): Promise<JqlDetails[]> => {
  if (instance.elemID.typeName === AUTOMATION_TYPE) {
    return getAutomationJqls(instance)
  }
  return JQL_FIELDS
    .filter(({ type }) => type === instance.elemID.typeName)
    .map(({ path }) => ({
      path: instance.elemID.createNestedID(...path),
      jql: _.get(instance.value, path),
    }))
    .filter(({ jql }) => _.isString(jql))
}

const requestJqlsStructure = async (jqls: string[], client: JiraClient)
: Promise<Required<ParsedJql>[]> => {
  log.debug(`About to request JQL structure for ${jqls.length} unique JQLs`)

  const responses = (await Promise.all(_.chunk(jqls, JQL_CHUNK_SIZE).map(async queries => {
    try {
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
        // isJqlParseResponse already logs the error
        return []
      }

      return response.data.queries
    } catch (err) {
      log.error(`Failed to request JQL structure ${err}`)
      return []
    }
  }))).flat()

  responses
    .filter(response => (response.errors ?? []).length !== 0)
    .forEach(response => {
      log.error(`Failed to parse JQL '${response.query}': ${response.errors?.join(', ')}`)
    })

  return responses
    .filter(
      (response): response is ParsedJql
        & { structure: Record<string, unknown> } => response.structure !== undefined
    )
    .map(response => ({
      query: response.query,
      structure: response.structure,
      errors: response.errors ?? [],
    }))
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

    jqls
      .filter(({ jql }) => jqlToReferences[jql] !== undefined)
      .forEach(({ jql, path }) => {
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
