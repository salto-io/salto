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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.changeValidators = exports.defaultChangeValidatorsValidateConfig = exports.defaultChangeValidatorsDeployConfig = void 0;
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lodash_1 = require("lodash");
var adapter_components_1 = require("@salto-io/adapter-components");
var package_1 = require("./change_validators/package");
var picklist_standard_field_1 = require("./change_validators/picklist_standard_field");
var custom_object_instances_1 = require("./change_validators/custom_object_instances");
var unknown_field_1 = require("./change_validators/unknown_field");
var custom_field_type_1 = require("./change_validators/custom_field_type");
var standard_field_label_1 = require("./change_validators/standard_field_label");
var map_keys_1 = require("./change_validators/map_keys");
var multiple_defaults_1 = require("./change_validators/multiple_defaults");
var picklist_promote_1 = require("./change_validators/picklist_promote");
var omit_data_1 = require("./change_validators/omit_data");
var data_change_1 = require("./change_validators/data_change");
var cpq_trigger_1 = require("./change_validators/cpq_trigger");
var record_type_deletion_1 = require("./change_validators/record_type_deletion");
var flows_1 = require("./change_validators/flows");
var fullname_changed_1 = require("./change_validators/fullname_changed");
var invalid_listview_filterscope_1 = require("./change_validators/invalid_listview_filterscope");
var case_assignmentRules_1 = require("./change_validators/case_assignmentRules");
var unknown_users_1 = require("./change_validators/unknown_users");
var animation_rule_recordtype_1 = require("./change_validators/animation_rule_recordtype");
var duplicate_rules_sort_order_1 = require("./change_validators/duplicate_rules_sort_order");
var last_layout_removal_1 = require("./change_validators/last_layout_removal");
var currency_iso_codes_1 = require("./change_validators/currency_iso_codes");
var unknown_picklist_values_1 = require("./change_validators/unknown_picklist_values");
var account_settings_1 = require("./change_validators/account_settings");
var installed_packages_1 = require("./change_validators/installed_packages");
var data_category_group_1 = require("./change_validators/data_category_group");
var standard_field_or_object_additions_or_deletions_1 = require("./change_validators/standard_field_or_object_additions_or_deletions");
var deleted_non_queryable_fields_1 = require("./change_validators/deleted_non_queryable_fields");
var types_1 = require("./types");
var _a = adapter_components_1.deployment.changeValidators, createChangeValidator = _a.createChangeValidator, getDefaultChangeValidators = _a.getDefaultChangeValidators;
exports.defaultChangeValidatorsDeployConfig = {
    omitData: false,
};
exports.defaultChangeValidatorsValidateConfig = {
    dataChange: false,
};
exports.changeValidators = __assign({ managedPackage: function () { return package_1["default"]; }, picklistStandardField: function () { return picklist_standard_field_1["default"]; }, customObjectInstances: function () { return custom_object_instances_1["default"]; }, unknownField: function () { return unknown_field_1["default"]; }, customFieldType: function () { return custom_field_type_1["default"]; }, standardFieldLabel: function () { return standard_field_label_1["default"]; }, mapKeys: function () { return map_keys_1["default"]; }, multipleDefaults: function () { return multiple_defaults_1["default"]; }, picklistPromote: function () { return picklist_promote_1["default"]; }, cpqValidator: function () { return cpq_trigger_1["default"]; }, recordTypeDeletion: function () { return record_type_deletion_1["default"]; }, flowsValidator: function (config, isSandbox, client) { return flows_1["default"](config, isSandbox, client); }, fullNameChangedValidator: function () { return fullname_changed_1["default"]; }, invalidListViewFilterScope: function () { return invalid_listview_filterscope_1["default"]; }, caseAssignmentRulesValidator: function () { return case_assignmentRules_1["default"]; }, omitData: function () { return omit_data_1["default"]; }, dataChange: function () { return data_change_1["default"]; }, unknownUser: function (_config, _isSandbox, client) { return unknown_users_1["default"](client); }, animationRuleRecordType: function () { return animation_rule_recordtype_1["default"]; }, duplicateRulesSortOrder: function () { return duplicate_rules_sort_order_1["default"]; }, currencyIsoCodes: function () { return currency_iso_codes_1["default"]; }, lastLayoutRemoval: function () { return last_layout_removal_1["default"]; }, accountSettings: function () { return account_settings_1["default"]; }, unknownPicklistValues: function () { return unknown_picklist_values_1["default"]; }, installedPackages: function () { return installed_packages_1["default"]; }, dataCategoryGroup: function () { return data_category_group_1["default"]; }, standardFieldOrObjectAdditionsOrDeletions: function () { return standard_field_or_object_additions_or_deletions_1["default"]; }, deletedNonQueryableFields: function () { return deleted_non_queryable_fields_1["default"]; } }, lodash_1["default"].mapValues(getDefaultChangeValidators(), function (validator) { return (function () { return validator; }); }));
var createSalesforceChangeValidator = function (_a) {
    var _b, _c, _d, _e;
    var config = _a.config, isSandbox = _a.isSandbox, checkOnly = _a.checkOnly, client = _a.client;
    var isCheckOnly = checkOnly || ((_d = (_c = (_b = config.client) === null || _b === void 0 ? void 0 : _b.deploy) === null || _c === void 0 ? void 0 : _c.checkOnly) !== null && _d !== void 0 ? _d : false);
    var defaultValidatorsActivationConfig = isCheckOnly
        ? exports.defaultChangeValidatorsValidateConfig
        : exports.defaultChangeValidatorsDeployConfig;
    var changeValidator = createChangeValidator({
        validators: lodash_1["default"].mapValues(exports.changeValidators, function (validator) { return validator(config, isSandbox, client); }),
        validatorsActivationConfig: __assign(__assign({}, defaultValidatorsActivationConfig), (_e = config[types_1.DEPLOY_CONFIG]) === null || _e === void 0 ? void 0 : _e.changeValidators),
    });
    // Returns a change validator with elementsSource that lazily resolves types using resolveTypeShallow
    // upon usage. This is relevant to Change Validators that get instances from the elementsSource.
    return function (changes, elementSource) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, ((elementSource === undefined)
                    ? changeValidator(changes, elementSource)
                    : changeValidator(changes, adapter_utils_1.buildLazyShallowTypeResolverElementsSource(elementSource)))];
        });
    }); };
};
exports["default"] = createSalesforceChangeValidator;
