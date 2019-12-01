import jszip from 'jszip'
import { BuiltinTypes, ElemID, Field, InstanceElement, ObjectType } from 'adapter-api'
import _ from 'lodash'
import { fromRetrieveResult, toMetadataPackageZip } from '../../src/transformers/xml_transformer'
import { INSTANCE_FULL_NAME_FIELD, METADATA_TYPE, SALESFORCE } from '../../src/constants'
import { ASSIGNMENT_RULES_TYPE_ID } from '../../src/filters/assignment_rules'
import { apiName, metadataType } from '../../src/transformers/transformer'


describe('XML Transformer', () => {
  const PACKAGE = 'unpackaged'
  describe('toMetadataPackageZip of assignment rule', () => {
    const assignmentRulesType = new ObjectType({
      elemID: ASSIGNMENT_RULES_TYPE_ID,
      annotations: {
        [METADATA_TYPE]: 'AssignmentRules',
      },
      fields: {
        str: new Field(ASSIGNMENT_RULES_TYPE_ID, 'str', BuiltinTypes.STRING),
        lst: new Field(ASSIGNMENT_RULES_TYPE_ID, 'lst', BuiltinTypes.NUMBER, {}, true),
        bool: new Field(ASSIGNMENT_RULES_TYPE_ID, 'bool', BuiltinTypes.BOOLEAN),
      },
    })
    const assignmentRuleInstance = new InstanceElement(
      'instance',
      assignmentRulesType,
      {
        [INSTANCE_FULL_NAME_FIELD]: 'Instance',
        str: 'val',
        lst: [1, 2],
        bool: true,
      },
    )

    const zip = toMetadataPackageZip(apiName(assignmentRuleInstance),
      metadataType(assignmentRuleInstance), assignmentRuleInstance.value, false)
      .then(buf => jszip.loadAsync(buf as Buffer))

    it('should contain package xml', async () => {
      const packageXml = (await zip).files[`${PACKAGE}/package.xml`]
      expect(packageXml).toBeDefined()
      expect(await packageXml.async('text')).toMatch(
        `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <version>46.0</version>
           <types><members>Instance</members><name>AssignmentRules</name></types>
         </Package>`.replace(/>\s+</gs, '><')
      )
    })

    it('should contain instance xml', async () => {
      const instanceXml = (await zip).files[`${PACKAGE}/assignmentRules/Instance.assignmentRules`]
      expect(instanceXml).toBeDefined()
      expect(await instanceXml.async('text')).toMatch(
        `<AssignmentRules xmlns="http://soap.sforce.com/2006/04/metadata">
           <str>val</str>
           <lst>1</lst>
           <lst>2</lst>
           <bool>true</bool>
         </AssignmentRules>`.replace(/>\s+</gs, '><')
      )
    })
  })

  describe('toMetadataPackageZip of apex class', () => {
    const apexTypeElemID = new ElemID(SALESFORCE, 'apex_class')
    const apiVersion = 'api_version'
    const apexClassType = new ObjectType({
      elemID: apexTypeElemID,
      annotations: {
        [METADATA_TYPE]: 'ApexClass',
      },
      fields: {
        [apiVersion]: new Field(apexTypeElemID, apiVersion, BuiltinTypes.NUMBER),
        content: new Field(apexTypeElemID, 'content', BuiltinTypes.STRING),
      },
    })
    const apexClassInstance = new InstanceElement(
      'instance',
      apexClassType,
      {
        [INSTANCE_FULL_NAME_FIELD]: 'MyApexClass',
        [apiVersion]: 46.0,
        content: 'public class MyApexClass {\n    public void printLog() {\n        System.debug(\'Created\');\n    }\n}',
      },
    )

    const zip = toMetadataPackageZip(apiName(apexClassInstance), metadataType(apexClassInstance),
      apexClassInstance.value, false)
      .then(buf => jszip.loadAsync(buf as Buffer))

    it('should contain package xml', async () => {
      const packageXml = (await zip).files[`${PACKAGE}/package.xml`]
      expect(packageXml).toBeDefined()
      expect(await packageXml.async('text')).toMatch(
        `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <version>46.0</version>
           <types><members>MyApexClass</members><name>ApexClass</name></types>
         </Package>`.replace(/>\s+</gs, '><')
      )
    })

    it('should contain metadata xml', async () => {
      const instanceXml = (await zip).files[`${PACKAGE}/classes/MyApexClass.cls-meta.xml`]
      expect(instanceXml).toBeDefined()
      expect(await instanceXml.async('text')).toMatch(
        `<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
           <apiVersion>46</apiVersion>
         </ApexClass>`.replace(/>\s+</gs, '><')
      )
    })

    it('should contain instance content', async () => {
      const instanceXml = (await zip).files[`${PACKAGE}/classes/MyApexClass.cls`]
      expect(instanceXml).toBeDefined()
      expect(await instanceXml.async('text'))
        .toMatch('public class MyApexClass {\n    public void printLog() {\n        System.debug(\'Created\');\n    }\n}')
    })
  })
  describe('toMetadataPackageZip in deletion flow', () => {
    const apexTypeElemID = new ElemID(SALESFORCE, 'apex_class')
    const apiVersion = 'api_version'
    const apexClassType = new ObjectType({
      elemID: apexTypeElemID,
      annotations: {
        [METADATA_TYPE]: 'ApexClass',
      },
      fields: {
        // eslint-disable-next-line @typescript-eslint/camelcase
        [apiVersion]: new Field(apexTypeElemID, apiVersion, BuiltinTypes.NUMBER),
        content: new Field(apexTypeElemID, 'content', BuiltinTypes.STRING),
      },
    })
    const apexClassInstance = new InstanceElement(
      'instance',
      apexClassType,
      {
        [INSTANCE_FULL_NAME_FIELD]: 'MyApexClass',
        [apiVersion]: 46.0,
        content: 'public class MyApexClass {\n    public void printLog() {\n        System.debug(\'Created\');\n    }\n}',
      },
    )

    const zip = toMetadataPackageZip(apiName(apexClassInstance), metadataType(apexClassInstance),
      apexClassInstance.value, true)
      .then(buf => jszip.loadAsync(buf as Buffer))

    it('should contain package xml', async () => {
      const packageXml = (await zip).files[`${PACKAGE}/package.xml`]
      expect(packageXml).toBeDefined()
      expect(await packageXml.async('text')).toMatch(
        `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <version>46.0</version>
         </Package>`.replace(/>\s+</gs, '><')
      )
    })

    it('should contain destructive changes xml', async () => {
      const packageXml = (await zip).files[`${PACKAGE}/destructiveChanges.xml`]
      expect(packageXml).toBeDefined()
      expect(await packageXml.async('text')).toMatch(
        `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <types><members>MyApexClass</members><name>ApexClass</name></types>
         </Package>`.replace(/>\s+</gs, '><')
      )
    })
  })

  describe('fromRetrieveResult', () => {
    const retrieveResult = {
      fileProperties:
        [{
          createdById: '0054J000002KGspQAG',
          createdByName: 'createdBy',
          createdDate: '2019-12-01T14:31:36.000Z',
          fileName: 'classes/MyApexClass.cls',
          fullName: 'MyApexClass',
          id: '01p4J00000JcCoFQAV',
          lastModifiedById: '0054J000002KGspQAG',
          lastModifiedByName: 'modifiedBy',
          lastModifiedDate: '2019-12-01T14:31:36.000Z',
          manageableState: 'unmanaged',
          type: 'ApexClass',
        }],
      id: '09S4J000001dSRcUAM',
      messages: [],
      zipFile:
        'UEsDBBQACAgIALFhhU8AAAAAAAAAAAAAAAAiAAAAdW5wYWNrYWdlZC9jbGFzc2VzL015QXBleENsYXNzLmNscysoTcrJTFZIzkksLlbwrXQsSK1wBrOruRSAoAAiXZafmaJQUJSZV+KTn66hCZUEgeDK4pLUXL2U1KTSdA1156LUxJLUFHVNa7CCWq5aAFBLBwhoWu8NTgAAAGAAAABQSwMEFAAICAgAsWGFTwAAAAAAAAAAAAAAACsAAAB1bnBhY2thZ2VkL2NsYXNzZXMvTXlBcGV4Q2xhc3MuY2xzLW1ldGEueG1sTY1BCsIwEEX3OUXI3kyUUkTSlCJ4AnU/pFEDbRI6Y+nxLVTEv3ufB8+2yzjIOUwUc2rUXhslQ/K5j+nZqNv1sjuq1gnblbCcBySSq5+oUS/mcgKgjEXTI08+aJ9HOBhTg6lgDIw9Mion5DqLJd63iKtqbSz8HZtBjPwm13mOc7DwRWHhl3biA1BLBwhAKe+TiAAAAK4AAABQSwMEFAAICAgAsWGFTwAAAAAAAAAAAAAAABYAAAB1bnBhY2thZ2VkL3BhY2thZ2UueG1sTY7NCsIwEITvfYqQo2A2SikiaYoInj3oA6zpqsXmhyZIfXtLf9A5zccuM6Oq3rbsTV1svCv5RkjOyBlfN+5R8uvltN7xSmfqjOaFD2LDt4slf6YU9gDRYxDx7jtDwngLWykLkDlYSlhjQq4zNkilT6A4+ZEt2dtQqVcKFvs7OrSkD4H6Y4sxKhh5yoG/IDWP1nkhpIKFMgXzVp19AVBLBwhbjqgSnQAAAN0AAABQSwECFAAUAAgICACxYYVPaFrvDU4AAABgAAAAIgAAAAAAAAAAAAAAAAAAAAAAdW5wYWNrYWdlZC9jbGFzc2VzL015QXBleENsYXNzLmNsc1BLAQIUABQACAgIALFhhU9AKe+TiAAAAK4AAAArAAAAAAAAAAAAAAAAAJ4AAAB1bnBhY2thZ2VkL2NsYXNzZXMvTXlBcGV4Q2xhc3MuY2xzLW1ldGEueG1sUEsBAhQAFAAICAgAsWGFT1uOqBKdAAAA3QAAABYAAAAAAAAAAAAAAAAAfwEAAHVucGFja2FnZWQvcGFja2FnZS54bWxQSwUGAAAAAAMAAwDtAAAAYAIAAAAA',
    }

    it('should transform zip to MetadataInfo', async () => {
      const typeNameToInstanceInfos = await fromRetrieveResult(retrieveResult, ['ApexClass'])
      const [metadataInfo] = typeNameToInstanceInfos.ApexClass
      expect(metadataInfo.fullName).toEqual('MyApexClass')
      expect(_.get(metadataInfo, 'apiVersion')).toEqual(46)
      expect(_.get(metadataInfo, 'status')).toEqual('Active')
      expect(_.get(metadataInfo, 'content'))
        .toEqual('public class MyApexClass {\n    public void printLog() {\n        System.debug(\'Created\');\n    }\n}')
    })
  })
})
