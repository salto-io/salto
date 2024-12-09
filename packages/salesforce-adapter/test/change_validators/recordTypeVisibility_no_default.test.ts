/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

// import { Change, ElemID, InstanceElement, ObjectType, toChange, Value } from '@salto-io/adapter-api'
// import { PROFILE_METADATA_TYPE, SALESFORCE } from '../../src/constants'

// const createChangesWithElements = (instances: InstanceElement[]): Change[] => {
//   const changes = instances.map(instance => toChange({ after: instance }))
//   return changes
// }

// const createRecordTypeVisibilitiesFieldsSingleSection = (
//   visibility1: boolean,
//   default1: boolean,
//   visibility2: boolean,
//   default2: boolean,
// ): Value => ({
//   innerSection: {
//     internal1: { visible: visibility1, default: default1 },
//     internal2: { visible: visibility2, default: default2 },
//   },
// })

// const createRecordTypeVisibilitiesFieldsMultiSection = (
//   sec1visibility1: boolean,
//   sec1default1: boolean,
//   sec1visibility2: boolean,
//   sec1default2: boolean,
//   sec2visibility: boolean,
//   sec2default: boolean,
// ): Value => ({
//   section1: {
//     internal1: { visible: sec1visibility1, default: sec1default1 },
//     internal2: { visible: sec1visibility2, default: sec1default2 },
//   },
//   section2: { internal: { visible: sec2visibility, default: sec2default } },
// })

// const createInstance = (name: string, reordTypeVisibilitiesFields: Value, typeName?: string): InstanceElement =>
//   new InstanceElement(name, new ObjectType({ elemID: new ElemID(SALESFORCE, typeName ?? PROFILE_METADATA_TYPE) }), {
//     recordTypeVisibilities: reordTypeVisibilitiesFields,
//   })

// describe('recordTypeVisibility no default change validator', () => {
//   describe('when no default is true and no visible is true', () => {
//     it('should have no errors', async () => {
//       const changes = createChangesWithElements([
//         createInstance('admin', createRecordTypeVisibilitiesFieldsSingleSection(false, false, false, false)),
//       ])
//       const errs = await changeValidator(changes)
//       expect(errs).toHaveLength(0)
//     })
//   })
//   describe('when there is no default that is true but there is visible that is true', () => {
//     it('should have an error', async () => {
//       const changes = createChangesWithElements([
//         createInstance('admin', createRecordTypeVisibilitiesFieldsSingleSection(false, false, true, false)),
//       ])
//       const errs = await changeValidator(changes)
//       expect(errs).toHaveLength(1)
//       expect(errs[0].severity).toEqual('Error')
//     })
//   })
//   describe('when there is default true but no visible that is true', () => {
//     it('should have an error', async () => {
//       const changes = createChangesWithElements([
//         createInstance('admin', createRecordTypeVisibilitiesFieldsSingleSection(false, false, false, true)),
//       ])
//       const errs = await changeValidator(changes)
//       expect(errs).toHaveLength(1)
//       expect(errs[0].severity).toEqual('Error')
//     })
//   })
//   describe('when there is default that is true and is visible', () => {
//     it('should have no errors', async () => {
//       const changes = createChangesWithElements([
//         createInstance('admin', createRecordTypeVisibilitiesFieldsSingleSection(false, false, true, true)),
//       ])
//       const errs = await changeValidator(changes)
//       expect(errs).toHaveLength(0)
//     })
//   })
//   describe('when metadata type is not supported by the CV', () => {
//     it('should return no errors', async () => {
//       const changes = createChangesWithElements([
//         createInstance('admin', createRecordTypeVisibilitiesFieldsSingleSection(false, false, false, true), 'diffType'),
//       ])
//       const errs = await changeValidator(changes)
//       expect(errs).toHaveLength(0)
//     })
//   })
//   describe('when profile has multiple sections', () => {
//     it('should treat each section separately', async () => {
//       const changes = createChangesWithElements([
//         createInstance('admin', createRecordTypeVisibilitiesFieldsMultiSection(true, false, false, false, true, true)),
//       ])
//       const errs = await changeValidator(changes)
//       expect(errs).toHaveLength(1)
//       expect(errs[0].detailedMessage).toContain('section1')
//     })
//   })
//   describe('when multiple elements pass', () => {
//     it('should search for errors for each section of each profile', async () => {
//       const changes = createChangesWithElements([
//         createInstance('admin', createRecordTypeVisibilitiesFieldsMultiSection(true, false, false, false, true, true)),
//         createInstance('user', createRecordTypeVisibilitiesFieldsSingleSection(false, false, false, true)),
//         createInstance(
//           'customer',
//           createRecordTypeVisibilitiesFieldsSingleSection(false, false, false, true),
//           'Account',
//         ),
//       ])
//       const errs = await changeValidator(changes)
//       const messages = errs.reduce<string>((res, curr) => res + curr.detailedMessage, '')
//       expect(errs).toHaveLength(2)
//       expect(messages).toContain('admin')
//       expect(messages).toContain('section1')
//       expect(messages).toContain('user')
//       expect(messages).toContain('innerSection')
//       expect(messages).not.toContain('customer')
//     })
//   })
// })
