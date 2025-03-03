/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Adapter,
  ElemID,
  CORE_ANNOTATIONS,
  BuiltinTypes,
  ObjectType,
  ListType,
  GetCustomReferencesFunc,
  ConfigCreator,
  createRestriction,
  AdapterFormat,
  Change,
} from '@salto-io/adapter-api'
import {
  createDefaultInstanceFromType,
  inspectValue,
  getDetailedChanges,
  ERROR_MESSAGES,
} from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { initLocalWorkspace, loadLocalWorkspace } from '@salto-io/local-workspace'
import { logger } from '@salto-io/logging'
import { Workspace } from '@salto-io/workspace'
import _ from 'lodash'
import DummyAdapter from './adapter'
import { GeneratorParams, DUMMY_ADAPTER, defaultParams, changeErrorType, fetchErrorType } from './generator'

const { awu } = collections.asynciterable

const log = logger(module)

const configType = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER),
  fields: {
    ..._.mapValues(defaultParams, defValue => ({
      refType: _.isBoolean(defValue) ? BuiltinTypes.BOOLEAN : BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: defValue,
      },
    })),
    changeErrors: { refType: new ListType(changeErrorType) },
    extraNaclPaths: { refType: new ListType(BuiltinTypes.STRING) },
    generateEnvName: { refType: BuiltinTypes.STRING },
    failDeploy: { refType: BuiltinTypes.BOOLEAN },
    fieldsToOmitOnDeploy: { refType: new ListType(BuiltinTypes.STRING) },
    // Exclude elements from the fetch by their elemIDs
    elementsToExclude: { refType: new ListType(BuiltinTypes.STRING) },
    importantValuesFreq: { refType: new ListType(BuiltinTypes.NUMBER) },
    templateExpressionFreq: { refType: new ListType(BuiltinTypes.NUMBER) },
    templateStaticFileFreq: { refType: new ListType(BuiltinTypes.NUMBER) },
    fetchErrors: { refType: new ListType(fetchErrorType) },
  },
})

const getCustomReferences: GetCustomReferencesFunc = async elements =>
  elements.find(e => e.elemID.getFullName() === 'dummy.Full.instance.FullInst1')
    ? [
        {
          source: ElemID.fromFullName('dummy.Full.instance.FullInst1.strField'),
          target: ElemID.fromFullName('dummy.Full.instance.FullInst2.strField'),
          type: 'weak',
        },
      ]
    : []

const slimAdapter: Adapter = {
  operations: context => new DummyAdapter(context.config?.value as GeneratorParams),
  validateCredentials: async () => ({ accountId: '' }),
  authenticationMethods: {
    basic: {
      credentialsType: new ObjectType({ elemID: new ElemID(DUMMY_ADAPTER) }),
    },
  },
}

const adapterCreators = { dummy: slimAdapter }

const loadWorkspace = async ({ baseDir, persistent }: { baseDir: string; persistent: boolean }): Promise<Workspace> =>
  loadLocalWorkspace({
    path: baseDir,
    persistent,
    adapterCreators,
  })

const loadElementsFromFolder: AdapterFormat['loadElementsFromFolder'] = async ({ baseDir }) => {
  let workspace: Workspace | undefined
  try {
    workspace = await loadWorkspace({ baseDir, persistent: true })
    const elements = await workspace.elements()
    return { elements: await awu(await elements.getAll()).toArray() }
  } catch (error) {
    return {
      elements: [],
      errors: [
        {
          severity: 'Error',
          message: ERROR_MESSAGES.OTHER_ISSUES,
          detailedMessage: inspectValue(error),
        },
      ],
    }
  } finally {
    await workspace?.close()
  }
}

const dumpElementsToFolder: AdapterFormat['dumpElementsToFolder'] = async ({ baseDir, changes }) => {
  let workspace: Workspace | undefined
  try {
    workspace = await loadWorkspace({ baseDir, persistent: true })
    await workspace.updateNaclFiles(
      changes.flatMap(c => getDetailedChanges(c)),
      'isolated',
    )
    await workspace.flush()
    return {
      unappliedChanges: [] as Change[],
      errors: [],
    }
  } catch (error) {
    return {
      unappliedChanges: [],
      errors: [
        {
          severity: 'Error',
          message: 'Failed dumpElementsToFolder in Dummy project',
          detailedMessage: inspectValue(error),
        },
      ],
    }
  } finally {
    await workspace?.close()
  }
}

const initFolder: AdapterFormat['initFolder'] = async ({ baseDir }) => {
  let workspace: Workspace | undefined
  try {
    workspace = await initLocalWorkspace({
      baseDir,
      envName: 'dummy',
      adapterCreators,
    })
    return {
      errors: [],
    }
  } catch (error) {
    return {
      errors: [
        {
          severity: 'Error',
          message: 'Failed initializing Dummy project',
          detailedMessage: inspectValue(error),
        },
      ],
    }
  } finally {
    await workspace?.close()
  }
}

const isInitializedFolder: AdapterFormat['isInitializedFolder'] = async ({ baseDir }) => {
  let workspace: Workspace | undefined
  try {
    workspace = await loadWorkspace({ baseDir, persistent: false })
    return { result: true, errors: [] }
  } catch (error) {
    return {
      result: false,
      errors: [
        {
          severity: 'Error',
          message: 'Failed checking if dummy project is initialized',
          detailedMessage: inspectValue(error),
        },
      ],
    }
  } finally {
    await workspace?.close()
  }
}

const objectFieldType = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER, 'objectFieldType'),
  fields: {
    stringField: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.DESCRIPTION]: 'String Field' } },
    numberField: {
      refType: BuiltinTypes.NUMBER,
      annotations: { [CORE_ANNOTATIONS.REQUIRED]: true, [CORE_ANNOTATIONS.ALIAS]: 'Number Field' },
    },
  },
})

const optionsType = new ObjectType({
  elemID: new ElemID(DUMMY_ADAPTER, 'configOptionsType'),
  fields: {
    min10Field: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ min: 10 }),
      },
    },
    max10Field: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max: 10 }),
      },
    },
    between10And20Field: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ min: 10, max: 20 }),
      },
    },
    startsWithHelloField: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^Hello.*' }),
      },
    },
    maxLength5List: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_list_length: 5 }),
      },
    },
    maxLength5String: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 5 }),
      },
    },
    requiredStringField: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [CORE_ANNOTATIONS.DESCRIPTION]: 'Required String Field',
        [CORE_ANNOTATIONS.ALIAS]: 'Required String Field',
      },
    },
    booleanField: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.DESCRIPTION]: 'Boolean Field',
        [CORE_ANNOTATIONS.ALIAS]: 'Boolean Field',
      },
    },
    numberField: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [CORE_ANNOTATIONS.DESCRIPTION]: 'Number Field',
        [CORE_ANNOTATIONS.ALIAS]: 'Number Field',
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: [1, 2, 3],
          enforce_value: true,
        }),
      },
    },
    listOfStrings: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.DESCRIPTION]: 'List of strings',
        [CORE_ANNOTATIONS.ALIAS]: 'List of strings',
      },
    },
    restrictedListOfStrings: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.DESCRIPTION]: 'Restricted List of strings',
        [CORE_ANNOTATIONS.ALIAS]: 'Restricted List Of Strings',
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: ['first value', 'second value', 'third value'],
          enforce_value: false,
        }),
      },
    },
    enforcedRestrictedListOfStrings: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.DESCRIPTION]: 'Enforced Restricted List of strings',
        [CORE_ANNOTATIONS.ALIAS]: 'Enforced Restricted List Of Strings',
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: ['first value', 'second value', 'third value'],
          enforce_value: true,
        }),
      },
    },
    objectField: {
      refType: objectFieldType,
      annotations: {
        [CORE_ANNOTATIONS.DESCRIPTION]: 'Object Field',
        [CORE_ANNOTATIONS.ALIAS]: 'Object Field',
      },
    },
    listOfObjectField: {
      refType: new ListType(objectFieldType),
      annotations: {
        [CORE_ANNOTATIONS.DESCRIPTION]: 'List of Object Field',
        [CORE_ANNOTATIONS.ALIAS]: 'List of Object Field',
      },
    },
  },
})

const configCreator: ConfigCreator = {
  getOptionsType: () => optionsType,
  getConfig: options => {
    log.debug('Invoked dummy configCreator with options %s', inspectValue(options))
    return createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType)
  },
}

export const adapter: Adapter = {
  operations: context => new DummyAdapter(context.config?.value as GeneratorParams),
  validateCredentials: async () => ({ accountId: '' }),
  authenticationMethods: {
    basic: {
      credentialsType: new ObjectType({ elemID: new ElemID(DUMMY_ADAPTER) }),
    },
  },
  configType,
  getCustomReferences,
  configCreator,
  adapterFormat: {
    loadElementsFromFolder,
    dumpElementsToFolder,
    initFolder,
    isInitializedFolder,
  },
}
