/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  FetchResult,
  AdapterOperations,
  DeployResult,
  FetchOptions,
  DeployOptions,
  DeployModifiers,
  getChangeData,
  isInstanceElement,
  FixElementsFunc,
} from '@salto-io/adapter-api'
import { generateElements, generateFetchErrorsFromConfig, GeneratorParams } from './generator'
import { changeValidator } from './change_validator'

export default class DummyAdapter implements AdapterOperations {
  public constructor(private genParams: GeneratorParams) {}

  /**
   * Fetch configuration elements: objects, types and instances for the given HubSpot account.
   * Account credentials were given in the constructor.
   */
  public async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    return {
      elements: await generateElements(this.genParams, progressReporter),
      errors: generateFetchErrorsFromConfig(this.genParams.fetchErrors),
    }
  }

  public async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    if (this.genParams.failDeploy) {
      return {
        appliedChanges: [],
        errors: [],
      }
    }

    changeGroup.changes
      .map(getChangeData)
      .filter(isInstanceElement)
      .forEach(instance => {
        instance.value = _.omit(instance.value, this.genParams.fieldsToOmitOnDeploy ?? [])
      })

    return {
      appliedChanges: changeGroup.changes,
      errors: [],
    }
  }

  // eslint-disable-next-line class-methods-use-this
  public async validate({ changeGroup }: DeployOptions): Promise<DeployResult> {
    return {
      appliedChanges: changeGroup.changes,
      errors: [],
    }
  }

  public get deployModifiers(): DeployModifiers {
    return {
      changeValidator: changeValidator(this.genParams),
    }
  }

  // eslint-disable-next-line class-methods-use-this
  fixElements: FixElementsFunc = async elements => {
    const fullInst1 = elements.find(e => e.elemID.getFullName() === 'dummy.Full.instance.FullInst1')
    if (!isInstanceElement(fullInst1)) {
      return { fixedElements: [], errors: [] }
    }

    if (fullInst1.value.strField === undefined) {
      return { fixedElements: [], errors: [] }
    }

    const clonedInstance = fullInst1.clone()
    delete clonedInstance.value.strField

    return {
      fixedElements: [clonedInstance],
      errors: [
        {
          message: 'Fixed instance',
          detailedMessage: 'Removed strField from instance',
          severity: 'Info',
          elemID: fullInst1.elemID,
        },
      ],
    }
  }
}
