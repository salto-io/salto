{
  "displayName": "chocoinstall.intunewin",
  "description": "chocoinstall.intunewin",
  "publisher": "mardahl",
  "isFeatured": false,
  "privacyInformationUrl": "",
  "owner": "",
  "developer": "",
  "notes": "",
  "roleScopeTagIds": [],
  "committedContentVersion": "1",
  "fileName": "chocoinstall.intunewin",
  "size": 22048,
  "installCommandLine": "powershell -ex bypass -file ChocoInstall.ps1 -package adobereader",
  "uninstallCommandLine": "powershell -ex bypass -file ChocoInstall.ps1 -package adobereader -uninstall",
  "applicableArchitectures": "x86,x64",
  "setupFilePath": "chocoinstall.ps1",
  "minimumSupportedWindowsRelease": "1607",
  "displayVersion": "",
  "allowAvailableUninstall": true,
  "minimumSupportedOperatingSystem": {
    "v8_0": false,
    "v8_1": false,
    "v10_0": false,
    "v10_1607": true,
    "v10_1703": false,
    "v10_1709": false,
    "v10_1803": false,
    "v10_1809": false,
    "v10_1903": false,
    "v10_1909": false,
    "v10_2004": false,
    "v10_2H20": false,
    "v10_21H1": false
  },
  "detectionRules": [
    {
      "@odata.type": "#microsoft.graph.win32LobAppPowerShellScriptDetection",
      "enforceSignatureCheck": false,
      "runAs32Bit": false,
      "scriptContent": "CiMgVGhpcyBpcyBhIHNpbXBsZSBQb3dlclNoZWxsIHNjcmlwdCBleGFtcGxlLgoKIyBQcmludCBhIHdlbGNvbWUgbWVzc2FnZQpXcml0ZS1PdXRwdXQgIldlbGNvbWUgdG8gdGhlIFBvd2VyU2hlbGwgc2NyaXB0ISIKCiMgQXNzaWduIGEgdmFyaWFibGUKJG5hbWUgPSAiVXNlciIKCiMgVXNlIHRoZSB2YXJpYWJsZQpXcml0ZS1PdXRwdXQgIkhlbGxvLCAkbmFtZSEiCgojIENoZWNrIGlmIGEgZGlyZWN0b3J5IGV4aXN0cywgYW5kIGNyZWF0ZSBpdCBpZiBpdCBkb2Vzbid0CiRkaXJlY3RvcnkgPSAiQzpcVGVtcFxleGFtcGxlX2RpcmVjdG9yeSIKCmlmICgtTm90IChUZXN0LVBhdGggLVBhdGggJGRpcmVjdG9yeSkpIHsKICAgIFdyaXRlLU91dHB1dCAiRGlyZWN0b3J5ICRkaXJlY3RvcnkgZG9lcyBub3QgZXhpc3QuIENyZWF0aW5nIGl0IG5vdy4uLiIKICAgIE5ldy1JdGVtIC1JdGVtVHlwZSBEaXJlY3RvcnkgLVBhdGggJGRpcmVjdG9yeQogICAgV3JpdGUtT3V0cHV0ICJEaXJlY3RvcnkgJGRpcmVjdG9yeSBjcmVhdGVkLiIKfSBlbHNlIHsKICAgIFdyaXRlLU91dHB1dCAiRGlyZWN0b3J5ICRkaXJlY3RvcnkgYWxyZWFkeSBleGlzdHMuIgp9CgojIENyZWF0ZSBhIG5ldyBmaWxlIGluIHRoZSBkaXJlY3RvcnkKJGZpbGUgPSAiJGRpcmVjdG9yeVxleGFtcGxlX2ZpbGUudHh0IgoiSGVsbG8sIHRoaXMgaXMgYW4gZXhhbXBsZSBmaWxlLiIgfCBPdXQtRmlsZSAtRmlsZVBhdGggJGZpbGUKV3JpdGUtT3V0cHV0ICJGaWxlICRmaWxlIGNyZWF0ZWQgd2l0aCBjb250ZW50LiIKCiMgTGlzdCBmaWxlcyBpbiB0aGUgZGlyZWN0b3J5CldyaXRlLU91dHB1dCAiTGlzdGluZyBmaWxlcyBpbiAkZGlyZWN0b3J5OiIKR2V0LUNoaWxkSXRlbSAtUGF0aCAkZGlyZWN0b3J5CgojIFByaW50IGEgZ29vZGJ5ZSBtZXNzYWdlCldyaXRlLU91dHB1dCAiU2NyaXB0IGV4ZWN1dGlvbiBjb21wbGV0ZS4gR29vZGJ5ZSEiCg=="
    }
  ],
  "requirementRules": [
    {
      "@odata.type": "#microsoft.graph.win32LobAppPowerShellScriptRequirement",
      "operator": "equal",
      "detectionValue": "\"lala\"",
      "displayName": "simple_powershell_script.ps1",
      "enforceSignatureCheck": false,
      "runAs32Bit": false,
      "runAsAccount": "system",
      "scriptContent": "CiMgVGhpcyBpcyBhIHNpbXBsZSBQb3dlclNoZWxsIHNjcmlwdCBleGFtcGxlLgoKIyBQcmludCBhIHdlbGNvbWUgbWVzc2FnZQpXcml0ZS1PdXRwdXQgIldlbGNvbWUgdG8gdGhlIFBvd2VyU2hlbGwgc2NyaXB0ISIKCiMgQXNzaWduIGEgdmFyaWFibGUKJG5hbWUgPSAiVXNlciIKCiMgVXNlIHRoZSB2YXJpYWJsZQpXcml0ZS1PdXRwdXQgIkhlbGxvLCAkbmFtZSEiCgojIENoZWNrIGlmIGEgZGlyZWN0b3J5IGV4aXN0cywgYW5kIGNyZWF0ZSBpdCBpZiBpdCBkb2Vzbid0CiRkaXJlY3RvcnkgPSAiQzpcVGVtcFxleGFtcGxlX2RpcmVjdG9yeSIKCmlmICgtTm90IChUZXN0LVBhdGggLVBhdGggJGRpcmVjdG9yeSkpIHsKICAgIFdyaXRlLU91dHB1dCAiRGlyZWN0b3J5ICRkaXJlY3RvcnkgZG9lcyBub3QgZXhpc3QuIENyZWF0aW5nIGl0IG5vdy4uLiIKICAgIE5ldy1JdGVtIC1JdGVtVHlwZSBEaXJlY3RvcnkgLVBhdGggJGRpcmVjdG9yeQogICAgV3JpdGUtT3V0cHV0ICJEaXJlY3RvcnkgJGRpcmVjdG9yeSBjcmVhdGVkLiIKfSBlbHNlIHsKICAgIFdyaXRlLU91dHB1dCAiRGlyZWN0b3J5ICRkaXJlY3RvcnkgYWxyZWFkeSBleGlzdHMuIgp9CgojIENyZWF0ZSBhIG5ldyBmaWxlIGluIHRoZSBkaXJlY3RvcnkKJGZpbGUgPSAiJGRpcmVjdG9yeVxleGFtcGxlX2ZpbGUudHh0IgoiSGVsbG8sIHRoaXMgaXMgYW4gZXhhbXBsZSBmaWxlLiIgfCBPdXQtRmlsZSAtRmlsZVBhdGggJGZpbGUKV3JpdGUtT3V0cHV0ICJGaWxlICRmaWxlIGNyZWF0ZWQgd2l0aCBjb250ZW50LiIKCiMgTGlzdCBmaWxlcyBpbiB0aGUgZGlyZWN0b3J5CldyaXRlLU91dHB1dCAiTGlzdGluZyBmaWxlcyBpbiAkZGlyZWN0b3J5OiIKR2V0LUNoaWxkSXRlbSAtUGF0aCAkZGlyZWN0b3J5CgojIFByaW50IGEgZ29vZGJ5ZSBtZXNzYWdlCldyaXRlLU91dHB1dCAiU2NyaXB0IGV4ZWN1dGlvbiBjb21wbGV0ZS4gR29vZGJ5ZSEiCg==",
      "detectionType": "string"
    },
    {
      "@odata.type": "#microsoft.graph.win32LobAppPowerShellScriptRequirement",
      "operator": "equal",
      "detectionValue": "33",
      "displayName": "simple_powershell_script2.ps1",
      "enforceSignatureCheck": false,
      "runAs32Bit": false,
      "runAsAccount": "system",
      "scriptContent": "CiMgVGhpcyBpcyBhIHNpbXBsZSBQb3dlclNoZWxsIHNjcmlwdCBleGFtcGxlLgoKIyBQcmludCBhIHdlbGNvbWUgbWVzc2FnZQpXcml0ZS1PdXRwdXQgIldlbGNvbWUgdG8gdGhlIFBvd2VyU2hlbGwgc2NyaXB0ISIKCiMgQXNzaWduIGEgdmFyaWFibGUKJG5hbWUgPSAiVXNlciIKCiMgVXNlIHRoZSB2YXJpYWJsZQpXcml0ZS1PdXRwdXQgIkhlbGxvLCAkbmFtZSEiCgojIENoZWNrIGlmIGEgZGlyZWN0b3J5IGV4aXN0cywgYW5kIGNyZWF0ZSBpdCBpZiBpdCBkb2Vzbid0CiRkaXJlY3RvcnkgPSAiQzpcVGVtcFxleGFtcGxlX2RpcmVjdG9yeSIKCmlmICgtTm90IChUZXN0LVBhdGggLVBhdGggJGRpcmVjdG9yeSkpIHsKICAgIFdyaXRlLU91dHB1dCAiRGlyZWN0b3J5ICRkaXJlY3RvcnkgZG9lcyBub3QgZXhpc3QuIENyZWF0aW5nIGl0IG5vdy4uLiIKICAgIE5ldy1JdGVtIC1JdGVtVHlwZSBEaXJlY3RvcnkgLVBhdGggJGRpcmVjdG9yeQogICAgV3JpdGUtT3V0cHV0ICJEaXJlY3RvcnkgJGRpcmVjdG9yeSBjcmVhdGVkLiIKfSBlbHNlIHsKICAgIFdyaXRlLU91dHB1dCAiRGlyZWN0b3J5ICRkaXJlY3RvcnkgYWxyZWFkeSBleGlzdHMuIgp9CgojIENyZWF0ZSBhIG5ldyBmaWxlIGluIHRoZSBkaXJlY3RvcnkKJGZpbGUgPSAiJGRpcmVjdG9yeVxleGFtcGxlX2ZpbGUudHh0IgoiSGVsbG8sIHRoaXMgaXMgYW4gZXhhbXBsZSBmaWxlLiIgfCBPdXQtRmlsZSAtRmlsZVBhdGggJGZpbGUKV3JpdGUtT3V0cHV0ICJGaWxlICRmaWxlIGNyZWF0ZWQgd2l0aCBjb250ZW50LiIKCiMgTGlzdCBmaWxlcyBpbiB0aGUgZGlyZWN0b3J5CldyaXRlLU91dHB1dCAiTGlzdGluZyBmaWxlcyBpbiAkZGlyZWN0b3J5OiIKR2V0LUNoaWxkSXRlbSAtUGF0aCAkZGlyZWN0b3J5CgojIFByaW50IGEgZ29vZGJ5ZSBtZXNzYWdlCldyaXRlLU91dHB1dCAiU2NyaXB0IGV4ZWN1dGlvbiBjb21wbGV0ZS4gR29vZGJ5ZSEiCg==",
      "detectionType": "integer"
    }
  ],
  "rules": [
    {
      "@odata.type": "#microsoft.graph.win32LobAppPowerShellScriptRule",
      "ruleType": "detection",
      "enforceSignatureCheck": false,
      "runAs32Bit": false,
      "scriptContent": "CiMgVGhpcyBpcyBhIHNpbXBsZSBQb3dlclNoZWxsIHNjcmlwdCBleGFtcGxlLgoKIyBQcmludCBhIHdlbGNvbWUgbWVzc2FnZQpXcml0ZS1PdXRwdXQgIldlbGNvbWUgdG8gdGhlIFBvd2VyU2hlbGwgc2NyaXB0ISIKCiMgQXNzaWduIGEgdmFyaWFibGUKJG5hbWUgPSAiVXNlciIKCiMgVXNlIHRoZSB2YXJpYWJsZQpXcml0ZS1PdXRwdXQgIkhlbGxvLCAkbmFtZSEiCgojIENoZWNrIGlmIGEgZGlyZWN0b3J5IGV4aXN0cywgYW5kIGNyZWF0ZSBpdCBpZiBpdCBkb2Vzbid0CiRkaXJlY3RvcnkgPSAiQzpcVGVtcFxleGFtcGxlX2RpcmVjdG9yeSIKCmlmICgtTm90IChUZXN0LVBhdGggLVBhdGggJGRpcmVjdG9yeSkpIHsKICAgIFdyaXRlLU91dHB1dCAiRGlyZWN0b3J5ICRkaXJlY3RvcnkgZG9lcyBub3QgZXhpc3QuIENyZWF0aW5nIGl0IG5vdy4uLiIKICAgIE5ldy1JdGVtIC1JdGVtVHlwZSBEaXJlY3RvcnkgLVBhdGggJGRpcmVjdG9yeQogICAgV3JpdGUtT3V0cHV0ICJEaXJlY3RvcnkgJGRpcmVjdG9yeSBjcmVhdGVkLiIKfSBlbHNlIHsKICAgIFdyaXRlLU91dHB1dCAiRGlyZWN0b3J5ICRkaXJlY3RvcnkgYWxyZWFkeSBleGlzdHMuIgp9CgojIENyZWF0ZSBhIG5ldyBmaWxlIGluIHRoZSBkaXJlY3RvcnkKJGZpbGUgPSAiJGRpcmVjdG9yeVxleGFtcGxlX2ZpbGUudHh0IgoiSGVsbG8sIHRoaXMgaXMgYW4gZXhhbXBsZSBmaWxlLiIgfCBPdXQtRmlsZSAtRmlsZVBhdGggJGZpbGUKV3JpdGUtT3V0cHV0ICJGaWxlICRmaWxlIGNyZWF0ZWQgd2l0aCBjb250ZW50LiIKCiMgTGlzdCBmaWxlcyBpbiB0aGUgZGlyZWN0b3J5CldyaXRlLU91dHB1dCAiTGlzdGluZyBmaWxlcyBpbiAkZGlyZWN0b3J5OiIKR2V0LUNoaWxkSXRlbSAtUGF0aCAkZGlyZWN0b3J5CgojIFByaW50IGEgZ29vZGJ5ZSBtZXNzYWdlCldyaXRlLU91dHB1dCAiU2NyaXB0IGV4ZWN1dGlvbiBjb21wbGV0ZS4gR29vZGJ5ZSEiCg==",
      "operationType": "notConfigured",
      "operator": "notConfigured"
    },
    {
      "@odata.type": "#microsoft.graph.win32LobAppPowerShellScriptRule",
      "ruleType": "requirement",
      "displayName": "simple_powershell_script.ps1",
      "enforceSignatureCheck": false,
      "runAs32Bit": false,
      "runAsAccount": "system",
      "scriptContent": "CiMgVGhpcyBpcyBhIHNpbXBsZSBQb3dlclNoZWxsIHNjcmlwdCBleGFtcGxlLgoKIyBQcmludCBhIHdlbGNvbWUgbWVzc2FnZQpXcml0ZS1PdXRwdXQgIldlbGNvbWUgdG8gdGhlIFBvd2VyU2hlbGwgc2NyaXB0ISIKCiMgQXNzaWduIGEgdmFyaWFibGUKJG5hbWUgPSAiVXNlciIKCiMgVXNlIHRoZSB2YXJpYWJsZQpXcml0ZS1PdXRwdXQgIkhlbGxvLCAkbmFtZSEiCgojIENoZWNrIGlmIGEgZGlyZWN0b3J5IGV4aXN0cywgYW5kIGNyZWF0ZSBpdCBpZiBpdCBkb2Vzbid0CiRkaXJlY3RvcnkgPSAiQzpcVGVtcFxleGFtcGxlX2RpcmVjdG9yeSIKCmlmICgtTm90IChUZXN0LVBhdGggLVBhdGggJGRpcmVjdG9yeSkpIHsKICAgIFdyaXRlLU91dHB1dCAiRGlyZWN0b3J5ICRkaXJlY3RvcnkgZG9lcyBub3QgZXhpc3QuIENyZWF0aW5nIGl0IG5vdy4uLiIKICAgIE5ldy1JdGVtIC1JdGVtVHlwZSBEaXJlY3RvcnkgLVBhdGggJGRpcmVjdG9yeQogICAgV3JpdGUtT3V0cHV0ICJEaXJlY3RvcnkgJGRpcmVjdG9yeSBjcmVhdGVkLiIKfSBlbHNlIHsKICAgIFdyaXRlLU91dHB1dCAiRGlyZWN0b3J5ICRkaXJlY3RvcnkgYWxyZWFkeSBleGlzdHMuIgp9CgojIENyZWF0ZSBhIG5ldyBmaWxlIGluIHRoZSBkaXJlY3RvcnkKJGZpbGUgPSAiJGRpcmVjdG9yeVxleGFtcGxlX2ZpbGUudHh0IgoiSGVsbG8sIHRoaXMgaXMgYW4gZXhhbXBsZSBmaWxlLiIgfCBPdXQtRmlsZSAtRmlsZVBhdGggJGZpbGUKV3JpdGUtT3V0cHV0ICJGaWxlICRmaWxlIGNyZWF0ZWQgd2l0aCBjb250ZW50LiIKCiMgTGlzdCBmaWxlcyBpbiB0aGUgZGlyZWN0b3J5CldyaXRlLU91dHB1dCAiTGlzdGluZyBmaWxlcyBpbiAkZGlyZWN0b3J5OiIKR2V0LUNoaWxkSXRlbSAtUGF0aCAkZGlyZWN0b3J5CgojIFByaW50IGEgZ29vZGJ5ZSBtZXNzYWdlCldyaXRlLU91dHB1dCAiU2NyaXB0IGV4ZWN1dGlvbiBjb21wbGV0ZS4gR29vZGJ5ZSEiCg==",
      "operationType": "string",
      "operator": "equal",
      "comparisonValue": "\"lala\""
    },
    {
      "@odata.type": "#microsoft.graph.win32LobAppPowerShellScriptRule",
      "ruleType": "requirement",
      "displayName": "simple_powershell_script2.ps1",
      "enforceSignatureCheck": false,
      "runAs32Bit": false,
      "runAsAccount": "system",
      "scriptContent": "CiMgVGhpcyBpcyBhIHNpbXBsZSBQb3dlclNoZWxsIHNjcmlwdCBleGFtcGxlLgoKIyBQcmludCBhIHdlbGNvbWUgbWVzc2FnZQpXcml0ZS1PdXRwdXQgIldlbGNvbWUgdG8gdGhlIFBvd2VyU2hlbGwgc2NyaXB0ISIKCiMgQXNzaWduIGEgdmFyaWFibGUKJG5hbWUgPSAiVXNlciIKCiMgVXNlIHRoZSB2YXJpYWJsZQpXcml0ZS1PdXRwdXQgIkhlbGxvLCAkbmFtZSEiCgojIENoZWNrIGlmIGEgZGlyZWN0b3J5IGV4aXN0cywgYW5kIGNyZWF0ZSBpdCBpZiBpdCBkb2Vzbid0CiRkaXJlY3RvcnkgPSAiQzpcVGVtcFxleGFtcGxlX2RpcmVjdG9yeSIKCmlmICgtTm90IChUZXN0LVBhdGggLVBhdGggJGRpcmVjdG9yeSkpIHsKICAgIFdyaXRlLU91dHB1dCAiRGlyZWN0b3J5ICRkaXJlY3RvcnkgZG9lcyBub3QgZXhpc3QuIENyZWF0aW5nIGl0IG5vdy4uLiIKICAgIE5ldy1JdGVtIC1JdGVtVHlwZSBEaXJlY3RvcnkgLVBhdGggJGRpcmVjdG9yeQogICAgV3JpdGUtT3V0cHV0ICJEaXJlY3RvcnkgJGRpcmVjdG9yeSBjcmVhdGVkLiIKfSBlbHNlIHsKICAgIFdyaXRlLU91dHB1dCAiRGlyZWN0b3J5ICRkaXJlY3RvcnkgYWxyZWFkeSBleGlzdHMuIgp9CgojIENyZWF0ZSBhIG5ldyBmaWxlIGluIHRoZSBkaXJlY3RvcnkKJGZpbGUgPSAiJGRpcmVjdG9yeVxleGFtcGxlX2ZpbGUudHh0IgoiSGVsbG8sIHRoaXMgaXMgYW4gZXhhbXBsZSBmaWxlLiIgfCBPdXQtRmlsZSAtRmlsZVBhdGggJGZpbGUKV3JpdGUtT3V0cHV0ICJGaWxlICRmaWxlIGNyZWF0ZWQgd2l0aCBjb250ZW50LiIKCiMgTGlzdCBmaWxlcyBpbiB0aGUgZGlyZWN0b3J5CldyaXRlLU91dHB1dCAiTGlzdGluZyBmaWxlcyBpbiAkZGlyZWN0b3J5OiIKR2V0LUNoaWxkSXRlbSAtUGF0aCAkZGlyZWN0b3J5CgojIFByaW50IGEgZ29vZGJ5ZSBtZXNzYWdlCldyaXRlLU91dHB1dCAiU2NyaXB0IGV4ZWN1dGlvbiBjb21wbGV0ZS4gR29vZGJ5ZSEiCg==",
      "operationType": "integer",
      "operator": "equal",
      "comparisonValue": "33"
    }
  ],
  "installExperience": {
    "runAsAccount": "system",
    "maxRunTimeInMinutes": 60,
    "deviceRestartBehavior": "allow"
  },
  "returnCodes": [
    {
      "returnCode": 0,
      "type": "success"
    },
    {
      "returnCode": 1707,
      "type": "success"
    },
    {
      "returnCode": 3010,
      "type": "softReboot"
    },
    {
      "returnCode": 1641,
      "type": "hardReboot"
    },
    {
      "returnCode": 1618,
      "type": "retry"
    }
  ],
  "@odata.type": "#microsoft.graph.win32LobApp"
}