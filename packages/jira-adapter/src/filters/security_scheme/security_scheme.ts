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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, DeployResult, Element, Field, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isInstanceElement, isReferenceExpression, isRemovalChange, MapType, toChange, Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { objects } from '@salto-io/lowerdash'
import { getParents, safeJsonStringify } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { findObject, getFilledJspUrls, setFieldDeploymentAnnotations, setTypeDeploymentAnnotations } from '../../utils'
import { FilterCreator } from '../../filter'
import { deployWithJspEndpoints } from '../../deployment/jsp_deployment'
import { SECURITY_LEVEL_MEMBER_TYPE, SECURITY_LEVEL_TYPE, SECURITY_SCHEME_TYPE } from '../../constants'
import { JiraConfig } from '../../config/config'
import JiraClient from '../../client/client'
import { deployMembers, getMemberKey, isMember } from './members_deployment'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'

const log = logger(module)

export const NO_DEFAULT_VALUE = '-1'

const deploySecurityScheme = async (
  change: Change<InstanceElement>,
  config: JiraConfig,
  client: JiraClient,
): Promise<DeployResult> => {
  const jspRequests = config.apiDefinitions.types[SECURITY_SCHEME_TYPE]?.jspRequests
  if (jspRequests === undefined) {
    throw new Error(`${SECURITY_SCHEME_TYPE} jsp urls are missing from the configuration`)
  }

  return deployWithJspEndpoints({
    changes: [change],
    client,
    urls: jspRequests,
    serviceValuesTransformer: serviceValues => ({
      ...serviceValues,
      schemeId: serviceValues.id,
      defaultLevel: serviceValues.defaultSecurityLevelId?.toString() ?? NO_DEFAULT_VALUE,
    }),
    fieldsToIgnore: isAdditionChange(change) ? ['levels', 'defaultLevel'] : ['levels'],
  })
}

const deploySecurityLevels = async (
  changes: Change<InstanceElement>[],
  config: JiraConfig,
  client: JiraClient,
): Promise<Omit<DeployResult, 'extraProperties'>> => {
  if (changes.length === 0) {
    return {
      appliedChanges: [],
      errors: [],
    }
  }

  const urls = getFilledJspUrls(getChangeData(changes[0]), config, SECURITY_LEVEL_TYPE)

  const deployResult = await deployWithJspEndpoints({
    changes,
    client,
    urls,
    fieldsToIgnore: ['members'],
    serviceValuesTransformer: (serviceValues, instance) => ({
      ...serviceValues,
      schemeId: instance.value.schemeId,
      levelId: serviceValues.id,
    }),
  })


  const membersDeployResult = await deployChanges(
    deployResult.appliedChanges
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange),

    change => deployMembers(
      change,
      config,
      client,
    )
  )

  return {
    appliedChanges: [
      ...deployResult.appliedChanges.filter(isRemovalChange),
      ...membersDeployResult.appliedChanges,
    ],
    errors: [
      ...deployResult.errors,
      ...membersDeployResult.errors,
    ],
  }
}

const filter: FilterCreator = ({ client, config }) => ({
  name: 'securitySchemeFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === SECURITY_SCHEME_TYPE)
      .forEach(instance => {
        instance.value.defaultLevel = instance.value.defaultSecurityLevelId
        delete instance.value.defaultSecurityLevelId
      })

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === SECURITY_LEVEL_TYPE)
      .forEach(instance => {
        if (Array.isArray(instance.value.members)) {
          instance.value.members = instance.value.members.filter(member => {
            if (!isMember(member)) {
              log.error(`Invalid member ${safeJsonStringify(member)} in security level ${instance.elemID.getFullName()}`)
              return false
            }
            return true
          })
        }
        instance.value.memberIds = Object.fromEntries((instance.value.members ?? [])
          .map((member: Values) => [getMemberKey(member), member.id]))

        instance.value.members?.forEach((member: Values) => {
          delete member.id
        })
      })

    const securityLevelType = findObject(elements, SECURITY_LEVEL_TYPE)
    if (securityLevelType === undefined) {
      return
    }

    const securitySchemeType = findObject(elements, SECURITY_SCHEME_TYPE)
    if (securitySchemeType === undefined) {
      return
    }

    const securityLevelMemberType = findObject(elements, SECURITY_LEVEL_MEMBER_TYPE)
    if (securityLevelMemberType === undefined) {
      return
    }

    securitySchemeType.fields.defaultLevel = new Field(
      securitySchemeType,
      'defaultLevel',
      securityLevelType
    )

    securityLevelType.fields.memberIds = new Field(
      securityLevelType,
      'memberIds',
      new MapType(BuiltinTypes.NUMBER),
      { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true }
    )


    if (!config.client.usePrivateAPI) {
      log.debug('Skipping security scheme filter because private API is not enabled')
      return
    }

    setTypeDeploymentAnnotations(securitySchemeType)
    setFieldDeploymentAnnotations(securitySchemeType, 'id')
    setFieldDeploymentAnnotations(securitySchemeType, 'name')
    setFieldDeploymentAnnotations(securitySchemeType, 'description')
    setFieldDeploymentAnnotations(securitySchemeType, 'defaultLevel')
    setFieldDeploymentAnnotations(securitySchemeType, 'levels')

    setTypeDeploymentAnnotations(securityLevelType)
    setFieldDeploymentAnnotations(securityLevelType, 'id')
    setFieldDeploymentAnnotations(securityLevelType, 'name')
    setFieldDeploymentAnnotations(securityLevelType, 'description')
    setFieldDeploymentAnnotations(securityLevelType, 'members')

    setFieldDeploymentAnnotations(securityLevelMemberType, 'id')
    setFieldDeploymentAnnotations(securityLevelMemberType, 'holder')
  },

  preDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === SECURITY_SCHEME_TYPE)
      .forEach(instance => {
        if (instance.value.defaultLevel === undefined) {
          instance.value.defaultLevel = NO_DEFAULT_VALUE
        }
      })

    changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === SECURITY_LEVEL_TYPE)
      .forEach(instance => {
        instance.value.levelId = instance.value.id
      })
  },

  onDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === SECURITY_SCHEME_TYPE)
      .forEach(instance => {
        if (instance.value.schemeId !== undefined) {
          delete instance.value.schemeId
        }
        if (instance.value.defaultLevel === NO_DEFAULT_VALUE) {
          delete instance.value.defaultLevel
        }
      })

    changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === SECURITY_LEVEL_TYPE)
      .forEach(instance => {
        delete instance.value.levelId
        delete instance.value.schemeId
      })
  },

  deploy: async changes => {
    const deployFunction = client.isDataCenter
      ? {
        deployScheme: (schemeChange: Change<InstanceElement>) => deployChanges(
          [schemeChange] as Change<InstanceElement>[],
          async change => {
            await defaultDeployChange({
              change,
              client,
              apiDefinitions: config.apiDefinitions,
            })
          },
        ),
        deployLevels: (levelsChanges: Change<InstanceElement>[]) => deployChanges(
          levelsChanges as Change<InstanceElement>[],
          async change => {
            try {
              await defaultDeployChange({
                change,
                client,
                apiDefinitions: config.apiDefinitions,
              })
            } catch (err) {
              if (err instanceof clientUtils.HTTPError
                && err.response.status === 404
                && isRemovalChange(change)) {
                // if delete fails on 404 it can be considered a success
                log.debug(`Received 404 error ${err.message} for ${getChangeData(change).elemID.getFullName()}. The element is already removed`)
                return
              }
              throw err
            }
          }
        ),
      }
      : {
        deployScheme: (change: Change<InstanceElement>) => deploySecurityScheme(change, config, client),
        deployLevels: (levelChanges: Change<InstanceElement>[]) =>
          deploySecurityLevels(levelChanges, config, client),
      }
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && (
          getChangeData(change).elemID.typeName === SECURITY_SCHEME_TYPE
          || getChangeData(change).elemID.typeName === SECURITY_LEVEL_TYPE
        )
    )

    const securitySchemeChange = relevantChanges
      .filter(isInstanceChange)
      .find(change => getChangeData(change).elemID.typeName === SECURITY_SCHEME_TYPE)

    const schemesDeployResult = securitySchemeChange !== undefined
      && isAdditionChange(securitySchemeChange)
      ? await deployFunction.deployScheme(securitySchemeChange)
      : {
        appliedChanges: [],
        errors: [],
      }

    if (schemesDeployResult.errors.length !== 0) {
      return {
        leftoverChanges,
        deployResult: schemesDeployResult,
      }
    }

    const levelsChanges = relevantChanges
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === SECURITY_LEVEL_TYPE)

    levelsChanges.forEach(change => {
      getChangeData(change).value.schemeId = securitySchemeChange !== undefined
        ? getChangeData(securitySchemeChange).value.id
        : getParents(getChangeData(change))[0].value.value.id
    })

    const levelsDeployResult = await deployFunction.deployLevels(levelsChanges)

    if (
      securitySchemeChange === undefined
      || levelsDeployResult.appliedChanges.length !== levelsChanges.length
      || (isAdditionChange(securitySchemeChange)
        && getChangeData(securitySchemeChange).value.defaultLevel === NO_DEFAULT_VALUE)
    ) {
      return {
        leftoverChanges,
        deployResult: objects.concatObjects([schemesDeployResult, levelsDeployResult]),
      }
    }

    const securitySchemeInstance = getChangeData(securitySchemeChange)

    if (
      isReferenceExpression(securitySchemeInstance.value.defaultLevel)
      && isInstanceElement(securitySchemeInstance.value.defaultLevel.value)
      && securitySchemeInstance.value.defaultLevel.value.value.id === undefined
    ) {
      const defaultLevelId = securitySchemeInstance.value.defaultLevel.elemID
      securitySchemeInstance.value.defaultLevel.value.value.id = levelsChanges
        .map(getChangeData)
        .find(level => level.elemID.isEqual(defaultLevelId))?.value.id
    }

    securitySchemeInstance.value.schemeId = securitySchemeInstance.value.id

    const createNoDefaultLevelDuplicate = (): Change<InstanceElement> => {
      const securitySchemeInstanceNoDefaultLevel: InstanceElement = securitySchemeInstance.clone() as InstanceElement
      delete securitySchemeInstanceNoDefaultLevel.value.defaultLevel
      return toChange({
        before: securitySchemeInstanceNoDefaultLevel,
        after: securitySchemeInstance,
      })
    }
    const deploySecurityChange: Change<InstanceElement> = isAdditionChange(securitySchemeChange)
      ? createNoDefaultLevelDuplicate()
      : securitySchemeChange

    const schemesDefaultLevelDeployResult = await deployFunction.deployScheme(deploySecurityChange)

    const schemesResults = {
      // If schemesDeployResult contains the change and both calls to deploySecurityScheme
      // were successful, we would want to return schemesDeployResult.appliedChanges because
      // it contains the original addition change and not the modification change we created
      // in this function
      appliedChanges: schemesDefaultLevelDeployResult.appliedChanges.length === 1
        && schemesDeployResult.appliedChanges.length === 1
        ? schemesDeployResult.appliedChanges
        : schemesDefaultLevelDeployResult.appliedChanges,
      errors: [...schemesDeployResult.errors, ...schemesDefaultLevelDeployResult.errors],
    }

    return {
      leftoverChanges,
      deployResult: objects.concatObjects([
        levelsDeployResult,
        schemesResults,
      ]),
    }
  },
})

export default filter
