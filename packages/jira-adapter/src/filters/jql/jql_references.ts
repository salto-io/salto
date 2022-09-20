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
import { Change, ElemID, InstanceElement, isInstanceChange, isInstanceElement, isReferenceExpression, isTemplateExpression, TemplateExpression } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, setPath, walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { AUTOMATION_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { generateTemplateExpression, generateJqlContext, removeCustomFieldPrefix } from './template_expression_generator'

const { awu } = collections.asynciterable

const log = logger(module)

const JQL_FIELDS = [
  { type: 'Filter', path: ['jql'] },
  { type: 'Board', path: ['subQuery'] },
  { type: 'Webhook', path: ['filters', 'issue_related_events_section'] },
]

type JqlDetails = {
  jql: string | TemplateExpression
  path: ElemID
}

type StringJqlDetails = JqlDetails & { jql: string }
type TemplateJqlDetails = JqlDetails & { jql: TemplateExpression }

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
      const jqlRelativePaths = AUTOMATION_JQL_RELATIVE_PATHS_BY_TYPE[value?.type]
      if (jqlRelativePaths !== undefined) {
        jqlRelativePaths.forEach(relativePath => {
          const jqlValue = _.get(value, relativePath)
          if (_.isString(jqlValue) || isTemplateExpression(jqlValue)) {
            jqlPaths.push({
              path: path.createNestedID(...relativePath),
              jql: jqlValue,
            })
          }
        })
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return jqlPaths
}

const getJqls = (instance: InstanceElement): JqlDetails[] => {
  if (instance.elemID.typeName === AUTOMATION_TYPE) {
    return getAutomationJqls(instance)
  }
  return JQL_FIELDS
    .filter(({ type }) => type === instance.elemID.typeName)
    .map(({ path }) => ({
      path: instance.elemID.createNestedID(...path),
      jql: _.get(instance.value, path),
    }))
    .filter(({ jql }) => jql !== undefined)
}

const filter: FilterCreator = () => {
  const jqlToTemplateExpression: Record<string, TemplateExpression> = {}

  return {
    onFetch: async elements => log.time(async () => {
      const instances = elements.filter(isInstanceElement)

      const jqls = instances
        .flatMap(getJqls)
        .filter((jql): jql is StringJqlDetails => _.isString(jql.jql))

      const jqlContext = generateJqlContext(instances)

      log.debug(`About to parse ${jqls.length} unique JQLs`)

      const jqlToTemplate = Object.fromEntries(jqls
        .map(jql => [jql.jql, generateTemplateExpression(jql.jql, jqlContext)]))

      const idToInstance = _.keyBy(instances, instance => instance.elemID.getFullName())

      jqls
        .filter(({ jql }) => jqlToTemplate[jql] !== undefined)
        .forEach(({ jql, path }) => {
          const instance = idToInstance[path.createTopLevelParentID().parent.getFullName()]
          const templateExpression = jqlToTemplate[jql]

          setPath(instance, path, templateExpression)
        })
    }, 'jqlReferencesFilter'),

    preDeploy: async changes => {
      await awu(changes)
        .filter(isInstanceChange)
        .forEach(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(
            change,
            async instance => {
              getJqls(instance)
                .filter((jql): jql is TemplateJqlDetails =>
                  isTemplateExpression(jql.jql))
                .forEach(jql => {
                  const resolvedJql = jql.jql.parts.map(part => {
                    if (!isReferenceExpression(part)) {
                      return part
                    }

                    if (part.elemID.isTopLevel()) {
                      return removeCustomFieldPrefix(part.value.value.id)
                    }

                    return part.value
                  }).join('')


                  jqlToTemplateExpression[jql.path.getFullName()] = jql.jql

                  setPath(instance, jql.path, resolvedJql)
                })
              return instance
            }
          )
        })
    },

    onDeploy: async changes => {
      await awu(changes)
        .filter(isInstanceChange)
        .forEach(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(
            change,
            async instance => {
              getJqls(instance)
                .filter((jql): jql is JqlDetails & { jql: string } =>
                  _.isString(jql.jql))
                .filter(jql => jqlToTemplateExpression[jql.path.getFullName()] !== undefined)
                .forEach(jql => {
                  setPath(instance, jql.path, jqlToTemplateExpression[jql.path.getFullName()])
                })
              return instance
            }
          )
        })
    },
  }
}

export default filter
