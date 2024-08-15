/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ActionName, Change, getChangeData, InstanceElement, ChangeId } from '@salto-io/adapter-api'
import { DAG } from '@salto-io/dag'
import { DefQuery } from '../../definitions'
import { InstanceDeployApiDefinitions, ChangeDependency, ChangeAndContext } from '../../definitions/system/deploy'

const toNodeID = <AdditionalAction extends string>(typeName: string, action: ActionName | AdditionalAction): ChangeId =>
  `${typeName}/${action}`

export type NodeType<AdditionalAction extends string> = {
  typeName: string
  action: ActionName | AdditionalAction
  typeActionChanges: Change<InstanceElement>[]
}

const getRelevantActions = <AdditionalAction extends string>(
  changesByAction?: Partial<Record<ActionName | AdditionalAction, Change<InstanceElement>[]>>,
  action?: ActionName | AdditionalAction,
): (ActionName | AdditionalAction)[] => {
  if (action !== undefined) {
    return changesByAction?.[action] !== undefined ? [action] : []
  }
  return Object.keys(changesByAction ?? {}) as (ActionName | AdditionalAction)[]
}

const toDefaultActionNames = <AdditionalAction extends string = never>({
  change,
}: ChangeAndContext): (AdditionalAction | ActionName)[] => [change.action]

/**
 * define the dependencies when deploying a change group, based on the existing changes.
 * dependencies can be controlled at the type + action level
 */
export const createDependencyGraph = <ClientOptions extends string, AdditionalAction extends string>({
  defQuery,
  dependencies,
  changes,
  ...changeContext
}: {
  defQuery: DefQuery<InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>>
  dependencies?: ChangeDependency<AdditionalAction>[]
  changes: Change<InstanceElement>[]
} & Omit<ChangeAndContext, 'change'>): DAG<NodeType<AdditionalAction>> => {
  const changesByTypeAndAction: Record<
    string,
    Partial<Record<ActionName | AdditionalAction, Change<InstanceElement>[]>>
  > = {}
  changes.forEach(c => {
    const { typeName } = getChangeData(c).elemID
    const actions = (defQuery.query(typeName)?.toActionNames ?? toDefaultActionNames)({
      change: c,
      ...changeContext,
    })
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
      // Action dependencies are transitive, so we need to add all the
      // dependencies to the graph - even for actions that aren't used in the
      // current change group. These actions won't have a node in the graph at
      // this point, so we manually add these missing nodes.
      ;[first, second].forEach(n => {
        const id = toNodeID(typeName, n)
        if (!graph.has(id)) {
          graph.addNode(id, [], {
            action: n as ActionName | AdditionalAction,
            typeActionChanges: [],
            typeName,
          })
        }
      })
      graph.addEdge(toNodeID(typeName, second), toNodeID(typeName, first))
    })
  })
  dependencies?.forEach(({ first, second }) => {
    getRelevantActions(changesByTypeAndAction[first.type], first.action).forEach(firstAction => {
      getRelevantActions(changesByTypeAndAction[second.type], second.action).forEach(secondAction => {
        graph.addEdge(toNodeID(second.type, secondAction), toNodeID(first.type, firstAction))
      })
    })
  })

  return graph
}
