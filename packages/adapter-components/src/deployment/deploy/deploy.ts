/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Change,
  ElemID,
  getChangeData,
  InstanceElement,
  SaltoElementError,
  DeployResult,
  isSaltoError,
  changeId,
  isSaltoElementError,
  createSaltoElementErrorFromError,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { types, values } from '@salto-io/lowerdash'
import { APIDefinitionsOptions, ApiDefinitions, queryWithDefault } from '../../definitions'
import { ChangeAndContext } from '../../definitions/system/deploy'
import { getRequester } from './requester'
import { RateLimiter } from '../../client'
import { createDependencyGraph } from './graph'
import { ChangeAndExtendedContext, DeployChangeInput } from '../../definitions/system/deploy/types'
import { ChangeElementResolver } from '../../resolve_utils'
import { ResolveAdditionalActionType } from '../../definitions/system/api'

const log = logger(module)

export type ConvertError = (elemID: ElemID, error: Error) => Error | SaltoElementError | undefined

export const defaultConvertError: ConvertError = (elemID, error) => {
  if (isSaltoError(error) && isSaltoElementError(error)) {
    return error
  }
  return createSaltoElementErrorFromError({ error, severity: 'Error', elemID })
}

/**
 * Deploy a change with standard (add / modify / remove) and custom-defined actions based on the provided deploy definitions
 */
const createSingleChangeDeployer = <TOptions extends APIDefinitionsOptions>({
  definitions,
  convertError,
  changeResolver,
}: {
  definitions: types.PickyRequired<ApiDefinitions<TOptions>, 'clients' | 'deploy'>
  convertError: ConvertError
  changeResolver: ChangeElementResolver<Change<InstanceElement>>
}): ((args: DeployChangeInput<ResolveAdditionalActionType<TOptions>>) => Promise<void>) => {
  const { clients, deploy } = definitions
  const deployDefQuery = queryWithDefault(deploy.instances)

  const requester = getRequester({ clients, deployDefQuery, changeResolver })

  return async args => {
    try {
      return await requester.requestAllForChangeAndAction(args)
    } catch (err) {
      const convertedError = convertError(getChangeData(args.change).elemID, err)
      if (convertedError !== undefined) {
        throw convertedError
      }
      log.warn(
        'Error has been thrown during deployment of %s, but was converted to undefined. Original error: %o',
        getChangeData(args.change).elemID.getFullName(),
        err,
      )
      return undefined
    }
  }
}

/**
 * Runs a deploy function of a single change on many changes and returns the deploy results
 */
export const deployChanges = async <TOptions extends APIDefinitionsOptions>({
  definitions,
  changes,
  deployChangeFunc,
  convertError,
  changeResolver,
  ...changeContext
}: {
  definitions: types.PickyRequired<ApiDefinitions<TOptions>, 'clients' | 'deploy'>
  changes: Change<InstanceElement>[]
  convertError: ConvertError
  deployChangeFunc?: (args: DeployChangeInput<ResolveAdditionalActionType<TOptions>>) => Promise<void>
  changeResolver: ChangeElementResolver<Change<InstanceElement>>
} & Omit<ChangeAndContext, 'change'>): Promise<Omit<DeployResult, 'extraProperties'>> => {
  const defQuery = queryWithDefault(definitions.deploy.instances)
  const { dependencies } = definitions.deploy

  const graph = createDependencyGraph({ defQuery, dependencies, changes, ...changeContext })

  const errors: Record<string, SaltoElementError[]> = {}
  const appliedChanges: Change<InstanceElement>[] = []

  const deploySingleChange =
    deployChangeFunc ?? createSingleChangeDeployer({ convertError, definitions, changeResolver })

  const shouldFailChange = (elemID: ElemID): boolean =>
    defQuery.query(elemID.typeName)?.failIfChangeHasErrors !== false &&
    !_.isEmpty(errors[elemID.getFullName()]?.filter(e => e.severity === 'Error'))

  await graph.walkAsync(async nodeID => {
    const { typeName, action, typeActionChanges } = graph.getData(nodeID)

    log.debug(
      'deploying %d changes of type %s action %s in group %s',
      typeActionChanges.length,
      typeName,
      action,
      changeContext.changeGroup.groupID,
    )
    const { concurrency } = defQuery.query(String(typeName)) ?? {}

    const limiter = new RateLimiter({ maxConcurrentCalls: concurrency })
    const limitedDeployChange = limiter.wrap(deploySingleChange)

    const applied = (
      await Promise.all(
        typeActionChanges.map(async change => {
          const { elemID } = getChangeData(change)
          try {
            if (shouldFailChange(elemID)) {
              log.error(
                'Not continuing deployment of change %s (action %s) due to earlier failure',
                elemID.getFullName(),
                change.action,
              )
              return undefined
            }
            await limitedDeployChange({
              ...changeContext,
              change,
              action,
              errors,
            })
            return change
          } catch (err) {
            if (errors[elemID.getFullName()] === undefined) {
              errors[elemID.getFullName()] = []
            }
            log.error('Deployment of %s (action %s) failed: %o', elemID.getFullName(), change.action, err)
            if (isSaltoError(err)) {
              errors[elemID.getFullName()].push({
                ...err,
                elemID,
              })
            } else {
              const message = `${err}`
              errors[elemID.getFullName()].push({
                message,
                detailedMessage: message,
                severity: 'Error',
                elemID: getChangeData(change).elemID,
              })
            }
            return undefined
          }
        }),
      )
    )
      .filter(values.isDefined)
      .filter(change => {
        const { elemID } = getChangeData(change)
        if (shouldFailChange(elemID)) {
          log.error('Not marking change %s as successful due to partial failure', elemID.getFullName())
          return false
        }
        return true
      })
    applied.forEach(change => appliedChanges.push(change))
  })

  return {
    errors: Object.values(errors).flat(),
    // TODO SALTO-5557 decide if change should be marked as applied if one of the actions failed
    appliedChanges: _.uniqBy(appliedChanges, changeId),
  }
}

export type SingleChangeDeployCreator<
  TOptions extends Pick<APIDefinitionsOptions, 'clientOptions' | 'additionalAction'>,
> = ({
  definitions,
  convertError,
}: {
  definitions: types.PickyRequired<ApiDefinitions<TOptions>, 'clients' | 'deploy'>
  convertError: ConvertError
}) => (args: ChangeAndExtendedContext) => Promise<void>
