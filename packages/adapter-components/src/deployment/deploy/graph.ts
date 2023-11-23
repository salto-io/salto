/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  ActionName,
  Change,
  getChangeData,
  InstanceElement,
  ChangeGroup,
  ReadOnlyElementsSource,
  ChangeId,
} from '@salto-io/adapter-api'
import { DAG } from '@salto-io/dag'
import { DefQuery } from '../../definitions'
import { InstanceDeployApiDefinitions, ChangeDependency } from '../../definitions/system/deploy'
import { toDefaultActionNames } from './requester'

const toNodeID = <AdditionalAction extends string>(typeName: string, action: ActionName | AdditionalAction): ChangeId =>
  `${typeName}/${action}`


type NodeType<AdditionalAction extends string> = {
  typeName: string
  action: ActionName | AdditionalAction
  typeActionChanges: Change<InstanceElement>[]
}

/**
 * define the dependencies when deploying a change group, based on the existing changes.
 * dependencies can be controlled at the type + action level
 */
export const createDependencyGraph = <ClientOptions extends string, AdditionalAction extends string>({
  defQuery, dependencies, changes, changeGroup, elementSource
}: {
  defQuery: DefQuery<InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>>,
  dependencies?: ChangeDependency<AdditionalAction>[]
  changes: Change<InstanceElement>[]
  changeGroup: Readonly<ChangeGroup>
  elementSource: ReadOnlyElementsSource
}): DAG<NodeType<AdditionalAction>> => {

  const changesByTypeAndAction: Record<string, Partial<Record<ActionName | AdditionalAction, Change<InstanceElement>[]>>> = {}
  changes.forEach(c => {
    const { typeName } = getChangeData(c).elemID
    const actions = (defQuery.query(typeName)?.toActionNames ?? toDefaultActionNames)({ change: c, changeGroup, elementSource })
    if (changesByTypeAndAction[typeName] === undefined) {
      changesByTypeAndAction[typeName] = {}
    }
    const typeChanges = changesByTypeAndAction[typeName]
    actions.forEach(a => {
      if (typeChanges[a] !== undefined) {
        typeChanges[a]?.push(c)
      } else {
        typeChanges[a] = [c]
      }
    })
  })

  const graph = new DAG<NodeType<AdditionalAction>>()
  Object.entries(changesByTypeAndAction).forEach(([typeName, mapping]) => {
    Object.entries(mapping).forEach(([action, typeActionChanges]) => {
      if (typeActionChanges === undefined) {
        // cannot happen
        return
      }
      graph.addNode(toNodeID(typeName, action), [], {
        action: action as ActionName | AdditionalAction,
        typeActionChanges,
        typeName,
      })
    })
    defQuery.query(typeName)?.actionDependencies?.forEach(({ first, second }) => {
      graph.addEdge(toNodeID(typeName, first), toNodeID(typeName, second))
    })
  })
  dependencies?.forEach(({ first, second }) => {
    const beforeActions = first.action !== undefined
      ? [first.action]
      : Object.keys(changesByTypeAndAction[first.type])
    const afterActions = second.action !== undefined
      ? [second.action]
      : Object.keys(changesByTypeAndAction[second.type])

    beforeActions.forEach(beforeAction => {
      afterActions.forEach(afterAction => {
        graph.addEdge(toNodeID(first.type, beforeAction), toNodeID(second.type, afterAction))
      })
    })
  })

  return graph
}
