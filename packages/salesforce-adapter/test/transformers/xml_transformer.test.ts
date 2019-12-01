import jszip from 'jszip'
import { BuiltinTypes, ElemID, Field, InstanceElement, ObjectType } from 'adapter-api'
import { FileProperties } from 'jsforce'
import _ from 'lodash'
import { fromRetrieveResult, toMetadataPackageZip } from '../../src/transformers/xml_transformer'
import { INSTANCE_FULL_NAME_FIELD, METADATA_TYPE, SALESFORCE } from '../../src/constants'
import { ASSIGNMENT_RULES_TYPE_ID } from '../../src/filters/assignment_rules'


describe('XML Transformer', () => {
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

    const zip = toMetadataPackageZip(assignmentRuleInstance)
      .then(buf => jszip.loadAsync(buf))

    it('should contain package xml', async () => {
      const packageXml = (await zip).files['default/package.xml']
      expect(packageXml).toBeDefined()
      expect(await packageXml.async('text')).toMatch(
        `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <version>46.0</version>
           <types><members>Instance</members><name>AssignmentRules</name></types>
         </Package>`.replace(/>\s+</gs, '><')
      )
    })

    it('should contain instance xml', async () => {
      const instanceXml = (await zip).files['default/assignmentRules/Instance.assignmentRules']
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

    const zip = toMetadataPackageZip(apexClassInstance)
      .then(buf => jszip.loadAsync(buf))

    it('should contain package xml', async () => {
      const packageXml = (await zip).files['default/package.xml']
      expect(packageXml).toBeDefined()
      expect(await packageXml.async('text')).toMatch(
        `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <version>46.0</version>
           <types><members>MyApexClass</members><name>ApexClass</name></types>
         </Package>`.replace(/>\s+</gs, '><')
      )
    })

    it('should contain metadata xml', async () => {
      const instanceXml = (await zip).files['default/classes/MyApexClass.cls-meta.xml']
      expect(instanceXml).toBeDefined()
      expect(await instanceXml.async('text')).toMatch(
        `<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
           <apiVersion>46.0</apiVersion>
         </ApexClass>`.replace(/>\s+</gs, '><')
      )
    })

    it('should contain instance content', async () => {
      const instanceXml = (await zip).files['default/classes/MyApexClass.cls']
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

    const zip = toMetadataPackageZip(apexClassInstance, true)
      .then(buf => jszip.loadAsync(buf))

    it('should contain package xml', async () => {
      const packageXml = (await zip).files['default/package.xml']
      expect(packageXml).toBeDefined()
      expect(await packageXml.async('text')).toMatch(
        `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <version>46.0</version>
         </Package>`.replace(/>\s+</gs, '><')
      )
    })

    it('should contain destructive changes xml', async () => {
      const packageXml = (await zip).files['default/destructiveChanges.xml']
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
        'UEsDBBQACAgIAO51gU8AAAAAAAAAAAAAAAAXAAAAY2xhc3Nlcy9NeUFwZXhDbGFzcy5jbHMrKE3KyUxWSM5JLC5W8K10LEitcAazq7kUgKAAIl2Wn5miUFCUmVfik5+uoQmVBIHgyuKS1Fy9lNSk0nQNdeei1MSS1BR1TWuwglquWgBQSwcIaFrvDU4AAABgAAAAUEsDBBQACAgIAO51gU8AAAAAAAAAAAAAAAAgAAAAY2xhc3Nlcy9NeUFwZXhDbGFzcy5jbHMtbWV0YS54bWxNjUEKwjAQRfc5RcjeTJRSRNKUIngCdT+kUQNtEjpj6fEtVMS/e58Hz7bLOMg5TBRzatReGyVD8rmP6dmo2/WyO6rWCduVsJwHJJKrn6hRL+ZyAqCMRdMjTz5on0c4GFODqWAMjD0yKifkOosl3reIq2ptLPwdm0GM/CbXeY5zsPBFYeGXduIDUEsHCEAp75OIAAAArgAAAFBLAQIUABQACAgIAO51gU9oWu8NTgAAAGAAAAAXAAAAAAAAAAAAAAAAAAAAAABjbGFzc2VzL015QXBleENsYXNzLmNsc1BLAQIUABQACAgIAO51gU9AKe+TiAAAAK4AAAAgAAAAAAAAAAAAAAAAAJMAAABjbGFzc2VzL015QXBleENsYXNzLmNscy1tZXRhLnhtbFBLBQYAAAAAAgACAJMAAABpAQAAAAA=',
    }

    it('should transform zip to MetadataInfo', async () => {
      const [metadataInfo] = await fromRetrieveResult(retrieveResult,
        [{ fileName: 'classes/MyApexClass.cls', fullName: 'MyApexClass' } as FileProperties])
      expect(metadataInfo.fullName).toEqual('MyApexClass')
      expect(_.get(metadataInfo, 'apiVersion')).toEqual('46.0')
      expect(_.get(metadataInfo, 'content'))
        .toEqual('public class MyApexClass {\n    public void printLog() {\n        System.debug(\'Created\');\n    }\n}')
    })

    it('should ignore files that are not that are not requested', async () => {
      const metadataInfos = await fromRetrieveResult(retrieveResult, [])
      expect(metadataInfos).toHaveLength(0)
    })
  })
})
