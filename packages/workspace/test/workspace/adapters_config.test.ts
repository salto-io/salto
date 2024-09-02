/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, ObjectType, ElemID, DetailedChange, getChangeData } from '@salto-io/adapter-api'
import { parser } from '@salto-io/parser'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import wu from 'wu'
import { collections } from '@salto-io/lowerdash'
import { NaclFilesSource } from '../../src/workspace/nacl_files'
import { AdaptersConfigSource, buildAdaptersConfigSource } from '../../src/workspace/adapters_config_source'
import { RemoteMap, RemoteMapCreator } from '../../src/workspace/remote_map'
import { ValidationError } from '../../src/validator'
import * as validator from '../../src/validator'
import { createMockNaclFileSource } from '../common/nacl_file_source'
import { DuplicateAnnotationError } from '../../src/merger'
import { Errors } from '../../src/errors'

const { awu } = collections.asynciterable

describe('adapters config', () => {
  const SALESFORCE = 'adapters/salesforce'

  let mockNaclFilesSource: MockInterface<NaclFilesSource>
  let configSource: AdaptersConfigSource
  let validationErrorsMap: MockInterface<RemoteMap<ValidationError[]>>

  const configType = new ObjectType({ elemID: new ElemID(SALESFORCE, ElemID.CONFIG_NAME) })

  const mockNaclFilesSourceGetResult = new InstanceElement(
    ElemID.CONFIG_NAME,
    new ObjectType({ elemID: new ElemID(SALESFORCE, ElemID.CONFIG_NAME) }),
    {
      metadataTypesSkippedList: [
        'Report',
        'ReportType',
        'ReportFolder',
        'Dashboard',
        'DashboardFolder',
        'EmailTemplate',
      ],
      instancesRegexSkippedList: ['^ConnectedApp.CPQIntegrationUserApp$'],
      maxItemsInRetrieveRequest: 2500,
      client: {
        maxConcurrentApiRequests: {
          retrieve: 3,
        },
      },
    },
  )

  beforeEach(async () => {
    jest.resetAllMocks()
    mockNaclFilesSource = createMockNaclFileSource([])

    mockNaclFilesSource.has.mockResolvedValue(true)

    mockNaclFilesSource.get.mockResolvedValue(mockNaclFilesSourceGetResult)
    mockNaclFilesSource.getElementNaclFiles.mockResolvedValue([])
    mockNaclFilesSource.getErrors.mockResolvedValue({
      hasErrors: () => false,
      all: () => [],
      strings: () => [],
      parse: [],
      merge: [],
      validation: [],
    })

    mockNaclFilesSource.load.mockResolvedValue({ changes: [], cacheValid: true })

    mockNaclFilesSource.getAll.mockResolvedValue(awu([]))

    const configOverrides: DetailedChange[] = [
      {
        id: new ElemID(SALESFORCE, ElemID.CONFIG_NAME, 'instance', ElemID.CONFIG_NAME, 'overridden'),
        action: 'add',
        data: { after: 2 },
      },
    ]
    validationErrorsMap = {
      delete: mockFunction<RemoteMap<ValidationError[]>['delete']>(),
      get: mockFunction<RemoteMap<ValidationError[]>['get']>(),
      getMany: mockFunction<RemoteMap<ValidationError[]>['getMany']>(),
      has: mockFunction<RemoteMap<ValidationError[]>['has']>(),
      set: mockFunction<RemoteMap<ValidationError[]>['set']>(),
      setAll: mockFunction<RemoteMap<ValidationError[]>['setAll']>(),
      deleteAll: mockFunction<RemoteMap<ValidationError[]>['deleteAll']>(),
      entries: mockFunction<RemoteMap<ValidationError[]>['entries']>(),
      keys: mockFunction<RemoteMap<ValidationError[]>['keys']>(),
      values: mockFunction<RemoteMap<ValidationError[]>['values']>(),
      flush: mockFunction<RemoteMap<ValidationError[]>['flush']>(),
      revert: mockFunction<RemoteMap<ValidationError[]>['revert']>(),
      clear: mockFunction<RemoteMap<ValidationError[]>['clear']>(),
      close: mockFunction<RemoteMap<ValidationError[]>['close']>(),
      isEmpty: mockFunction<RemoteMap<ValidationError[]>['isEmpty']>(),
    }

    configSource = await buildAdaptersConfigSource({
      naclSource: mockNaclFilesSource,
      ignoreFileChanges: false,
      remoteMapCreator: mockFunction<RemoteMapCreator>().mockResolvedValue(validationErrorsMap),
      persistent: true,
      configTypes: [configType],
      configOverrides,
    })
  })

  describe('initialization', () => {
    it('when cache is invalid should recalculate errors', async () => {
      mockNaclFilesSource.load.mockResolvedValue({ changes: [], cacheValid: false })
      jest.spyOn(validator, 'validateElements').mockResolvedValue([
        new validator.InvalidValueValidationError({
          elemID: new ElemID('someID'),
          value: 'val',
          fieldName: 'field',
          expectedValue: 'expVal',
        }),
      ])

      configSource = await buildAdaptersConfigSource({
        naclSource: mockNaclFilesSource,
        ignoreFileChanges: true,
        remoteMapCreator: jest.fn().mockResolvedValue(validationErrorsMap),
        persistent: true,
        configTypes: [configType],
        configOverrides: [],
      })
      expect(validationErrorsMap.setAll).toHaveBeenCalled()
    })

    it('when cache is valid should not recalculate errors', async () => {
      jest.spyOn(validator, 'validateElements').mockResolvedValue([
        new validator.InvalidValueValidationError({
          elemID: new ElemID('someID'),
          value: 'val',
          fieldName: 'field',
          expectedValue: 'expVal',
        }),
      ])

      configSource = await buildAdaptersConfigSource({
        naclSource: mockNaclFilesSource,
        ignoreFileChanges: true,
        remoteMapCreator: jest.fn().mockResolvedValue(validationErrorsMap),
        persistent: true,
        configTypes: [configType],
        configOverrides: [],
      })
      expect(validationErrorsMap.setAll).not.toHaveBeenCalled()
    })
  })

  it('should look for adapter in nacl files source', async () => {
    await configSource.getAdapter('salesforce')
    expect(mockNaclFilesSource.get).toHaveBeenCalled()
  })

  it('should return undefined when there is not configuration', async () => {
    mockNaclFilesSource.get.mockResolvedValue(undefined)
    expect(await configSource.getAdapter('salesforce')).toBeUndefined()
  })
  it('should set adapter in nacl files source with the default path', async () => {
    await configSource.setAdapter(
      'salesforce',
      'salesforce',
      new InstanceElement(
        ElemID.CONFIG_NAME,
        new ObjectType({
          elemID: new ElemID('salesforce', ElemID.CONFIG_NAME),
        }),
      ),
    )
    expect(mockNaclFilesSource.updateNaclFiles).toHaveBeenCalledWith([
      expect.objectContaining({ path: ['salto.config', 'adapters', 'salesforce', 'salesforce'] }),
    ])
  })

  it('should set adapter in nacl files source with the config path', async () => {
    await configSource.setAdapter(
      'salesforce',
      'salesforce',
      new InstanceElement(
        ElemID.CONFIG_NAME,
        new ObjectType({
          elemID: new ElemID('salesforce', ElemID.CONFIG_NAME),
        }),
        {},
        ['dir', 'file'],
      ),
    )
    expect(mockNaclFilesSource.updateNaclFiles).toHaveBeenCalledWith([
      expect.objectContaining({ path: ['salto.config', 'adapters', 'salesforce', 'dir', 'file'] }),
    ])
  })

  it('should set adapter in nacl files source with the config path, if account name isnt same as service', async () => {
    await configSource.setAdapter(
      'salesforce2',
      'salesforce',
      new InstanceElement(
        ElemID.CONFIG_NAME,
        new ObjectType({
          elemID: new ElemID('salesforce2', ElemID.CONFIG_NAME),
        }),
      ),
    )
    expect(mockNaclFilesSource.updateNaclFiles).toHaveBeenCalledWith([
      expect.objectContaining({ path: ['salto.config', 'adapters', 'salesforce2', 'salesforce2'] }),
    ])
  })

  it('should return errors with "config" source', async () => {
    mockNaclFilesSource.getErrors.mockResolvedValue(
      new Errors({
        merge: [
          new DuplicateAnnotationError({
            elemID: new ElemID('someID'),
            key: 'key',
            existingValue: 'val',
            newValue: 'val2',
          }),
        ],
        validation: [],
        parse: [{} as parser.ParseError],
      }),
    )
    validationErrorsMap.values.mockReturnValue(
      awu([
        [
          new validator.InvalidValueValidationError({
            elemID: new ElemID('someID'),
            value: 'val',
            fieldName: 'field',
            expectedValue: 'expVal',
          }),
        ],
      ]),
    )

    const errs = await configSource.getErrors()
    expect(wu(errs.all()).every(err => err.type === 'config')).toBeTruthy()
  })

  it('should remove undefined values when setting the configuration', async () => {
    mockNaclFilesSource.get.mockResolvedValueOnce(mockNaclFilesSourceGetResult).mockResolvedValue(undefined)
    await configSource.setAdapter(
      'salesforce',
      'salesforce',
      new InstanceElement(
        ElemID.CONFIG_NAME,
        new ObjectType({
          elemID: new ElemID('salesforce', ElemID.CONFIG_NAME),
        }),
        { value: { inner1: undefined, inner2: 2, inner3: [] } },
      ),
    )
    const receivedChange = mockNaclFilesSource.updateNaclFiles.mock.calls[1][0][0]
    expect(getChangeData(receivedChange).value).toEqual({ value: { inner2: 2, inner3: [] } })
  })

  it('getElementNaclFiles should return the configuration files', async () => {
    mockNaclFilesSource.listNaclFiles.mockResolvedValue([
      'salto.config/adapters/salesforce/a/b',
      'salto.config/adapters/salesforce/c',
      'salto.config/adapters/dummy/d',
    ])
    const paths = await configSource.getElementNaclFiles('salesforce')
    expect(paths).toEqual(['salto.config/adapters/salesforce/a/b', 'salto.config/adapters/salesforce/c'])
  })

  describe('configOverrides', () => {
    it('should apply config overrides', async () => {
      expect((await configSource.getAdapter(SALESFORCE))?.value.overridden).toBe(2)
    })

    it('update to an overridden field should throw an exception', async () => {
      const conf = (await configSource.getAdapter(SALESFORCE)) as InstanceElement
      conf.value.overridden = 3
      await expect(configSource.setAdapter(SALESFORCE, SALESFORCE, conf)).rejects.toThrow()
      expect(mockNaclFilesSource.updateNaclFiles).not.toHaveBeenCalled()
    })

    it('update a none overridden field should not throw an exception', async () => {
      mockNaclFilesSource.get.mockResolvedValueOnce(mockNaclFilesSourceGetResult).mockResolvedValue(undefined)
      const conf = (await configSource.getAdapter(SALESFORCE)) as InstanceElement
      conf.value.other = 3
      await configSource.setAdapter(SALESFORCE, SALESFORCE, conf)
      expect(mockNaclFilesSource.updateNaclFiles).toHaveBeenCalled()
    })

    it('should call updateNaclFiles twice when there is no configuration', async () => {
      const conf = (await configSource.getAdapter(SALESFORCE)) as InstanceElement
      mockNaclFilesSource.get.mockResolvedValue(undefined)
      await configSource.setAdapter(SALESFORCE, SALESFORCE, conf)
      expect(mockNaclFilesSource.updateNaclFiles).toHaveBeenCalledTimes(2)
    })

    it('setNaclFile should recalculate errors', async () => {
      jest.spyOn(validator, 'validateElements').mockResolvedValue([
        new validator.InvalidValueValidationError({
          elemID: new ElemID('someID'),
          value: 'val',
          fieldName: 'field',
          expectedValue: 'expVal',
        }),
      ])

      await configSource.setNaclFiles([])
      expect(validationErrorsMap.setAll).toHaveBeenCalled()
    })

    describe('when calling flush', () => {
      beforeEach(async () => {
        await configSource.flush()
      })

      it('should call naclSource flush', () => {
        expect(mockNaclFilesSource.flush).toHaveBeenCalled()
      })

      it('should call validationErrorsMap flush', () => {
        expect(validationErrorsMap.flush).toHaveBeenCalled()
      })
    })
  })
})
