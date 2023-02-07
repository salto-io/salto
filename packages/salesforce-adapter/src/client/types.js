"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
exports.CustomField = exports.CustomPicklistValue = exports.TopicsForObjectsInfo = void 0;
var lodash_1 = require("lodash");
var constants_1 = require("../constants");
var TopicsForObjectsInfo = /** @class */ (function () {
    function TopicsForObjectsInfo(fullName, entityApiName, enableTopics) {
        this.fullName = fullName;
        this.entityApiName = entityApiName;
        this.enableTopics = enableTopics;
    }
    return TopicsForObjectsInfo;
}());
exports.TopicsForObjectsInfo = TopicsForObjectsInfo;
var CustomPicklistValue = /** @class */ (function () {
    function CustomPicklistValue(fullName, isDefault, isActive, label, color) {
        this.fullName = fullName;
        this.isActive = isActive;
        this.label = label;
        if (!this.label) {
            this.label = fullName;
        }
        this["default"] = isDefault;
        if (color) {
            this.color = color;
        }
    }
    return CustomPicklistValue;
}());
exports.CustomPicklistValue = CustomPicklistValue;
var CustomField = /** @class */ (function () {
    function CustomField(fullName, type, required, defaultVal, defaultValFormula, values, controllingField, valueSettings, picklistRestricted, picklistSorted, valueSetName, formula, summaryFilterItems, relatedTo, relationshipName, length) {
        if (required === void 0) { required = false; }
        this.fullName = fullName;
        this.type = type;
        if (formula) {
            this.formula = formula;
        }
        else {
            switch (this.type) {
                case 'Text':
                    this.length = length !== null && length !== void 0 ? length : 80;
                    break;
                case 'LongTextArea':
                case 'Html':
                    this.length = length !== null && length !== void 0 ? length : 32768;
                    break;
                case 'EncryptedText':
                    this.length = length !== null && length !== void 0 ? length : 32;
                    break;
                default:
                    break;
            }
        }
        if (defaultValFormula) {
            this.defaultValue = defaultValFormula;
        }
        // For Picklist we save the default value in defaultVal but Metadata requires it at Value level
        if (type === constants_1.FIELD_TYPE_NAMES.PICKLIST || type === constants_1.FIELD_TYPE_NAMES.MULTIPICKLIST) {
            if ((values && !lodash_1["default"].isEmpty(values)) || (valueSetName)) {
                if (values && !lodash_1["default"].isEmpty(values)) {
                    this.valueSet = __assign(__assign({}, picklistRestricted ? { restricted: true } : {}), { valueSetDefinition: __assign(__assign({}, picklistSorted ? { sorted: true } : {}), { value: values.map(function (val) {
                                var _a;
                                return new CustomPicklistValue(val.fullName, val["default"], (_a = val.isActive) !== null && _a !== void 0 ? _a : true, val.label, val.color);
                            }) }) });
                }
                else {
                    this.valueSet = {
                        restricted: true,
                        valueSetName: valueSetName,
                    };
                }
                if (controllingField && valueSettings) {
                    this.valueSet.controllingField = controllingField;
                    this.valueSet.valueSettings = valueSettings;
                }
            }
        }
        else if (type === constants_1.FIELD_TYPE_NAMES.CHECKBOX && !formula) {
            // For Checkbox the default value comes from defaultVal and not defaultValFormula
            this.defaultValue = defaultVal;
        }
        else if (constants_1.isRelationshipFieldName(type)) {
            this.relationshipName = relationshipName;
            this.referenceTo = relatedTo;
        }
        else if (type === constants_1.FIELD_TYPE_NAMES.ROLLUP_SUMMARY && summaryFilterItems) {
            this.summaryFilterItems = summaryFilterItems;
        }
        // Checkbox, Formula, AutoNumber, LongTextArea and RichTextArea
        //  fields should not have required field
        if (![constants_1.FIELD_TYPE_NAMES.CHECKBOX,
            constants_1.FIELD_TYPE_NAMES.AUTONUMBER,
            constants_1.FIELD_TYPE_NAMES.LONGTEXTAREA,
            constants_1.FIELD_TYPE_NAMES.RICHTEXTAREA].includes(this.type)
            && !formula) {
            this.required = required;
        }
    }
    return CustomField;
}());
exports.CustomField = CustomField;
