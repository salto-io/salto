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
import _ from 'lodash'
import Bottleneck from 'bottleneck'
import {
  Change,
  ElemID,
  getChangeData,
  InstanceElement,
  SaltoElementError,
  DeployResult,
  ChangeGroup,
  isSaltoError,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { types, values } from '@salto-io/lowerdash'
import { ApiDefinitions, queryWithDefault } from '../../definitions'
import { ChangeAndContext } from '../../definitions/system/deploy'
import { getRequester } from './requester'
import { RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS } from '../../client'
import { createDependencyGraph } from './graph'
import { DeployChangeInput } from '../../definitions/system/deploy/types'
import { ChangeElementResolver } from '../../resolve_utils'

const log = logger(module)

/**
 * Deploy change with the standard "add", "modify", "remove" endpoints based on the provided deploy definitions
 */
export const createSingleChangeDeployer = <
  ClientOptions extends string,
  PaginationOptions extends string | 'none',
  AdditionalAction extends string,
>({
  definitions,
  convertError,
  changeResolver,
}: {
  definitions: types.PickyRequired<
    ApiDefinitions<ClientOptions, PaginationOptions, AdditionalAction>,
    'clients' | 'deploy'
  >
  convertError: (elemID: ElemID, error: Error) => Error | SaltoElementError
  changeResolver: ChangeElementResolver<Change<InstanceElement>>
}): ((args: DeployChangeInput<AdditionalAction>) => Promise<void>) => {
  const { clients, deploy } = definitions
  const deployDefQuery = queryWithDefault(deploy.instances)

  const requester = getRequester({ clients, deployDefQuery, changeResolver })

  return async args => {
    try {
      return await requester.requestAllForChangeAndAction(args)
    } catch (err) {
      throw convertError(getChangeData(args.change).elemID, err)
    }
  }
}

/**
 * Runs a deploy function of a single change on many changes and returns the deploy results
 */
export const deployChanges = async <
  ClientOptions extends string,
  PaginationOptions extends string | 'none',
  AdditionalAction extends string,
>({
  definitions,
  changes,
  changeGroup,
  elementSource,
  deployChangeFunc,
  convertError,
  changeResolver,
}: {
  definitions: types.PickyRequired<
    ApiDefinitions<ClientOptions, PaginationOptions, AdditionalAction>,
    'clients' | 'deploy'
  >
  changes: Change<InstanceElement>[]
  changeGroup: Readonly<ChangeGroup>
  elementSource: ReadOnlyElementsSource
  convertError: (elemID: ElemID, error: Error) => Error | SaltoElementError
  deployChangeFunc?: (args: DeployChangeInput<AdditionalAction>) => Promise<void>
  changeResolver: ChangeElementResolver<Change<InstanceElement>>
}): Promise<Omit<DeployResult, 'extraProperties'>> => {
  const defQuery = queryWithDefault(definitions.deploy.instances)
  const { dependencies } = definitions.deploy

  const graph = createDependencyGraph({ defQuery, dependencies, changes, changeGroup, elementSource })

  const errors: SaltoElementError[] = []
  const appliedChanges: Change<InstanceElement>[] = []

  const deploySingleChange =
    deployChangeFunc ?? createSingleChangeDeployer({ convertError, definitions, changeResolver })

  await graph.walkAsync(async nodeID => {
    const { typeName, action, typeActionChanges } = graph.getData(nodeID)

    log.debug(
      'deploying %d changes of type %s action %s in group %s',
      typeActionChanges.length,
      typeName,
      action,
      changeGroup.groupID,
    )
    const { concurrency } = defQuery.query(String(typeName)) ?? {}
    const limiter = new Bottleneck({
      maxConcurrent: (concurrency ?? RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS) > 0 ? concurrency : null,
    })
    const limitedDeployChange = limiter.wrap(deploySingleChange)

    const applied = (
      await Promise.all(
        typeActionChanges.map(async change => {
          try {
            await limitedDeployChange({ change, changeGroup, elementSource, action })
            return change
          } catch (err) {
            log.error('Deployment of %s failed: %o', getChangeData(change).elemID.getFullName(), err)
            if (isSaltoError(err)) {
              errors.push({
                ...err,
                elemID: getChangeData(change).elemID,
              })
            } else {
              errors.push({
                message: `${err}`,
                severity: 'Error',
                elemID: getChangeData(change).elemID,
              })
            }
            return undefined
          }
        }),
      )
    ).filter(values.isDefined)
    applied.forEach(change => appliedChanges.push(change))
  })

  return {
    errors,
    // TODO decide if change should be marked as applied if one of the actions failed
    appliedChanges: _.uniqBy(appliedChanges, change => [getChangeData(change).elemID.getFullName(), change.action]),
  }
}

export type SingleChangeDeployCreator<
  ClientOptions extends string = 'main',
  AdditionalAction extends string = never,
> = ({
  definitions,
  convertError,
}: {
  definitions: types.PickyRequired<ApiDefinitions<ClientOptions, 'none', AdditionalAction>, 'clients' | 'deploy'>
  convertError: (elemID: ElemID, error: Error) => Error | SaltoElementError
}) => (args: ChangeAndContext) => Promise<void>
