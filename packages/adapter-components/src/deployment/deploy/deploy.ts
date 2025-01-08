/*
 * Copyright 2025 Salto Labs Ltd.
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
import { types, values, promises } from '@salto-io/lowerdash'
import { APIDefinitionsOptions, ApiDefinitions, queryWithDefault } from '../../definitions'
import { ChangeAndContext } from '../../definitions/system/deploy'
import { getRequester } from './requester'
import { RateLimiter } from '../../client'
import { createDependencyGraph } from './graph'
import { ChangeAndExtendedContext, DeployChangeInput } from '../../definitions/system/deploy/types'
import { ChangeElementResolver } from '../../resolve_utils'
import { ResolveAdditionalActionType } from '../../definitions/system/api'
import { createChangesForSubResources } from './subresources'

const log = logger(module)
const { mapValuesAsync } = promises.object

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

  const changesByID = _.keyBy(changes, change => getChangeData(change).elemID.getFullName())
  const subResourceChangesByChangeID = await mapValuesAsync(changesByID, async change =>
    createChangesForSubResources({ change, definitions, context: changeContext }),
  )
  const subResourceChangeIDToOriginChangeID = _.mapValues(
    Object.fromEntries(
      Object.entries(subResourceChangesByChangeID).flatMap(([originChangeID, subResourceChanges]) =>
        subResourceChanges.map(subResourceChange => [
          getChangeData(subResourceChange).elemID.getFullName(),
          changesByID[originChangeID],
        ]),
      ),
    ),
    change => getChangeData(change).elemID,
  )

  const graph = createDependencyGraph({
    defQuery,
    dependencies,
    changes: changes.concat(Object.values(subResourceChangesByChangeID).flat()),
    ...changeContext,
  })

  const errors: Record<string, SaltoElementError[]> = {}
  const appliedChanges: Change<InstanceElement>[] = []

  const deploySingleChange =
    deployChangeFunc ?? createSingleChangeDeployer({ convertError, definitions, changeResolver })

  const getFailedChangeID = (elemID: ElemID): ElemID =>
    subResourceChangeIDToOriginChangeID[elemID.getFullName()] ?? elemID

  const shouldFailChange = (elemID: ElemID): boolean =>
    defQuery.query(getFailedChangeID(elemID).typeName)?.failIfChangeHasErrors !== false &&
    !_.isEmpty(errors[getFailedChangeID(elemID).getFullName()]?.filter(e => e.severity === 'Error'))

  const handleChangeFailure = (change: Change<InstanceElement>, err: Error): void => {
    const { elemID } = getChangeData(change)
    log.error('Deployment of %s (action %s) failed: %o', elemID, change.action, err)
    const failedElemID = getFailedChangeID(elemID)
    errors[failedElemID.getFullName()] ??= []
    if (isSaltoError(err)) {
      errors[failedElemID.getFullName()].push({
        ...err,
        elemID: failedElemID,
      })
    } else {
      const message = `${err}`
      errors[failedElemID.getFullName()].push({
        message,
        detailedMessage: message,
        severity: 'Error',
        elemID: failedElemID,
      })
    }
  }

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
            handleChangeFailure(change, err)
            return undefined
          }
        }),
      )
    )
      .filter(values.isDefined)
      .filter(change => {
        const { elemID } = getChangeData(change)
        const isSubResourceChange = subResourceChangeIDToOriginChangeID[elemID.getFullName()] !== undefined
        if (isSubResourceChange) {
          log.debug(
            'Skipping subresource change %s, only top-level changes are marked as applied',
            elemID.getFullName(),
          )
          return false
        }
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
    appliedChanges: _.uniqBy(
      appliedChanges.filter(change => !shouldFailChange(getChangeData(change).elemID)),
      changeId,
    ),
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
