/*
*                      Copyright 2024 Salto Labs Ltd.
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

/* eslint-disable quote-props */

type BundleVersionToComponents = Readonly<Record<string, Set<string>>>

export const BUNDLE_ID_TO_COMPONENTS: Readonly<Record<string, BundleVersionToComponents>> = {
  39609: {
    'v4.0.0': new Set(['customlist_ns_ps_process_list']),
  },
  53195: {
    '1.11.5': new Set(['custentity_date_lsa', 'custentity_link_name_lsa', 'custentity_link_lsa', 'custbody_link_name_lsa', 'custbody_date_lsa', 'custbody_link_lsa', 'customrecord_lsa', 'customsearch_lsa_activity_max_date', 'customsearch_lsa_contact_task_max_date', 'customsearch_lsa_contact_note_max_date', 'customsearch_lsa_contact_msgto_max_date', 'customsearch_lsa_contact_event_max_date', 'customsearch_lsa_contact_call_max_date', 'customsearch_lsa_contact_msgfr_max_date', 'customsearch_lsa_contacts', 'customsearch30', 'customsearch_lsa_customer', 'customsearch31', 'customsearch_lsa_cust_activity_max_date', 'customsearch_lsa_sales_user_search', 'customsearch_lsa_opp_task_max_date', 'customsearch_lsa_opportunities', 'customsearch_lsa_opp_note_max_date', 'customsearch_lsa_opp_message_max_date', 'customsearch_lsa_opp_activity_max_date', 'customsearch32', 'customscript_lsa_cs_custom_button', 'customscript_lsa_massupdate', 'customscript_lsa_sl_update_lsa', 'customscript_lsa_ue_communication', 'customscript_lsa_ue_lead', 'custentity_date_lsa', 'custentity_link_name_lsa', 'custentity_link_lsa', 'custbody_link_name_lsa', 'custbody_date_lsa', 'custbody_link_lsa', 'customrecord_lsa', 'customsearch_lsa_activity_max_date', 'customsearch_lsa_contact_task_max_date', 'customsearch_lsa_contact_note_max_date', 'customsearch_lsa_contact_msgto_max_date', 'customsearch_lsa_contact_event_max_date', 'customsearch_lsa_contact_call_max_date', 'customsearch_lsa_contact_msgfr_max_date', 'customsearch_lsa_contacts', 'customsearch30', 'customsearch_lsa_customer', 'customsearch31', 'customsearch_lsa_cust_activity_max_date', 'customsearch_lsa_sales_user_search', 'customsearch_lsa_opp_task_max_date', 'customsearch_lsa_opportunities', 'customsearch_lsa_opp_note_max_date', 'customsearch_lsa_opp_message_max_date', 'customsearch_lsa_opp_activity_max_date', 'customsearch32', 'customscript_lsa_cs_custom_button', 'customscript_lsa_massupdate', 'customscript_lsa_sl_update_lsa', 'customscript_lsa_ue_communication', 'customscript_lsa_ue_lead']),
  },
  47193: {
  },
  220096: {
  },
  123426: {
    '1.14.4.a': new Set(['custitem_prompt_payment_discount_item', 'custrecord_100_percent_non_deductable', 'custrecord_notional_tax_credit_account', 'custrecord_notional_tax_debit_account', 'custrecord_post_notional_tax_amount', 'custbody_stc_payment_transaction_id', 'custbody_stc_daysuntilexpiry', 'custbody_stc_amount_after_discount', 'custbody_stc_discountpercent', 'custbody_stc_tax_after_discount', 'custbody_stc_total_after_discount', 'customrecord_stc_config_values', 'customrecord_stc_config_fields', 'customrecord_stc_nexus_configuration', 'customrecord_engine_sequence', 'customrecord_stc_ppd_queue', 'customscript_supp_tax_calc', 'customscript_stc_bundle_install', 'customscript_tax_codes_cs', 'customscript_cs_prompt_payment_discount', 'customscript_stc_ss_ppd_process', 'customscript_stc_sl_termvalidation', 'customscript_stc_sl_promptpaydisc_prefer', 'customscript_ue_prompt_paymentdiscount', 'customscript_ue_notional_taxcode_fields', 'customscript_ue_psd_save_calculation']),
  },
  395822: {
  },
  38321: {
  },
  471284: {
  },
  272559: {
  },
  294288: {
  },
  25250: {
  },
  202156: {
    '2.00.8': new Set(['customrecord_pd_link_category', 'customrecord_pd_default_category', 'customrecord_pd_default_link', 'customrecord_pd_permission', 'customrecord_pd_link', 'customrecord_pd_holiday', 'customscript_pd_bundle_install', 'customscript_pd_pay_variance_pl', 'customscript_pd_payroll_batches_in_pr_pl', 'customscript_pd_links_pl', 'customscript_pd_service_restlet', 'customscript_pd_link_category_rest', 'customscript_pd_actions_rest', 'customscript_pd_default_link_rest', 'customscript_pd_link_rest', 'customscript_pd_default_category_rest', 'customscript_pd_bundle_install_ss', 'customscript_pd_jet_sl', 'customscript_pd_service_suitelet', 'customscript_pd_pay_variance_pl_sl', 'customscript_pd_pay_variance_sl', 'customscript_pd_category_ue', 'customscript_pd_permission_ue']),
  },
  303903: {
    '1.03.1': new Set(['custentity_emea_company_reg_num', 'custitem_str_supplementary_units', 'custitem_emea_country_of_origin', 'custitem_str_commodity_code', 'custitem_str_supplementary_unit_code', 'custrecord_emea_finance_contact', 'custrecord_emea_company_reg_num', 'custbody_str_nexuscountry', 'custbody_str_notc', 'custbody_emea_country_of_origin', 'custbody_str_region_of_origin', 'custbody_str_statistical_proc', 'custbody_str_incoterm', 'custbody_str_transport_mode', 'custbody_str_region_of_destination', 'custbody_emea_transaction_type', 'custcol_emea_country_of_origin', 'custcol_str_stat_value_base_curr', 'custcol_str_stat_value', 'customlist_str_delivery_terms', 'customlist_str_transport_mode', 'customlist_psg_emea_l10n_status', 'customrecord_str_statistical_procedure', 'customrecord_str_notc', 'customrecord_str_commodity_code', 'customrecord_psg_emea_l10n_component', 'customrecord_str_region_of_origin', 'customrecord_emea_get_country', 'customrecord_str_supplementary_units', 'custtab_emea_entity_setup', 'custtab_str_entity_tab', 'custtab_str_item_tab', 'custtab_str_transaction_tab', 'customscript_emea_bis_l10n', 'customscript_emea_cs_country_tax_fields', 'customscript_emea_ss_l10n', 'customscript_emea_ss_create_l10n', 'customscript_emea_ue_hide_item_fields', 'customscript_emea_ue_hide_crn_sub', 'customscript_emea_ue_hide_crn_entity', 'customscript_emea_ue_transactions', 'custcollection_emea_localization']),
  },
  228224: {
  },
  202278: {
  },
  248158: {
  },
  69019: {
  },
  296482: {
  },
  228839: {
  },
  302124: {
    '0.02.1': new Set(['custrecord_cbr_transaction_id', 'customlist_zreports_ba_codes', 'customlist_gl_zreport_types', 'customrecord_z4export', 'customrecord_zreports_trans_code', 'customrecord_zreports_comp_settings', 'customrole_z4reportviewer', 'customrole_z4reportgenerator', 'customrole_z4reportadmin', 'customsearch_z4_transaction_search', 'customscript_gl_zreports_bundle_install', 'customscript_gl_cs_item_record', 'customscript_gl_rest_search', 'customscript_sl_gl_settings', 'customscript_sl_gl_adminbypass', 'customscript_sl_gl_z_form', 'customscript_gl_ue_item_record', 'custcollectionzreports']),
  },
  233151: {
  },
  41296: {
  },
  338113: {
  },
  48331: {
  },
  307509: {
  },
  407373: {
    '2022.7.8.7': new Set(['custbody_zip_bill_id', 'custbody_zip_transaction_link', 'custbody_zip_bill_link', 'custbody_zip_payment_ref_no', 'custbody_zip_credit_link', 'custbody_zip_credit_id', 'custbody_zip_request_link', 'custcol_zip_start_date', 'custcol_zip_end_date', 'custcol_zip_line_item_id', 'customrole_zip_po', 'customscript_zip_po_installation', 'customscript_zip_po']),
  },
  116144: {
    '1.07.0': new Set(['custrecord_psg_lc_test_mode', 'customlist_8299_cat_type', 'customlist_8299_license_cache_status', 'customrecord_8299_client_audit_trail', 'customrecord_8299_license_cache', 'customrecord_8299_license_server', 'customscript_8299_license_client_is', 'customscript_8299_license_request_ss', 'customscript_8299_su_get_license', 'customscript_8299_su_app_get_license', 'customscript_8299_su_set_test_mode', 'customscript_8299_client_admin_page', 'customscript_8299_manual_request_su', 'customscript_8299_check_executing_script', 'customworkflow_8299_lock_cat_record']),
  },
  8792: {
  },
  381166: {
    '2021.1.1': new Set(['customrecord_ns_sc_configuration', 'customrole_sc_configuration_admin', 'customscript_ns_sc_config_select_client', 'customscript_ns_sc_config_select', 'customscript_ns_sc_config', 'customscript_ns_sc_config_copy', 'customscript_ns_sc_config_on_submit']),
  },
  466992: {
  },
  266623: {
    '1.00.4': new Set(['custevent_rac_replacement_so', 'custevent_rac_return_authorize', 'custevent_rac_ra_created_from', 'custbody_rac_replacement_for', 'custbody_rac_link_to_case', 'customsearch_rac_transactionsearch', 'customscript_rac_cs_caserecord', 'customscript_rac_su_transactionsearch', 'customscript_rac_su_transactionline', 'customscript_rac_ue_caserecord', 'customscript_rac_ue_so_record', 'customscript_rac_ue_return_auth_record']),
  },
  28006: {
  },
  247488: {
    '1.1.4': new Set(['customscript_ns_sc_ext_bi_cf']),
  },
  276803: {
  },
  109485: {
  },
  402113: {
  },
  500853: {
  },
  241945: {
  },
  258730: {
  },
  47492: {
    '1.87.0': new Set(['custentity_sii_id_type', 'custentity_tax_reg_no', 'custentity_4599_sg_uen', 'custentity_sii_id', 'custentity_my_brn', 'custitem_un_number', 'custrecord_has_mx_localization', 'custrecord_company_brn', 'custrecord_pt_sub_taxonomy_reference', 'custrecord_acct_bank_account_number', 'custrecord_company_uen', 'custbody_4599_sg_import_permit_num', 'custbody_sii_land_register', 'custbody_sii_exempt_details', 'custbody_sii_registration_code', 'custbody_sii_orig_bill', 'custbody_sii_article_72_73', 'custbody_sii_ref_no', 'custbody_sii_invoice_date', 'custbody_sii_issued_inv_type', 'custbody_document_date', 'custbody_sii_property_location', 'custbody_sii_external_reference', 'custbody_sii_registration_msg', 'custbody_sii_accounting_date', 'custbody_sii_article_61d', 'custbody_sii_code_issued_inv', 'custbody_sii_code', 'custbody_my_import_declaration_num', 'custbody_sii_received_inv_type', 'custbody_establishment_code', 'custbody_doc_num_summ_invoice', 'custbody_sii_spcl_scheme_code_sales', 'custbody_sii_not_reported_in_time', 'custbody_sii_spcl_scheme_code_purchase', 'custbody_sii_is_third_party', 'custbody_sii_intra_txn_type', 'custbody_sii_registration_status', 'custbody_sii_operation_date', 'custbody_4599_mx_operation_type', 'custbody_sii_orig_invoice', 'custbody_sii_correction_type', 'custcol_sii_service_date', 'custcol_sii_annual_prorate', 'custcol_sii_exempt_line_details', 'custcol_establishment_code', 'customlist_taf_task_status', 'customlist_sub_tax_code_trans_type', 'customlist_sii_list_type', 'customlist_sii_registration_status', 'customlist_operation_type', 'customlist_taf_job_status', 'customrecord_no_in_mapper_1323_keyvalue', 'customrecord_no_standard_tax_codes', 'customrecord_4599_custom_field', 'customrecord_mapper_keyvalue', 'customrecord_mapper_filter', 'customrecord_norway_mapper_keyvalue', 'customrecord_4599', 'customrecord_sii_reg_error_codes', 'customrecord_taf_report_task', 'customrecord_taf_rep_config', 'customrecord_income_statement_1167', 'customrecord_taf_setupconfig', 'customrecord_taf_job', 'customrecord_no_in_mapper_1167_keyvalue', 'customrecord_4digit_account_values', 'customrecord_4599_tranchild', 'customrecord_4599_sys_note', 'customrecord_sii_list_val', 'customrecord_pt_taxonomy_reference', 'customrecord_income_statement_1323', 'customrecord_2digit_account_values', 'customrecord_mapper_category', 'customrecord_taf_search_task', 'customrecord_pt_mr_task_summary', 'customrecord_report_preferences_mapping', 'customrecord_no_income_mapper_keyvalue', 'customrecord_income_statement_1175', 'customrecord_no_in_mapper_1175_keyvalue', 'customrecord_no_sub_tax_codes', 'customrecord_statutory_coa', 'customrecord_taf_report_threshold', 'customrecord_no_2digit_mapping', 'customrecord_mapper_values', 'customrecord_taf_configuration', 'customrecord_taf_setupconfig_value', 'customrecord_no_std_tax_keyvalue', 'customrecord_no_4digit_mapping', 'customrecord_country', 'customscript_mx_uuid', 'customrole_ns_taf_cfo', 'customrole_ns_taf_accountant', 'customsearch_taf_gl_customfields', 'customsearch_ph_taf_item_search', 'customsearch_alt_tax_codes', 'customsearch_taf_mapping_pt_migration', 'customsearch_es_sii_txn_flagging', 'customsearch_es_sii_rectify_invoices', 'customsearch_es_sii_upload_status', 'customsearch_taf_mx_journal_a12', 'customsearch_taf_mx_journal_a11', 'customsearch_taf_mx_journal_a10', 'customsearch_taf_mx_journal_a9', 'customsearch_taf_mx_journal_a8', 'customsearch_taf_mx_journal_a7', 'customsearch_taf_mx_journal_a6', 'customsearch_taf_mx_journal_a5', 'customsearch_taf_mx_journal_a4', 'customsearch_taf_mx_journal_a3', 'customsearch_taf_mx_journal_a2', 'customsearch_taf_mx_journal_a1', 'customsearch_taf_mx_journal_a0', 'customsearch_taf_mx_journal_b12', 'customsearch_taf_mx_journal_b11', 'customsearch_taf_mx_journal_b10', 'customsearch_taf_mx_journal_b9', 'customsearch_taf_mx_journal_b8', 'customsearch_taf_mx_journal_b7', 'customsearch_taf_mx_journal_b6', 'customsearch_taf_mx_journal_b5', 'customsearch_taf_mx_journal_b4', 'customsearch_taf_mx_journal_b3', 'customsearch_taf_mx_journal_b2', 'customsearch_taf_mx_journal_b1', 'customsearch_taf_mx_journal_b0', 'customsearch_taf_mx_journal_d31', 'customsearch_taf_mx_journal_d30', 'customsearch_taf_mx_journal_d29', 'customsearch_taf_mx_journal_d28', 'customsearch_taf_mx_journal_d27', 'customsearch_taf_mx_journal_d26', 'customsearch_taf_mx_journal_d25', 'customsearch_taf_mx_journal_d24', 'customsearch_taf_mx_journal_d23', 'customsearch_taf_mx_journal_d22', 'customsearch_taf_mx_journal_d21', 'customsearch_taf_mx_journal_d20', 'customsearch_taf_mx_journal_d19', 'customsearch_taf_mx_journal_d18', 'customsearch_taf_mx_journal_d17', 'customsearch_taf_mx_journal_d16', 'customsearch_taf_mx_journal_d15', 'customsearch_taf_mx_journal_d14', 'customsearch_taf_mx_journal_d13', 'customsearch_taf_mx_journal_d12', 'customsearch_taf_mx_journal_d11', 'customsearch_taf_mx_journal_d10', 'customsearch_taf_mx_journal_d9', 'customsearch_taf_mx_journal_d8', 'customsearch_taf_mx_journal_d7', 'customsearch_taf_mx_journal_d6', 'customsearch_taf_mx_journal_d5', 'customsearch_taf_mx_journal_d4', 'customsearch_taf_mx_journal_d3', 'customsearch_taf_mx_journal_d2', 'customsearch_taf_mx_journal_d1', 'customsearch_es_sii_investment_goods_reg', 'customsearch_es_sii_cash_collections', 'customsearch_de_taf_txn_vendor', 'customsearch_de_taf_txn_customer', 'customsearch_4599_by_trandate', 'customsearch_4599_by_account_internalid', 'customsearch_4599_by_internalid', 'customsearch_saftpt_transaction_search', 'customsearch_ph_taf_transaction_search', 'customsearch_de_taf_sort_by_acct_intl_id', 'customsearch_de_taf_sort_by_tranid', 'customsearch_de_taf_sort_by_internalid', 'customsearch_taf_fr_saft_transaction', 'customsearch_taf_pt_saft_paymentsummary', 'customsearch_taf_pt_saft_payment', 'customsearch_taf_pt_saft_salesorderline', 'customsearch_taf_pt_saft_itemfulfillment', 'customsearch_taf_glaudit_numbering', 'customsearch_sg_iaf_generalledgersummary', 'customsearch_sg_iaf_generalledger', 'customsearch_sg_iaf_salessummary', 'customsearch_sg_iaf_saleslines', 'customsearch_sg_iaf_purchase_summary', 'customsearch_sg_iaf_purchase', 'customsearch_sg_iaf_salessummary_rgl', 'customsearch_sg_iaf_saleslines_rgl', 'customsearch_taf_my_gaf_generalledger', 'customsearch_taf_my_gaf_purchase_lines', 'customsearch_taf_my_gaf_rgl_lines', 'customsearch_taf_my_gaf_supply_lines', 'customsearch_taf_mx_journal_lines', 'customsearch_de_taf_generaljournal', 'customsearch_de_taf_generalledger', 'customsearch_de_taf_annualvat', 'customsearch_taf_de_acctrec_line', 'customsearch_taf_de_acctpay_line', 'customsearch_de_taf_glline', 'customsearch_ae_faf_generalledgersummary', 'customsearch_ae_faf_generalledger', 'customsearch_ae_faf_sales_summary', 'customsearch_ae_faf_sales', 'customsearch_ae_faf_purchase_summary', 'customsearch_ae_faf_purchase', 'customsearch_taf_fr_pej_saft_transaction', 'customsearch_taf_mx_auxiliary', 'customsearch_taf_glnumbering', 'customsearch_taf_gldata', 'customsearch_oecd_purcinvoices', 'customsearch_taf_oecd_suppliessummary', 'customsearch_taf_oecd_transaction_pymnts', 'customsearch_taf_oecd_supplies', 'customsearch_taf_oecd_check_pymt_summary', 'customsearch_taf_oecd_tran_pymt_summary', 'customsearch_taf_oecd_check_payments', 'customsearch_taf_oecd_gl_entry_lines', 'customsearch_taf_oecd_gl_entries', 'customsearch_taf_oecd_gl_entries_summary', 'customsearch_taf_pt_saft_work_docs_smry', 'customsearch_taf_pt_saft_invoice_summary', 'customsearch_taf_pt_saft_invoice', 'customsearch_taf_pt_saft_gl_entry_lines', 'customsearch_taf_pt_saft_gl_entries_summ', 'customsearch_taf_pt_saft_gl_entries', 'customsearch_sg_iaf_rglaccount', 'customsearch_taf_ph_cashdisbursemnt_line', 'customsearch_taf_ph_cashdisbursements', 'customsearch_ph_taf_purchasejournal_trxn', 'customsearch_ph_taf_purchasejournal', 'customsearch_taf_ph_salesjournal_detail', 'customsearch_taf_ph_salesjournal', 'customsearch_taf_ph_generalledger_detail', 'customsearch_taf_ph_generalledger', 'customsearch_oecd_purcinvoices_summary', 'customsearch_mx_diot_vendorpayments', 'customsearch_mx_diot_paidtransactions', 'customsearch_es_sii_intra_community_txn', 'customsearch_es_sii_received_invoices', 'customsearch_es_sii_issued_invoices', 'customsearch_es_sii_rectify_bills', 'customsearch_de_taf_ar_a12', 'customsearch_de_taf_ar_a11', 'customsearch_de_taf_ar_a10', 'customsearch_de_taf_ar_a9', 'customsearch_de_taf_ar_a8', 'customsearch_de_taf_ar_a7', 'customsearch_de_taf_ar_a6', 'customsearch_de_taf_ar_a5', 'customsearch_de_taf_ar_a3', 'customsearch_de_taf_ar_a4', 'customsearch_de_taf_ar_a0', 'customsearch_de_taf_ar_a2', 'customsearch_de_taf_ar_a1', 'customsearch_de_taf_ar_b12', 'customsearch_de_taf_ar_b11', 'customsearch_de_taf_ar_b10', 'customsearch_de_taf_ar_b9', 'customsearch_de_taf_ar_b8', 'customsearch_de_taf_ar_b7', 'customsearch_de_taf_ar_b6', 'customsearch_de_taf_ar_b4', 'customsearch_de_taf_ar_b5', 'customsearch_de_taf_ar_b3', 'customsearch_de_taf_ar_b2', 'customsearch_de_taf_ar_b1', 'customsearch_de_taf_ar_b0', 'customsearch_de_taf_ar_d31', 'customsearch_de_taf_ar_d30', 'customsearch_de_taf_ar_d29', 'customsearch_de_taf_ar_d28', 'customsearch_de_taf_ar_d27', 'customsearch_de_taf_ar_d26', 'customsearch_de_taf_ar_d24', 'customsearch_de_taf_ar_d23', 'customsearch_de_taf_ar_d22', 'customsearch_de_taf_ar_d21', 'customsearch_de_taf_ar_d20', 'customsearch_de_taf_ar_d19', 'customsearch_de_taf_ar_d18', 'customsearch_de_taf_ar_d17', 'customsearch_de_taf_ar_d16', 'customsearch_de_taf_ar_d15', 'customsearch_de_taf_ar_d14', 'customsearch_de_taf_ar_d13', 'customsearch_de_taf_ar_d12', 'customsearch_de_taf_ar_d11', 'customsearch_de_taf_ar_d10', 'customsearch_de_taf_ar_d9', 'customsearch_de_taf_ar_d8', 'customsearch_de_taf_ar_d7', 'customsearch_de_taf_ar_d6', 'customsearch_de_taf_ar_d5', 'customsearch_de_taf_ar_d4', 'customsearch_de_taf_ar_d3', 'customsearch_de_taf_ar_d2', 'customsearch_de_taf_ar_d1', 'customsearch_de_taf_gl_i_a12', 'customsearch_de_taf_gl_i_a11', 'customsearch_de_taf_gl_i_a10', 'customsearch_de_taf_gl_i_a9', 'customsearch_de_taf_gl_i_a8', 'customsearch_de_taf_gl_i_a7', 'customsearch_de_taf_gl_i_a6', 'customsearch_de_taf_gl_i_a5', 'customsearch_de_taf_gl_i_a4', 'customsearch_de_taf_gl_i_a3', 'customsearch_de_taf_gl_i_a2', 'customsearch_de_taf_gl_i_a1', 'customsearch_de_taf_gl_i_a0', 'customsearch_de_taf_gl_i_b12', 'customsearch_de_taf_gl_i_b11', 'customsearch_de_taf_gl_i_b10', 'customsearch_de_taf_gl_i_b9', 'customsearch_de_taf_gl_i_b8', 'customsearch_de_taf_gl_i_b7', 'customsearch_de_taf_gl_i_b6', 'customsearch_de_taf_gl_i_b5', 'customsearch_de_taf_gl_i_b4', 'customsearch_de_taf_gl_i_b3', 'customsearch_de_taf_gl_i_b2', 'customsearch_de_taf_gl_i_b1', 'customsearch_de_taf_gl_i_b0', 'customsearch_de_taf_gl_i_d31', 'customsearch_de_taf_gl_i_d30', 'customsearch_de_taf_gl_i_d29', 'customsearch_de_taf_gl_i_d28', 'customsearch_de_taf_gl_i_d27', 'customsearch_de_taf_gl_i_d26', 'customsearch_de_taf_gl_i_d25', 'customsearch_de_taf_gl_i_d24', 'customsearch_de_taf_gl_i_d23', 'customsearch_de_taf_gl_i_d22', 'customsearch_de_taf_gl_i_d21', 'customsearch_de_taf_gl_i_d20', 'customsearch_de_taf_gl_i_d19', 'customsearch_de_taf_gl_i_d18', 'customsearch_de_taf_gl_i_d17', 'customsearch_de_taf_gl_i_d16', 'customsearch_de_taf_gl_i_d15', 'customsearch_de_taf_gl_i_d14', 'customsearch_de_taf_gl_i_d13', 'customsearch_de_taf_gl_i_d12', 'customsearch_de_taf_gl_i_d11', 'customsearch_de_taf_gl_i_d10', 'customsearch_de_taf_gl_i_d9', 'customsearch_de_taf_gl_i_d8', 'customsearch_de_taf_gl_i_d7', 'customsearch_de_taf_gl_i_d6', 'customsearch_de_taf_gl_i_d5', 'customsearch_de_taf_gl_i_d4', 'customsearch_de_taf_gl_i_d3', 'customsearch_de_taf_gl_i_d2', 'customsearch_de_taf_gl_i_d1', 'customsearch_de_taf_gl_a12', 'customsearch_de_taf_gl_a11', 'customsearch_de_taf_gl_a10', 'customsearch_de_taf_gl_a9', 'customsearch_de_taf_gl_a8', 'customsearch_de_taf_gl_a7', 'customsearch_de_taf_gl_a6', 'customsearch_de_taf_gl_a5', 'customsearch_de_taf_gl_a4', 'customsearch_de_taf_gl_a3', 'customsearch_de_taf_gl_a2', 'customsearch_de_taf_gl_a1', 'customsearch_de_taf_gl_a0', 'customsearch_de_taf_gl_b12', 'customsearch_de_taf_gl_b11', 'customsearch_de_taf_gl_b10', 'customsearch_de_taf_gl_b9', 'customsearch_de_taf_gl_b8', 'customsearch_de_taf_gl_b7', 'customsearch_de_taf_gl_b6', 'customsearch_de_taf_gl_b5', 'customsearch_de_taf_gl_b3', 'customsearch_de_taf_gl_b4', 'customsearch_de_taf_gl_b2', 'customsearch_de_taf_gl_b1', 'customsearch_de_taf_gl_b0', 'customsearch_de_taf_gl_d31', 'customsearch_de_taf_gl_d30', 'customsearch_de_taf_gl_d29', 'customsearch_de_taf_gl_d28', 'customsearch_de_taf_gl_d27', 'customsearch_de_taf_gl_d25', 'customsearch_de_taf_gl_d24', 'customsearch_de_taf_gl_d23', 'customsearch_de_taf_gl_d22', 'customsearch_de_taf_gl_d21', 'customsearch_de_taf_gl_d20', 'customsearch_de_taf_gl_d19', 'customsearch_de_taf_gl_d18', 'customsearch_de_taf_gl_d17', 'customsearch_de_taf_gl_d16', 'customsearch_de_taf_gl_d15', 'customsearch_de_taf_gl_d14', 'customsearch_de_taf_gl_d13', 'customsearch_de_taf_gl_d12', 'customsearch_de_taf_gl_d11', 'customsearch_de_taf_gl_d10', 'customsearch_de_taf_gl_d9', 'customsearch_de_taf_gl_d8', 'customsearch_de_taf_gl_d7', 'customsearch_de_taf_gl_d6', 'customsearch_de_taf_gl_d5', 'customsearch_de_taf_gl_d4', 'customsearch_de_taf_gl_d3', 'customsearch_de_taf_gl_d2', 'customsearch_de_taf_gl_d1', 'customsearch_de_taf_ap_a12', 'customsearch_de_taf_ap_a11', 'customsearch_de_taf_ap_a10', 'customsearch_de_taf_ap_a9', 'customsearch_de_taf_ap_a8', 'customsearch_de_taf_ap_a7', 'customsearch_de_taf_ap_a6', 'customsearch_de_taf_ap_a5', 'customsearch_de_taf_ap_a4', 'customsearch_de_taf_ap_a3', 'customsearch_de_taf_ap_a2', 'customsearch_de_taf_ap_a1', 'customsearch_de_taf_ap_a0', 'customsearch_de_taf_ap_b12', 'customsearch_de_taf_ap_b11', 'customsearch_de_taf_ap_b10', 'customsearch_de_taf_ap_b9', 'customsearch_de_taf_ap_b8', 'customsearch_de_taf_ap_b7', 'customsearch_de_taf_ap_b6', 'customsearch_de_taf_ap_b5', 'customsearch_de_taf_ap_b4', 'customsearch_de_taf_ap_b3', 'customsearch_de_taf_ap_b2', 'customsearch_de_taf_ap_b1', 'customsearch_de_taf_ap_b0', 'customsearch_de_taf_ap_d31', 'customsearch_de_taf_ap_d30', 'customsearch_de_taf_ap_d29', 'customsearch_de_taf_ap_d28', 'customsearch_de_taf_ap_d27', 'customsearch_de_taf_ap_d26', 'customsearch_de_taf_ap_d25', 'customsearch_de_taf_ap_d24', 'customsearch_de_taf_ap_d23', 'customsearch_de_taf_ap_d22', 'customsearch_de_taf_ap_d21', 'customsearch_de_taf_ap_d20', 'customsearch_de_taf_ap_d19', 'customsearch_de_taf_ap_d18', 'customsearch_de_taf_ap_d17', 'customsearch_de_taf_ap_d16', 'customsearch_de_taf_ap_d15', 'customsearch_de_taf_ap_d14', 'customsearch_de_taf_ap_d13', 'customsearch_de_taf_ap_d12', 'customsearch_de_taf_ap_d11', 'customsearch_de_taf_ap_d10', 'customsearch_de_taf_ap_d9', 'customsearch_de_taf_ap_d8', 'customsearch_de_taf_ap_d7', 'customsearch_de_taf_ap_d6', 'customsearch_de_taf_ap_d5', 'customsearch_de_taf_ap_d4', 'customsearch_de_taf_ap_d3', 'customsearch_de_taf_ap_d2', 'customsearch_de_taf_ap_d1', 'customsearch_de_taf_ar_d25', 'customsearch_de_taf_gl_d26', 'customsearch_taf_ph_journal_txn_search', 'customsearch_ph_taf_general_journal', 'customsearch_taf_ph_cashreceipts_txn', 'customsearch_taf_sales_account_type', 'custtab_4_3838944_241', 'custtab_2_3838944_108', 'custtab_8_3838944_670', 'customscript_4599_bundle', 'customscript_income_statement_rf_1323', 'customscript_income_statement_rf_1175', 'customscript_scoa_cs', 'customscript_income_statement_rf_1167', 'customscript_sub_tax_codes_cs', 'customscript_taf_transaction_cs', 'customscript_eu_item_cs', 'customscript_4599_hide_cs', 'customscript_4599_main_cs', 'customscript_taf_entity_cs', 'customscript_2digit_account_values_cs', 'customscript_mapper_cs', 'customscript_taf_hide_entity_cs', 'customscript_4digit_account_values_cs', 'customscript_std_tax_codes', 'customscript_report_preferences_cs', 'customscript_taf_mr_cleanup', 'customscript_migrate_pt_acct_grouping_mr', 'customscript_sii_mr_flagtransactions', 'customscript_4599_main_ss', 'customscript_taf_ss_reporthandler', 'customscript_taf_ss_taskmonitor', 'customscript_migrate_pt_acct_grouping_ss', 'customscript_4599_main_s', 'customscript_taf_filter', 'customscript_sii_su_uploadresults', 'customscript_report_preferences_s', 'customscript_mapper_s', 'customscript_scoa_s', 'customscript_eu_item_ue', 'customscript_taf_hide_entity_ue', 'customscript_fourdigit_std_account_ue', 'customscript_taf_hide_account_ue', 'customscript_sub_tax_codes', 'customscript_taf_entity_ue', 'customscript_twodigit_std_account_ue', 'customscript_taf_transaction_ue', 'customscript_income_statement_rf_1167_ue', 'customscript_income_statement_rf_1323_ue', 'customscript_mapper_view_ue', 'customscript_4599_hide_ue', 'customscript_std_tax_codes_ue', 'customscript_norway_mapping_ue', 'customscript_income_statement_rf_1175_ue', 'customscript_sii_txn_status_ue', 'customworkflow_4599_hide_cs', 'customworkflow_acct_bank_account_number']),
  },
  260367: {
  },
  464455: {
  },
  312388: {
  },
  67350: {
  },
  286091: {
  },
  385758: {
  },
  354075: {
  },
  147355: {
  },
  343848: {
  },
  181105: {
  },
  77203: {
  },
  49118: {
  },
  281353: {
  },
  488712: {
  },
  223208: {
  },
  480805: {
  },
  317199: {
  },
  17361: {
    'v1.96': new Set(['custitem_bp_carbon_duty', 'custitem_landed_vendor_purch_price', 'custitem_bp_carton_cbm', 'custitem_landed_duty_rate', 'custrecord_carbon_duty_vendor', 'custrecord_carbon_duty_exp_acc', 'custrecord_landed_duty_exp_acc', 'custrecord_landed_duty_tax_code', 'custrecord_carbon_duty_taxcode', 'custbody_landed_apply', 'custbody_related_trans', 'custbody_landed_duty_ord_total', 'custbody_landed_print_vendor_taxamt', 'custbody_landed_print_vendor_grossamt', 'custbody_landed_print_vendor_amt', 'custbody_landed_carbon_duty_apply', 'custbody_bp_order_carton_cbm', 'custbody_landed_carbon_duty_ord_total', 'custcol_landed_orig_vpp', 'custcol_landed_duty_code', 'custcol_landed_duty_amt', 'custcol_landed_carbon_duty_line_price', 'custcol_landed_vendor_purch_price', 'custcol_bp_carton_cbm', 'custcol_landed_print_taxamt', 'custcol_landed_print_qty', 'custcol_landed_print_item_code', 'custcol_landed_print_grossamt', 'custcol_landed_print_amt', 'custcol_landed_duty_pct', 'custcol_bp_unit_carton_cbm', 'custcol_landed_carbon_duty_unit_price', 'custcol_landed_carbon_duty_unit_curr', 'customlist_2663_payment_type', 'customlist_2663_approval_type', 'customlist_2663_bank_acct_type', 'customlist_2663_acct_type', 'customlist_2663_output_file_encoding', 'customrecord_landed_duty_codes', 'customrecord_2663_bank_details', 'customrecord_2663_format_details', 'customrecord_2663_payment_file_format', 'customrecord_11724_bank_fee_sched', 'pdflayout_111_1309466_591', 'custform_186_1309466_435', 'custform_174_1309466_435', 'custform_179_1309466_435', 'custtab_43_1309466_824', 'customscript_landed_cs_itemreceipts', 'customscript_landed_cs_po_vb', 'customscript_landed_ue_aftersubmit_ir', 'customscript_landed_ue_aftersubmitpo', 'customscript_bp_ue_afteritemsubmit', 'customscript_landed_ue_aftersubmit_vb', 'custcollection_electronic_payments_objects_translations']),
  },
  293699: {
    '23.1.2': new Set(['customlist_bsp_txs_types_camt053', 'customlist_bsp_memo_mapping_mt940', 'customlist_bsp_field_mapping_camt053', 'customlist_bsp_column_delimiter_csv', 'customlist_bsp_neg_number_format_csv', 'customlist_bsp_text_qualifier_csv', 'customlist_bsp_number_format_csv', 'customrecord_bsp_config_csv', 'customrecord_bsp_configuration_value', 'customscript_bsp_parser_bai2', 'customscript_bsp_parser_mt940', 'customscript_bsp_parser_ofx', 'customscript_bsp_parser_camt053', 'customscript_bsp_parser_csv', 'customscript_bsp_bundle_installation', 'customscript_bsp_cs_format_profile', 'customscript_bsp_error_file_cleanup_csv', 'customscript_bsp_su_configuration_csv', 'customscript_bsp_ue_format_profile', 'custcollection_bsp_translation']),
  },
  338744: {
  },
  185214: {
  },
  243341: {
    '1.2.5': new Set(['custitem_ns_sc_ext_gift_cert_group', 'custitem_ns_sc_ext_only_pdp', 'custitem_ns_sc_ext_gift_cert_group_id', 'custitem_ns_sc_ext_options_button_lbl', 'customrecord_sc_ext_gcvc', 'customrecord_ns_sc_gift_cert_group', 'customrole_sc_ext_gift_cert', 'custtab_ns_sc_gift_certificate_advanced', 'custtab_260_t1533071_680', 'customscript_ns_sc_gcmgmt_install', 'customscript_ns_sc_ss_gift_cert_balance', 'customscript_ns_sc_sl_gift_cert_mgmt', 'customscript_ns_sc_sl_gift_cert_balance', 'customscript_ns_sc_sl_gift_cert_groups', 'customscript_ns_sc_ue_gift_cert_balance']),
  },
  444229: {
  },
  64313: {
    '1.08.0': new Set(['custrecord_buildingname', 'custrecord_unit', 'custrecord_street_complement', 'custrecord_av_valid_timestamp', 'custrecord_av_cond_dash', 'custrecord_province_abbrev', 'custrecord_statecode', 'custrecord_csaf_state_list_for_country', 'custrecord_pobox', 'custrecord_unittype', 'custrecord_village', 'custrecord_colonia', 'custrecord_station', 'custrecord_subbuilding', 'custrecord_neighborhood', 'custrecord_ruralroute', 'custrecord_av_cond_comma', 'custrecord_building', 'custrecord_av_country_change_data', 'custrecord_av_valid_status', 'custrecord_av_after_placeholder', 'custrecord_streettype', 'custrecord_locality', 'custrecord_streetname', 'custrecord_streetdirection', 'custrecord_streetnum', 'custrecord_floor', 'custrecord_av_before_placeholder', 'custrecord_province', 'customliststreet_directions', 'customlist_av_valid_states_list', 'customlist_unit_types', 'customrecord_street_type_values', 'customrecord_csaf_state_list', 'customrecord_csaf_loqate_analytics', 'custform_av_co_addressform', 'custform_av_jp_addressform', 'custform_av_nl_addressform', 'custform_av_ie_addressform', 'custform_av_nz_addressform', 'custform_av_ca_addressform', 'custform_av_be_addressform', 'custform_av_pt_addressform', 'custform_av_no_addressform', 'custform_av_it_address_form', 'custform_av_us_addressform', 'custform_av_lu_addressform', 'custform_av_my_addressform', 'custform_av_in_addressform', 'custform_av_sg_addressform', 'custform_av_ch_addressform', 'custform_av_sa_addressform', 'custform_av_kr_addressform', 'custform_av_es_addressform', 'custform_av_vn_addressform', 'custform_av_cn_addressform', 'custform_av_pe_addressform', 'custform_av_cl_addressform', 'custform_av_br_addressform', 'custform_av_th_addressform', 'custform_av_gb_addressform', 'custform_av_au_addressform', 'custform_av_mx_addressform', 'custform_av_ph_addressform', 'custform_av_se_addressform', 'custform_av_fr_addressform', 'custform_av_at_addressform', 'custform_av_de_addressform', 'custform_av_dk_addressform', 'custform_av_id_addressform', 'custform_av_fi_addressform', 'customscript_address_validation_iface', 'customscript_cs_av_address_subtab', 'customscript_av_migration', 'customscript_sl_address_form_bridge', 'customscript_ue_av_address_subtab', 'custcollection_csaf_translations']),
  },
  286093: {
  },
  486222: {
  },
  249935: {
    '1.1.2': new Set(['customlist_cct_ns_news_layout', 'customrecord_cct_ns_newsletter', 'customrole_sc_extension_newsletter_sp', 'customscript_ns_nsucct_install', 'customscript_ns_sc_ext_sl_newsletter_sp']),
  },
  44281: {
    '2.00.3': new Set(['custrecord_subnav_subsidiary_logo', 'customrecord_subnav_settings', 'customscript_snav_bundle_install', 'customscript_snav_portlet_app', 'customscript_snav_copysublogo', 'customscript_snav_service_admin_sl', 'customscript_snav_suitelet', 'customscript_snav_service_user_sl', 'customscript_translation_suitelet', 'customscript_snav_generate_css', 'customscript_snav_subsidiary_ue', 'custcollection_sub_nav_collection']),
  },
  94468: {
  },
  255470: {
    '1.04.2': new Set(['custentity_str_gl_de_gobd_taxno', 'custitem_zreports_transaction_code', 'custrecord_gl_company_region', 'custbody_gl_defer_vat', 'customlist_zreports_ba_codes', 'customlist_gl_list_componentstatus', 'customlistgl_list_german_region', 'customrecord_zreports_trans_code', 'customrecord_gl_setup_component', 'custtmpl_gl_defer_vat_layout', 'custtab_str_entity_tab', 'customscript_gl_bundle_installation', 'customscript_gl_cs_disablememofield', 'customscript_gl_mr_reverse_tpd', 'customscript_gl_mr_tax_nr_migration', 'customscript_gl_mr_delete', 'customscript_gl_mr_csr_var_values_delete', 'customscript_gl_ss_setupinstall', 'customscript_gl_ss_cbr_record_creator', 'customscript_gl_ss_checkstuckcomponents', 'customscript_gl_ss_setupuninstall', 'customscript_gl_ss_automaticinstall', 'customscript_gl_su_setupsuitelet', 'customscript_gl_su_coainstall', 'customscript_gl_su_susa', 'customscript_gl_ue_defer_tax_layout', 'customscript_gl_ue_defer_tax', 'customscript_gl_ue_disablememofield', 'custcollectiongermanylocalization', 'custcollection_emea_localization']),
  },
  256432: {
  },
  486381: {
  },
  325480: {
  },
  164289: {
  },
  251993: {
    '1.0.4': new Set(['customscript_ns_sc_ext_bi_orderstatus', 'customscript_ns_sc_ext_sl_orderstatus_of']),
  },
  256435: {
  },
  248760: {
    '1.0.2': new Set(['customlist_ns_sc_ext_ct_imgstyle_list', 'customlist_ns_sc_ext_ct_txt_color_list', 'customlist_ns_sc_ext_ct_linkopt_list', 'customlist_ns_sc_ext_ct_template_list', 'customrecord_ns_sc_ext_ctestimonialscct', 'customscript_sc_ctcct_install']),
  },
  42036: {
  },
  288380: {
  },
  301545: {
  },
  217070: {
  },
  392913: {
  },
  289764: {
  },
  369637: {
    '3.05': new Set(['custevent_oa_export_err_msg', 'custevent_oa_project_task_name', 'custevent_oa_epoch', 'custevent_oa_export_to_openair', 'custevent_oa_milestone', 'custentity_oa_vendor_parent', 'custentity_oa_pco_date', 'custentity_oa_epoch', 'custentity_oa_copy_prbill_auto_settings', 'custentity_oa_copy_invoice_layout', 'custentity_oa_vendor_user_currency', 'custentity_oa_vendor_tax_nexus', 'custentity_oa_copy_revrec_rules', 'custentity_oa_copy_project_pricing', 'custentity_oa_create_project_workspace', 'custentity_oa_project_stage', 'custentity_oa_export_err_msg', 'custentity_oa_revrec_auto_settings', 'custentity_oa_copy_notification_settings', 'custentity_oa_opportunity_id', 'custentity_oa_ns_purchaser', 'custentity_oa_copy_project_budget', 'custentity_oa_map_to_parent_vendor', 'custentity_oa_user_or_vendor', 'custentity_oa_project_rate_card', 'custentity_oa_sfa_id', 'custentity_oa_copy_loaded_cost', 'custentity_oa_copy_approvers', 'custentity_oa_project_id', 'custentity_oa_copy_bookings', 'custentity_oa_copy_cost_type', 'custentity_oa_project_currency', 'custentity_oa_export_to_openair', 'custentity_oa_copy_issues', 'custentity_oa_copy_expense_policy', 'custentity_oa_pco_value', 'custentity_oa_copy_dashboard_settings', 'custentity_oa_project_template', 'custentity_oa_expense_to_vendorbill', 'custentity_oa_copy_prbill_rules', 'custentity_oa_copy_custom_fields', 'custentity_oa_customer_id', 'custitem_oa_export_to_openair', 'custitem_oa_export_err_msg', 'custitem_oa_export_to_openair_product', 'custitem_oa_default_billing_rule', 'custrecord_oa_epoch_location', 'custrecord_oa_epoch_subsidiary', 'custrecord_oa_epoch', 'custrecord_oa_epoch_class', 'custrecord_oa_epoch_department', 'custbody_oa_invoice_link', 'custbody_oa_pst_override', 'custbody_oa_expense_report_user', 'custbody_oa_export_err_msg', 'custbody_oa_exp_report_internal_id', 'custbody_oa_neg_invoice_internal_id', 'custbody_oa_export_to_openair', 'custbody_oa_rev_rec_id', 'custbody_oa_gst_override', 'custbody_oa_je_from_time_id', 'custbody_oa_expense_report_number', 'custbody_oa_invoice_number', 'custbody_oa_purchase_project_id', 'custbody_oa_invoice_internal_id', 'custbody_oa_invoice_tax_amt', 'custbody_oa_exp_approver_project', 'custbody_oa_exp_approver_supervisor', 'custcol_oa_lc_debit_account', 'custcol_oa_line_from_oa', 'custcol_oa_credit_charge_type', 'custcol_oa_je_from_time_error', 'custcol_oa_time_entry_id', 'custcol_oa_lc_1', 'custcol_oa_lc_class', 'custcol_oa_task_assignment_id', 'custcol_oa_lc_subsidiary', 'custcol_oa_invoice_line_id', 'custcol_oa_rev_rec_rule', 'custcol_oa_lc_timesheet_date', 'custcol_oa_je_from_time_error_msg', 'custcol_oa_wbs_task_name', 'custcol_oa_wbs_planned_hours', 'custcol_oa_po_line_tax', 'custcol_oa_lc_2_curr', 'custcol_oa_lc_department', 'custcol_oa_lc_credit_account', 'custcol_oa_lc_0_curr', 'custcol_oa_lc_location', 'custcol_oa_wbs_assignees', 'custcol_oa_export_to_openair', 'custcol_oa_gst_override', 'custcol_oa_je_from_time_created', 'custcol_oa_wbs_phase_name', 'custcol_oa_project_task_id', 'custcol_oa_quantity_not_hours', 'custcol_oa_pst_override', 'custcol_oa_lc_0', 'custcol_oa_lc_1_curr', 'custcol_oa_wbs_phases_ancestry', 'custcol_oa_project_task_id_number', 'custcol_oa_billing_rule_type', 'custcol_oa_expense_report_line_id', 'custcol_oa_po_rate', 'custcol_oa_lc_2', 'customlist_oa_je_from_time_use_date', 'customlist_oa_je_from_time_classes', 'customlist_oa_billing_rules', 'customlist_oa_je_from_time_cost_level', 'customrecord_oa_project_rate_card', 'customrecord_oa_vendor_nexus_type', 'customrecord_oa_srp_integration_settings', 'customrecord_oa_credit_charge_type', 'customrecord_oa_forex_daily', 'customrecord_oa_monitored_fields', 'customrecord_oa_project_templates', 'customrecord_oa_forex_setting', 'customrecord_oa_user_or_vendor', 'customrecord_oa_cost_center', 'customrecord_oa_features_and_preferences', 'customrecord_oa_rev_rec_rules', 'customrecord_oa_project_stages', 'customrole1015', 'customsearch_oa_credit_charge_type', 'customsearch_oa_cost_center_search', 'customsearch_oa_forex_rate', 'customsearch_oa_features_and_preferences', 'customsearch_oa_user_or_vendor', 'customsearch_oa_project_stages', 'customsearch_oa_project_template', 'customsearch_oa_rev_rec_rule_type', 'customsearch_oa_vendor_nexus_type', 'custtab_18_660883_133', 'custtab_20_660883_152', 'custtab_16_660883_648', 'custtab_19_660883_713', 'custtab_8_660883_627', 'custtab_17_660883_267', 'custtab_21_660883_751', 'custtab_11_660883_627', 'custtab_15_660883_427', 'customscript_oa_srp_bundle_install', 'customscript_oa_cl_vendor_for_vb_int_2', 'customscript_oa_export_on_sales_order', 'customscript_oa_cl_set_dflt_b_rule_2', 'customscript_oa_po_integration_valid_2', 'customscript_oa_cl_export_supportcase_2', 'customscript_oa_cl_set_limit_time_exp_2', 'customscript_oa_set_dflt_billing_rule', 'customscript_oa_cl_validate_so_line_2', 'customscript_oa_vendor_for_vb_int', 'customscript_oa_po_integration', 'customscript_oa_set_limit_time_and_exp_c', 'customscript_oa_export_to_openair_case', 'customscript_oa_ping', 'customscript_oa_record_api', 'customscript_oa_get_field_info', 'customscript_oa_forex_rate_2', 'customscript_oa_create_je_from_time_2', 'customscript_oa_create_je_from_time', 'customscript_oa_forex_rate', 'customscript_oa_set_limit_time_and_exp', 'customscript_oa_hide_billing_rule_2', 'customscript_oa_features_and_preferences', 'customscript_oa_export_supportcase_2', 'customscript_oa_export_project_task_2', 'customscript_oa_rev_rec_percent_complete', 'customscript_oa_invoice_tax', 'customscript_oa_export_supportcase', 'customscript_oa_set_vendor_fields_2', 'customscript_oa_po_integration_save_2', 'customscript_oa_features_and_pref_2', 'customscript_oa_invoice_tax_2', 'customscript_oa_export_to_openair', 'customscript_oa_set_export_to_openair', 'customscript_oa_po_integration_save', 'customscript_oa_sfa_integration', 'customscript_oa_cantax_override_2', 'customscript_oa_set_export_to_openair_2', 'customscript_oa_hide_billing_rule', 'customscript_oa_add_timestamp', 'customscript_oa_revenue_recognition', 'customscript_oa_rev_rec_pco', 'customscript_oa_set_vendor_fields', 'customscript_oa_cantax_override', 'customscript_oa_set_limit_time_and_exp_2', 'customscript_oa_revenue_recognition_2']),
  },
  334830: {
    '1.0.5': new Set(['custentity_ns_sc_ext_asu_status', 'customlist_ns_sc_ext_asu_statuses', 'customrole_ns_sc_ext_advancedsignup', 'customsearch_advancedsignup_pending_cust', 'customscript_ns_sc_ext_bi_advancedsignup', 'customscript_ns_sc_ext_sl_advancedsignup', 'customscript_ns_sc_ue_asu_cust_approval']),
  },
  338741: {
  },
  380859: {
  },
  254709: {
  },
  92373: {
  },
  2851: {
    '2.09': new Set(['custevent_oa_export_err_msg', 'custevent_oa_project_task_name', 'custevent_oa_epoch', 'custevent_oa_milestone', 'custevent_oa_export_to_openair', 'custentity_oa_copy_loaded_cost', 'custentity_oa_vendor_parent', 'custentity_oa_map_to_parent_vendor', 'custentity_oa_opportunity_id', 'custentity_oa_project_rate_card', 'custentity_oa_project_currency', 'custentity_oa_pco_date', 'custentity_oa_project_template', 'custentity_oa_vendor_user_currency', 'custentity_oa_sfa_id', 'custentity_oa_copy_prbill_rules', 'custentity_oa_create_project_workspace', 'custentity_oa_pco_value', 'custentity_oa_epoch', 'custentity_oa_export_to_openair', 'custentity_oa_copy_revrec_rules', 'custentity_oa_copy_prbill_auto_settings', 'custentity_oa_copy_issues', 'custentity_oa_copy_custom_fields', 'custentity_oa_copy_approvers', 'custentity_oa_copy_notification_settings', 'custentity_oa_copy_dashboard_settings', 'custentity_oa_copy_project_budget', 'custentity_oa_vendor_tax_nexus', 'custentity_oa_export_err_msg', 'custentity_oa_ns_purchaser', 'custentity_oa_revrec_auto_settings', 'custentity_oa_copy_project_pricing', 'custentity_oa_copy_invoice_layout', 'custentity_oa_copy_cost_type', 'custentity_oa_copy_expense_policy', 'custentity_oa_expense_to_vendorbill', 'custentity_oa_user_or_vendor', 'custentity_oa_project_stage', 'custitem_oa_export_err_msg', 'custitem_oa_default_billing_rule', 'custitem_oa_export_to_openair', 'custitem_oa_export_to_openair_product', 'custrecord_oa_epoch_location', 'custrecord_oa_epoch', 'custrecord_oa_epoch_subsidiary', 'custrecord_oa_epoch_department', 'custrecord_oa_epoch_class', 'custbody_oa_rev_rec_id', 'custbody_oa_invoice_tax_amt', 'custbody_oa_pst_override', 'custbody_oa_export_err_msg', 'custbody_oa_export_to_openair', 'custbody_oa_exp_approver_supervisor', 'custbody_oa_invoice_number', 'custbody_oa_purchase_project_id', 'custbody_oa_exp_approver_project', 'custbody_oa_expense_report_user', 'custbody_oa_invoice_link', 'custbody_oa_invoice_internal_id', 'custbody_oa_je_from_time_id', 'custbody_oa_expense_report_number', 'custbody_oa_gst_override', 'custbody_oa_exp_report_internal_id', 'custcol_oa_lc_0', 'custcol_oa_export_to_openair', 'custcol_oa_lc_1', 'custcol_oa_lc_2_curr', 'custcol_oa_billing_rule_type', 'custcol_oa_quantity_not_hours', 'custcol_oa_time_entry_id', 'custcol_oa_rev_rec_rule', 'custcol_oa_lc_2', 'custcol_oa_lc_subsidiary', 'custcol_oa_lc_debit_account', 'custcol_oa_lc_credit_account', 'custcol_oa_lc_timesheet_date', 'custcol_oa_wbs_assignees', 'custcol_oa_project_task_id_number', 'custcol_oa_je_from_time_error_msg', 'custcol_oa_invoice_line_id', 'custcol_oa_po_line_tax', 'custcol_oa_pst_override', 'custcol_oa_lc_department', 'custcol_oa_lc_class', 'custcol_oa_je_from_time_error', 'custcol_oa_je_from_time_created', 'custcol_oa_wbs_task_name', 'custcol_oa_po_rate', 'custcol_oa_lc_0_curr', 'custcol_oa_lc_1_curr', 'custcol_oa_lc_location', 'custcol_oa_line_from_oa', 'custcol_oa_wbs_planned_hours', 'custcol_oa_project_task_id', 'custcol_oa_wbs_phases_ancestry', 'custcol_oa_gst_override', 'custcol_oa_task_assignment_id', 'custcol_oa_expense_report_line_id', 'custcol_oa_credit_charge_type', 'custcol_oa_wbs_phase_name', 'customlist_oa_je_from_time_use_date', 'customlist_oa_billing_rules', 'customlist_oa_je_from_time_cost_level', 'customlist_oa_je_from_time_classes', 'customrecord_oa_project_templates', 'customrecord_oa_vendor_nexus_type', 'customrecord_oa_features_and_preferences', 'customrecord_oa_forex_daily', 'customrecord_oa_forex_setting', 'customrecord_oa_monitored_fields', 'customrecord_oa_project_stages', 'customrecord_oa_credit_charge_type', 'customrecord_oa_rev_rec_rules', 'customrecord_oa_project_rate_card', 'customrecord_oa_user_or_vendor', 'customrecord_oa_cost_center', 'customrole1015', 'customsearch_oa_features_and_preferences', 'customsearch_oa_credit_charge_type', 'customsearch_oa_cost_center_search', 'customsearch_oa_forex_rate', 'customsearch_oa_user_or_vendor', 'customsearch_oa_project_stages', 'customsearch_oa_project_template', 'customsearch_oa_rev_rec_rule_type', 'customsearch_oa_vendor_nexus_type', 'custtab_18_660883_133', 'custtab_20_660883_152', 'custtab_16_660883_648', 'custtab_8_660883_627', 'custtab_19_660883_713', 'custtab_17_660883_267', 'custtab_21_660883_751', 'custtab_15_660883_427', 'custtab_11_660883_627', 'customscript_oa_po_integration', 'customscript_oa_set_limit_time_and_exp_c', 'customscript_oa_export_to_openair_case', 'customscript_oa_vendor_for_vb_int', 'customscript_oa_export_on_sales_order', 'customscript_oa_set_dflt_billing_rule', 'customscript_oa_record_api', 'customscript_oa_ping', 'customscript_oa_get_field_info', 'customscript_oa_forex_rate', 'customscript_oa_create_je_from_time', 'customscript_oa_sso_timesheets', 'customscript_oa_sso_invoices', 'customscript_oa_sso_expenses', 'customscript_oa_sso_home', 'customscript_oa_sso_workspaces', 'customscript_oa_sso_projects', 'customscript_oa_sso_support', 'customscript_oa_sso_admin', 'customscript_oa_sso_purchases', 'customscript_oa_sso_resources', 'customscript_oa_sso_reports', 'customscript_oa_sso_help', 'customscript_oa_invoice_tax', 'customscript_oa_add_timestamp', 'customscript_oa_export_supportcase', 'customscript_oa_features_and_preferences', 'customscript_oa_revenue_recognition', 'customscript_oa_export_to_openair', 'customscript_oa_hide_billing_rule', 'customscript_oa_set_export_to_openair', 'customscript_oa_rev_rec_pco', 'customscript_oa_po_integration_save', 'customscript_oa_set_limit_time_and_exp', 'customscript_oa_set_vendor_fields', 'customscript_oa_cantax_override', 'customscript_oa_sfa_integration']),
  },
  427237: {
  },
  43003: {
    '3.127.1.a': new Set(['custentity_vat_reg_no', 'custentity_tax_contact_first', 'custentity_ico', 'custentity_tax_contact_last', 'custentity_dic', 'custentity_tax_contact_middle', 'custentity_tax_contact', 'custitem_commodity_code', 'custitem_type_of_goods', 'custitem_code_of_supply', 'custitem_itr_supplementary_unit', 'custitem_nature_of_transaction_codes', 'custitem_itr_supplementary_unit_abbrev', 'custrecord_4110_capital_goods', 'custrecord_4110_electronic', 'custrecord_4110_no_tax_invoice', 'custrecord_4110_nondeductible_parent', 'custrecord_4110_super_reduced', 'custrecord_4110_cash_register', 'custrecord_deferred_on', 'custrecord_4110_duplicate', 'custrecord_4110_no_tax_credit', 'custrecord_4110_nondeductible_account', 'custrecord_4110_special_territory', 'custrecord_4110_surcharge', 'custrecord_4110_category', 'custrecord_4110_non_taxable', 'custrecord_4110_purchaser_issued', 'custrecord_4110_non_resident', 'custrecord_4110_parent_alt', 'custrecord_4110_reverse_charge_alt', 'custrecord_4110_suspended', 'custrecord_4110_unknown_tax_credit', 'custrecord_gcc_state', 'custrecord_4110_non_deductible', 'custrecord_4110_other_tax_evidence', 'custrecord_4110_outside_customs', 'custrecord_4110_paid', 'custrecord_4110_reduced_rate', 'custrecord_4110_triplicate', 'custrecord_subsidiary_branch_id', 'custrecord_for_digital_services', 'custrecord_deemed_supply', 'custrecord_4110_government', 'custrecord_4110_duty', 'custrecord_4110_non_operation', 'custrecord_tax_exemption_reason', 'custrecord_5826_loc_branch_id', 'custrecord_4110_import', 'custrecord_4110_non_recoverable', 'custrecord_is_direct_cost_service', 'custrecord_4110_partial_credit', 'custbody_itr_doc_number', 'custbody_regime_code', 'custbody_mode_of_transport', 'custbody_counterparty_vat', 'custbody_regime_code_of_supply', 'custbody_report_timestamp', 'custbody_date_of_taxable_supply', 'custbody_nondeductible_ref_tran', 'custbody_cash_register', 'custbody_country_of_origin', 'custbody_adjustment_journal', 'custbody_nexus_notc', 'custbody_refno_originvoice', 'custbody_transaction_region', 'custbody_delivery_terms', 'custbody_itr_nexus', 'custbody_notc', 'custbody_4110_customregnum', 'custbody_nondeductible_ref_genjrnl', 'custbody_nondeductible_processed', 'custcol_expense_code_of_supply', 'custcol_statistical_procedure_sale', 'custcol_statistical_value_base_curr', 'custcol_adjustment_field', 'custcol_nature_of_transaction_codes', 'custcol_counterparty_vat', 'custcol_emirate', 'custcol_adjustment_tax_code', 'custcol_5892_eutriangulation', 'custcol_statistical_value', 'custcol_country_of_origin_name', 'custcol_nondeductible_account', 'custcol_statistical_procedure_purc', 'custcol_country_of_origin_code', 'customlist_deferred_tax', 'customlist_delivery_terms', 'customlist_tax_exemption_code', 'customlist_nature_of_transaction_code', 'customlist_regime_code_of_supply', 'customlist_code_of_supply', 'customlist_type_of_goods', 'customrecord_tax_cache', 'customrecord_notc', 'customrecord_moss_provisioning_status', 'customrecord_supplementary_unit', 'customrecord_filing_config', 'customrecord_tax_return_setup_item', 'customrecord_tax_field', 'customrecord_transaction_nature', 'customrecord_template_content', 'customrecord_trantypelist', 'customrecord_regime_code', 'customrecord_vatonline_submittedperiod', 'customrecord_tax_template', 'customrecord_tax_form', 'customrecord_vatonline_detail', 'customrecord_tax_field_notation', 'customrecord_ecsl_audit_trail_hdr', 'customrecord_notc_default', 'customrecord_statistical_procedure', 'customrecord_tax_report_map', 'customrecord_tax_report_map_option', 'customrecord_tax_report_map_details', 'customrecord_filing_authorization', 'customrecord_tax_cache_detail', 'customrecord_ecsl_audit_trail_dtl', 'customrecord_template_attachment', 'customrecord_intrastat_region', 'customrecord_mode_of_transport', 'customrecord_itr_system_parameter', 'customrecord_filing_template', 'customrecord_online_filing', 'customscript_online_submission', 'customscript_form', 'customscript_supplementary_vn', 'customscript_supplementary_th', 'customscript_supplementary_id', 'customscript_supplementary_tr', 'customscript_supplementary_ph', 'customscript_supplementary_report', 'customrole1000', 'customrole1001', 'customrole1002', 'customrole1004', 'customsearch_itr_rgl_details', 'customsearch_itr_nd_stc_details', 'customsearch_itr_nd_stc_summary', 'customsearch_vcs_sk_corrected_txn_detail', 'customsearch_vcs_sk_credit_applications', 'custtab_17_3776644_208', 'custtab_15_3776644_208', 'custtab_16_3776644_208', 'customscript_8375_bundle_install', 'customscript_vies_tax_reg_val_cs', 'customscript_4874_intrastat_item_cs', 'customscript_5362_format_cs', 'customscript_new_ec_sales_csscript', 'customscript_vatonline_config_client', 'customscript_authorization_cs', 'customscript_vat_filter_cs', 'customscript_esl_prevent_edit_cs', 'customscript_itr_intrastat_cs', 'customscript_tax_tran_cs', 'customscript_vat_onlinefiling_cs', 'customscript_generate_field_cache', 'customscript_online_filing_ss', 'customscript_tax_supplementary_scheduled', 'customscript_new_ecsales_submithmrc', 'customscript_moss_provisioning_processor', 'customscript_tax_bundle_maintenance', 'customscript_create_taxcodes_ss', 'customscript_vatonline_uk_sched_poll', 'customscript_new_ec_sales_listdisp', 'customscript_eslauditlock_error', 'customscript_online_filing_runner_su', 'customscript_itr_intrastat', 'customscript_4110_dispatcher_filter', 'customscript_vat_filter', 'customscript_vat_main', 'customscript_online_filing_import_su', 'customscript_4110_report_dispatcher', 'customscript_tax_return_setup', 'customscript_authorization_su', 'customscript_3127_submit_online', 'customscript_online_filing_su', 'customscript_4874_project_ue', 'customscript_eslauditlock_error_ue', 'customscript_eu_vatregno_valid_link', 'customscript_itr_system_parameter_ue', 'customscript_moss_provisioning_trigger', 'customscript_vatonline_uk_submittedperio', 'customscript_4110_tax_field_access_ue', 'customscript_nexus_create_ue', 'customscript_4874_intrastat_notc_ue', 'customscript_tax_tran_ue', 'customscript_4874_intrastat_item_ue', 'customscript_online_filing_ue']),
  },
  265450: {
  },
  362244: {
  },
  292237: {
  },
  51007: {
  },
  198386: {
  },
  219120: {
  },
  421277: {
  },
  411460: {
  },
  239645: {
    '1.00': new Set(['custbody_currentuser_hid', 'customscript_poawf_bi_ss', 'customscript_poawf_saverecord_cs', 'customscript_poaw_checkapprover_suite_ss', 'customscript_poaw_imapprover_suite_ss', 'customworkflow_poawf', 'customworkflow_poawf_main']),
  },
  486259: {
  },
  402703: {
    '1.1.0': new Set(['customrecord_sc_cookie_consent_cct_link', 'customscript_ns_sc_ext_bi_cookieconsent']),
  },
  210159: {
  },
  443808: {
  },
  267306: {
    '1.01.3': new Set(['customrecord_scisapm_setup_emp_access', 'customrecord_scisapm_setup_roles_access', 'customrecord_scisapm_setup_parent', 'customscript_scisapm_bi', 'customscript_scisapm_setup_sl_main', 'customscript_scisapm_aid_sl_userevent', 'customscript_scisapm_db_sl_allactions', 'customscript_scisapm_aid_sl_bundledetail', 'customscript_scisapm_db_sl_main', 'customscript_scisapm_sl_bundle', 'customscript_scisapm_db_sl_subslist', 'customscript_scisapm_db_sl_actiondt', 'customscript_scisapm_db_sl_loclist', 'customscript_scisapm_db_sl_critactions', 'customscript_scisapm_aid_sl_csurlrequest', 'customscript_scisapm_aid_sl_workflow', 'customscript_scisapm_db_sl_userlist', 'customscript_scisapm_db_sl_devicelist', 'customscript_scisapm_aid_sl_overview', 'customscript_scisapm_aid_sl_main', 'customscript_scisapm_db_sl_actionlogs']),
  },
  69017: {
  },
  488833: {
  },
  312849: {
  },
  446901: {
  },
  375624: {
  },
  17447: {
    '1.02': new Set(['customrecord_ns_pivotfields', 'customrecord_ns_pivotlayout', 'customscript_ns_pivotsearch_installation']),
  },
  165215: {
  },
  250732: {
    '1.3.0': new Set(['customlist_ns_sc_ext_featcat_sort_fld', 'customlist_cct_ns_featcatcct_mobile_c', 'customlist_ns_sc_ext_featcat_item_qty', 'customlist_ns_sc_ext_featcat_rows_list', 'customlist_ns_sc_ext_featcat_position', 'customlist_ns_sc_ext_featcat_styl_list', 'customlist_ns_sc_ext_featcat_columns', 'customrecordcct_netsuite_featcategorycct', 'customscript_sc_fc_install', 'customscript_ns_sc_ss_featured_category']),
  },
  286081: {
  },
  49018: {
    '2.01.5': new Set(['customlist_stick_list_keyboardshortcut', 'customrecord_stick_note_reply', 'customrecord_stick_note_category', 'customrecord_stick_note', 'customrecord_stick_standard_record', 'customrecord_stick_note_user_category', 'customrecord_stick_sort_filter', 'customrecord_stick_note_size', 'customrecord_stick_sched_script_queue', 'customrecord_stick_enabled_record_type', 'customrecord_stick_file_html', 'customrecord_stick_email_capture', 'customrecord_stick_record_type_holder', 'customrecord_stick_font_size', 'customrecord_stick_user_board_sort', 'customscript_stick_email_capture', 'customsearch_stickynotes_folder_access', 'customscript_stick_bundle_install', 'customscript_stick_config_cs', 'customscript_stick_sched_script_queue_ha', 'customscript_stick_file_dl_sl', 'customscript_stick_csvexport_sl', 'customscript_stick_file_dnd_sl', 'customscript_stick_generate_css', 'customscript_stick_config_sl', 'customscript_stick_user_backend_sl', 'customscript_stick_admin_backend_sl', 'customscript_stick_board_frontend_sl', 'customscript_stick_user_preference', 'customscript_stick_note_size_ue', 'customscript_stick_record_page_ue', 'customscript_stick_category_ue', 'customscript_stick_font_size_ue']),
  },
  256715: {
  },
  467447: {
  },
  413984: {
  },
  331808: {
  },
  219279: {
  },
  219322: {
  },
  348013: {
  },
  127355: {
    '1.01.3': new Set(['custentity_cus_chargebacked', 'customlist_money_moving_effect', 'customlist_chargeback_effect', 'customlist_chargeback_status', 'customrecord_chargeback', 'customrecord_chargeback_notification', 'customrecord_chargeback_settings', 'customsearch_cbw_chargeback', 'customscript_cbw_c_notification', 'customscript_cbw_c_chargeback', 'customscript_cbw_ss_processnotification', 'customscript_cbw_sl_chargeback', 'customscript_cbw_sl_settingsubsidiaries', 'customscript_cbw_sl_settings', 'customscript_cbw_sl_chargebacklist', 'customscript_cbw_ue_account_subsidiary', 'customscript_cbw_ue_transaction', 'customscript_cbw_ue_notifi_processed', 'customscript_cbw_ue_notification', 'customscript_cbw_ue_chargeback']),
  },
  297494: {
  },
  198385: {
  },
  436209: {
    '9.05.0': new Set(['custentity_edoc_use_sender_list', 'custentity_psg_ei_peppol_id', 'custentity_edoc_sender_domain', 'custentity_psg_ei_auto_select_temp_sm', 'custentity_psg_ei_entity_edoc_standard', 'custentity_edoc_ws_sender', 'custentity_edoc_ws_id', 'custentity_edoc_gen_trans_pdf', 'custrecord_psg_ei_disable_country', 'custrecord_permission_sending', 'custrecord_psg_ei_notif_recipient', 'custrecord_psg_ei_sender', 'custrecord_advanced_pdf_template', 'custrecord_permission_certification', 'custrecord_psg_ei_email_custom', 'custrecord_permission_generation', 'custrecord_psg_ei_license_free_country', 'custrecord_permission_network_status', 'custbody_psg_ei_template_inlinehelp', 'custbody_psg_ei_inbound_edocument', 'custbody_psg_ei_qr_code', 'custbody_psg_ei_qr_string', 'custbody_psg_ei_content', 'custbody_ei_ds_txn_identifier', 'custbody_psg_ei_template', 'custbody_edoc_gen_trans_pdf', 'custbody_psg_ei_generated_edoc', 'custbody_psg_ei_digitalsignature_label', 'custbody_ei_network_name', 'custbody_psg_ei_status', 'custbody_edoc_generated_pdf', 'custbody_psg_ei_sending_method', 'custbody_psg_ei_trans_edoc_standard', 'custbody_psg_ei_edoc_recipient', 'custbody_ei_network_id', 'custbody_psg_ei_pdf', 'custbody_psg_ei_certified_edoc', 'custbody_ei_network_status', 'custbody_ei_network_updated_date_time', 'custbody_psg_ei_inb_txn_po_valid_bypas', 'customlist_psg_ei_po_processing_types', 'customlist_psg_ei_sending_batch_status', 'customlist_psg_ei_status', 'customlist_psg_ei_file_content_type', 'customlist_psg_ei_inbound_source', 'customlist_psg_ei_audit_trail_events', 'customlist_psg_ei_edoc_automation', 'customrecord_ei_sending_method', 'customrecord_psg_ei_email_custom', 'customrecord_ei_ctt_map', 'customrecord_psg_ei_email_recipient_vend', 'customrecord_ei_automation_pref', 'customrecord_psg_ei_email_recipient', 'customrecord_psg_ei_request', 'customrecord_psg_ei_template_validator', 'customrecord_psg_ei_template', 'customrecord_psg_ei_conversion_batch', 'customrecord_psg_ei_audit_trail', 'customrecord_psg_ei_sending_batch', 'customrecord_psg_ei_inbound_edoc', 'customrecord_psg_ei_sub_prefs_data', 'customrecord_psg_ei_email_sender_vend', 'customrecord_psg_ei_standards', 'customrecord_psg_ei_validation_plugin', 'customscript_edoc_pl_anz_peppol_cds', 'customscript_edoc_pl_ctsales_outbound', 'customscript_edoc_pl_anz_ppl_inb_cds', 'customscript_edoc_pl_ctpurchase_outbound', 'customscript_cds_vendor_credit', 'customscript_edoc_pl_peppol_outbound_cds', 'customscript_ei_pl_filter_plugin', 'customscript_ei_pl_inject_data_source', 'customscript_ei_pl_digital_signature', 'customscript_ei_pl_outbound_validation', 'customscript_ei_pl_sending_plugin', 'customscript_ei_pl_type_validation', 'customscript_ei_pl_inject_data_inbound', 'customscript_edoc_pi_inbound_email_cap', 'customrole_edoc_inbound_ws_role', 'customsearch_ei_sending_methods_certific', 'customsearch_ei_sending_methods', 'customsearch28', 'customsearch_edoc_templates', 'customsearch_edoc_inbound_incomplete', 'customsearch_edoc_inbound_for_conversion', 'customsearch_subsidiary_search', 'customsearch_ei_invoice_list_view', 'customsearch_edoc_with_errors', 'customsearch_edoc_for_sending', 'customsearch_edoc_for_generation', 'customsearch_edoc_for_certification', 'custtab_6_4346104_208', 'custtab_7_4346104_208', 'customscript_ei_init_bundle_installation', 'customscript_ei_sending_method_cs', 'customscript_ei_inbound_edocument_cs', 'customscript_ei_template_cs', 'customscript_ei_doc_standard_cs', 'customscript_ei_customer_cs', 'customscript_edoc_sales_transaction_cs', 'customscript_ei_vendor_cs', 'customscript_psg_ei_subsidiary_prefs_cs', 'customscript_edoc_mr_convert', 'customscript_mr_einv_generate_content', 'customscript_ei_mr_ctt_dep_create', 'customscript_ei_mr_einv_sending', 'customscript_edoc_mr_automatic_certify', 'customscript_edoc_mr_automatic_send', 'customscript_ei_mr_manual_convert', 'customscript_ei_mr_update_templates_sm', 'customscript_psg_ei_sub_pref_po_valid_mr', 'customscript_edoc_mr_automatic_network', 'customscript_psg_ei_subsidiary_prefs_mr', 'customscript_edoc_dashboard_pt', 'customscript_edoc_web_service_rl', 'customscript_ei_sending_rescheduler', 'customscript_ei_conversion_rescheduler', 'customscript_ei_license_info_service_su', 'customscript_ei_cancellation_service_su', 'customscript_ei_template_service_su', 'customscript_ei_edoc_loading_service_su', 'customscript_ei_processing_service_su', 'customscript_ei_generation_service_su', 'customscript_ei_conversion_service_su', 'customscript_ei_content_service_su', 'customscript_ei_content_prev_service_su', 'customscript_su_send_e_invoice', 'customscript_ei_content_download', 'customscript_ei_translation_service_su', 'customscript_ei_outbound_form_su', 'customscript_ei_inbound_form_su', 'customscript_ei_xsdvalidation_service_su', 'customscript_ei_prefs', 'customscript_get_network_status_su', 'customscript_ei_permission_check_service', 'customscript_edoc_ue_subsidiary', 'customscript_psg_ei_subsidiary_prefs_ue', 'customscript_edoc_cust_recipient_ue', 'customscript_ei_conversion_batch_ue', 'customscript_ei_batch_ue', 'customscript_edoc_sales_transaction_ue', 'customscript_ei_vendor_ue', 'customscript_edoc_inbound_transaction_ue', 'customscript_edoc_validation_plugin_ue', 'customscript_ei_customer_ue', 'customscript_ei_sending_method_ue', 'customscript_ei_template_ue', 'customscript_ei_document_standard_ue', 'customscript_edoc_ue_inbound', 'customscript_edoc_vend_sender_ue', 'customscript_ei_template_validator_ue', 'customscript_edoc_vend_recipient_ue', 'custcollection_ei_translations']),
  },
  228841: {
  },
  322956: {
    '2.01.4': new Set(['customlist_lotsn_trace_type', 'customlist_lotsn_transaction_subtabs', 'customrecord_lot_sn_trace_grid', 'customrecord_export_file_types', 'customrecord_lotsn_traceability_pref', 'customrole_lot_sn_role', 'customsearch_ss_trace_procurement_rpt', 'customsearch_ss_trace_other_trx_rpt', 'customsearch_ss_trace_fulfillment_rpt', 'customsearch_ss_trace_build_rpt', 'customsearch_sn_build_subtab_forward', 'customscript_lt_sn_cs_tracing_filter', 'customscript_lot_sn_cs_trace_pref', 'customscript_lt_sn_export_tabs', 'customscript_lt_sn_sl_item_number_popup', 'customscript_lt_sn_sl_tracingfilter', 'customscript_lot_sn_show_export_content', 'customscript_lt_sl_data_service', 'customscript_lt_sn_sl_tracingfieldchange', 'customscript_lt_sn_sl_serialize_filter', 'customscript_lot_sn_ue_trace_pref', 'custcollection_lot_and_serial_number_trace', 'customworkflow_lot_sn_trace_workflow']),
  },
  328363: {
  },
  220018: {
  },
  250341: {
    '1.4.4': new Set(['customscript_ns_sc_sl_gtm_editor', 'customscript_ext_loggerendpoint']),
  },
  301860: {
    '1.03.0': new Set(['custbody_seql_related_project', 'customsearch_seql_bank_balance', 'customsearch_seql_project_select_list', 'customsearch_seql_apar_ven_select_list', 'customsearch_seql_arap_summary_tnx_srch', 'customsearch_seql_ap_no_cust_main_proj', 'customsearch_seql_apar_venexpand', 'customsearch_seql_apar_dets_ventxnexpand', 'customsearch_seql_project_summary_totals', 'customsearch_seql_apar_dets_custxnexpand', 'customsearch_seql_kpi_summary_totals', 'customsearch_seql_apar_colps_txn_sum_srh', 'customsearch_seql_apar_dets_ventxn_prj', 'customscript_seql_bundle_installation', 'customscript_seql_cs_vendor_payment', 'customscript_seql_mr_upd_ap_cust_ml_proj', 'customscript_seql_pl_apar_dahboard_tile', 'customscript_seql_rl_request_handler', 'customscript_seql_su_apar_detail_page', 'customscript_seql_su_apar_detail_tab', 'customscript_seql_su_arap_summary_page', 'customscript_seql_ue_projectform', 'customscript_seql_ue_vendor_bill', 'custcollection_seql_translation']),
  },
  480662: {
  },
  317102: {
    '3.2.10': new Set(['customlist_cct_ns_rs_fallback_type', 'customrecord_cct_ns_rs_wgt', 'customscript_ns_recsys_wgt_install2', 'customscript_ns_recsys_wgt_service', 'customscript_ns_recsys_wgt_logger']),
  },
  230097: {
  },
  219306: {
  },
  218286: {
  },
  419251: {
  },
  36478: {
  },
  27369: {
  },
  219479: {
  },
  371551: {
  },
  244097: {
    '1.0.3': new Set(['custitem_ns_sc_ext_ts_fields_desc', 'custitem_ns_sc_ext_ts_override', 'custitem_ns_sc_ext_ts_30_quantity', 'custitem_ns_sc_ext_ts_365_amount', 'custitem_ns_sc_ext_ts_exclude', 'custitem_ns_sc_ext_ts_7_amount', 'custitem_ns_sc_ext_ts_30_amount', 'custitem_ns_sc_ext_ts_90_amount', 'custitem_ns_sc_ext_ts_layoutfix1', 'custitem_ns_sc_ext_ts_7_quantity', 'custitem_ns_sc_ext_ts_365_quantity', 'custitem_ns_sc_ext_ts_90_quantity', 'custitem_ns_sc_ext_ts_layoutfix2', 'customrecord_ns_sc_ext_top_seller_items', 'customsearch_ns_sc_ext_topsellers_items', 'customsearch_ns_sc_ext_topsellers', 'custtab_260_t1533071_680', 'custtab_ns_sc_ext_topsellers', 'customscript_ns_sc_ext_bi_topsellers', 'customscript_ns_sc_ext_cs_ts_items', 'customscript_ns_sc_ext_mr_ts_aggregator', 'customscript_ns_sc_ext_mr_ts_matrixpatch', 'customscript_ns_sc_ext_mr_ts_calculator', 'customscript_ns_sc_ext_ue_ts_items']),
  },
  254263: {
    '2.03.10': new Set(['custrecord_glm_include', 'custbody_glm_csv_reference', 'custbody_glm_cs_permission', 'custbody_glm_reference', 'customrecord_glm_sequence', 'customrecord_glm_dp_reference', 'customrecord_glm_variable', 'customrecord_glm_tranline', 'customrecord_glm_job', 'customrecord_glm_matching', 'customrecord_glm_dp_matching', 'customrole_glm_permissions_role', 'customsearch_glm_sublist_multibook_on', 'customsearch_glm_sublist_multibook_off', 'customsearch_glm_report_multibook_on', 'customsearch_glm_report_multibook_off', 'custsublist_glm_sublist', 'custtab_glm_matching_hidden', 'custtab_glm_matching', 'customscript_glm_bi_script', 'customscript_glm_cs_account', 'customscript_glm_cs_transaction', 'customscript_glm_cs_dashboard', 'customscript_glm_mr_refg', 'customscript_glm_csv_job_creater', 'customscript_glm_mr_refs', 'customscript_glm_mr_match', 'customscript_glm_mr_refu', 'customscript_glm_mr_unmatch', 'customscript_glm_ss_build_saved_searches', 'customscript_glm_ss_scheduler', 'customscript_glm_ss_datachecker', 'customscript_glm_ss_multibook', 'customscript_glm_su_dashboard', 'customscript_glm_su_checklist', 'customscript_glm_su_invalidate_cache', 'customscript_glm_ue_matching', 'customscript_glm_ue_hide_subtab', 'customscript_glm_ue_account', 'customscript_glm_ue_transaction', 'customscript_glm_ue_tranline', 'customscript_glm_ue_custom_transaction']),
  },
  359132: {
    '1.2.1': new Set(['custentity_alf_cust_hide_service_periods', 'custentity_alf_customer_hide_total_vat', 'custentity_alf_customer_bank_details', 'custentity_alf_customer_store_pdf', 'custentity_alf_company_reg_num', 'custentity_alf_mop_default', 'custitem_alf_print_item_name', 'custrecord_alf_mark_copy_or_duplicate', 'custrecord_alf_so_notes', 'custrecord_alf_company_reg_num', 'custrecord_alf_vat_summary_in_base_curr', 'custrecord_alf_proforma_notes', 'custrecord_alf_notes_late_pay', 'custrecord_alf_sub_note_no_pay_dis', 'custrecord_alf_tax_type', 'custrecord_alf_sub_lock_invoice', 'custrecord_alf_sub_logo_width', 'custrecord_alf_share_capital', 'custrecord_alf_custom_notes', 'custrecord_alf_other_legal_info', 'custrecord_alf_managing_director', 'custrecord_alf_sic_code', 'custrecord_alf_sub_hide_total_vat', 'custrecord_alf_sub_default_invoice_lang', 'custrecord_alf_sub_bank_details', 'custrecord_alf_sub_hide_service_periods', 'custrecord_alf_sub_logo_height', 'custrecord_alf_sub_print_bill_to_right', 'custbody_alf_subsidiary_name', 'custbody_alf_tax_compliance_text', 'custbody_alf_sub_lock', 'custbody_alf_currency_symbol', 'custbody_alf_tx_hide_total_vat', 'custbody_alf_cust_inv_translations', 'custbody_alf_bank_details_in_comp_info', 'custbody_alf_tx_print_details', 'custbody_alf_hide_total_vat_in_compinf', 'custbody_alf_invoice_subsidcurrency', 'custbody_alf_customers_country', 'custbody_alf_payment_reference', 'custbody_alf_subsidiary_legal_name', 'custbody_alf_bank_det_to_print', 'custbody_alf_cfg', 'custbody_alf_subsidiary_address', 'custbody_alf_mop_print_on_invoice', 'custbody_alf_trans_bank_details', 'custbody_alf_bank_det_dd_details', 'custbody_alf_nexus_country_in_ste', 'custbody_alf_print_payment_installment', 'custbody_alf_mop', 'custbody_alf_mop_print_on_credmemo', 'custcol_alf_item_service_periods', 'custcol_alf_itemline_id', 'custcol_alf_lot_serial_number', 'custcol_alf_print_item_name', 'customlist_alf_lock_invoice_mode', 'customlist_alf_printout_type', 'customlist_alf_tax_type', 'customlist_alf_mop_types', 'customlist_alf_cfg_text_colors', 'customrecord_alf_bank_details', 'customrecord_alf_method_of_payment', 'customrecord_alf_service_period', 'customrecord_alf_tax_compliance_text', 'customrecord_alf_cust_inv_translations', 'customrecord_alf_tx_printing_history', 'customrecord_alf_cfg', 'customrecord_alf_pdf_watermark', 'custtmpl_alf_sales_order_pdf', 'custtmpl_alf_pro_forma_pdf', 'custtmpl_alf_invoice_pdf', 'custtmpl_alf_credit_memo_pdf', 'customrole_alf_script_role', 'custtab_alf_entity_setup', 'custtab_alf_item_setup', 'custtab_alf_trans_setup', 'customscript_alf_bis', 'customscript_alf_cs_customer', 'customscript_alf_cs_locking', 'customscript_alf_mr_copy_details', 'customscript_alf_mr_item_print_name', 'customscript_alf_mr_save_cust_transla', 'customscript_alf_mr_copy_reg_numbers', 'customscript_alf_su_configuration', 'customscript_alf_su_adminbypass', 'customscript_alf_su_source_fields', 'customscript_alf_ue_tx_printing', 'customscript_alf_ue_item_print', 'customscript_alf_ue_message', 'customscript_alf_ue_customer', 'customscript_alf_ue_so_service_period', 'customscript_alf_ue_method_of_payment', 'customscript_alf_ue_invoice', 'customscript_alf_ue_tr_set_tax_cmp_txt', 'customscript_alf_ue_subsidiary', 'customscript_alf_ue_tax_compliance_text', 'custcollection_alf_translations_2', 'custcollection_alf_transaction_template', 'custcollection_alf_translations']),
  },
  260434: {
  },
  219307: {
  },
  468619: {
  },
  425774: {
  },
  459771: {
  },
  404928: {
  },
  413609: {
  },
  47459: {
    '1.45.3.a': new Set(['custentity_ph_philhealth', 'custentity_ph_tin', 'custentity_4601_defaultwitaxcode', 'custentity_ph_ctc', 'custentity_ph4185_bstyle', 'custitem_4601_defaultwitaxcode', 'custbody_4601_doc_ref_id', 'custbody_4601_entitytype', 'custbody_4601_appliesto', 'custbody_4601_entitydefaultwitaxcode', 'custbody_ph4014_wtax_wamt', 'custbody_ph4185_bstyle', 'custbody_ph4014_wtax_rate', 'custbody_ph4014_wtax_code', 'custbody_wtax_base_url', 'custbody_ph4014_wtax_applied', 'custbody_4601_total_amt', 'custbody_ph4014_wtax_reversal_flag', 'custbody_ph4014_wtax_bamt', 'custbody_ph4014_wtax_cpay_pacct', 'custbody_4601_pymnt_ref_id', 'custbody_4601_wtax_withheld', 'custcol_ph4014_src_empid', 'custcol_4601_witaxline', 'custcol_4601_witaxbamt_exp', 'custcol_4601_witaxline_exp', 'custcol_4601_witaxrate_exp', 'custcol_4601_witaxbaseamount', 'custcol_4601_witaxrate', 'custcol_4601_witaxcode_exp', 'custcol_ph4014_src_tranintid', 'custcol_4601_witaxcode', 'custcol_4601_witaxamount', 'custcol_4601_witaxapplies', 'custcol_ph4014_src_vendorid', 'custcol_ph4014_src_jrnltrantypeid', 'custcol_4601_witaxamt_exp', 'custcol_ph4014_src_custid', 'custcol_4601_itemdefaultwitaxcode', 'customlistph4185_bstyle', 'customlist_wtax_available_on', 'customrecord_4601_companyinfoloader', 'customrecord_ph4014_wtax_type_d', 'customrecord_4601_validationfields', 'customrecord_4601_groupedwitaxcode', 'customrecord_ph4014_wtax_type_kind', 'customrecord_4601_witaxsetup', 'customrecord_wtax_cache', 'customrecord_ph4014_wtax_jrnl_type', 'customrecord_4601_witaxtype', 'customrecord_4601_witaxcode', 'customrecord_4601_witaxconfiguration', 'customrecord_wtax_job', 'customrole_wtax_bookkeeper', 'customrole_wtax_accountant', 'customrole_wtax_accountat_rvwr', 'customrole_wtax_cfo', 'customsearch_2307_transaction_totals', 'customsearch_2307_trxn', 'customsearch_2307_ph_implem_trxn', 'customsearch_2307_payment_trxn', 'customsearch_2307_payment_check_trxn', 'customsearch_2307_accrual_trxn', 'customscript_wtax_bundle_install', 'customscript_4601_witaxgroup_cs', 'customscript_form_2307_client', 'customscript_wi_tax_filter_acct', 'customscript_4601_witaxsetup_cs', 'customscript_form_1601_client', 'customscript_sawt_client', 'customscript_4601_accrual_cs', 'customscript_map_client', 'customscript_form_1601eq_client', 'customscript_4601_defaultwitaxcode_cs', 'customscript_4601_payment_cs', 'customscript_wtax_job_processor', 'customscript_wtax_code_ss', 'customscript_sawt', 'customscript_4601_witaxcode', 'customscript_4601_witaxsetup', 'customscript_gen_vendor_purc_summary', 'customscript_gen_vendor_summary', 'customscript_gen_cust_sales_detail', 'customscript_4601_wi_tran_lock_warn', 'customscript_4601_countryreports', 'customscript_gen_customer_summary', 'customscript_gen_vendor_detail', 'customscript_form_1601eq', 'customscript_4601_witaxtype', 'customscript_gen_customer_detail', 'customscript_wtax_job_utility_s', 'customscript_form_1601', 'customscript_4601_witaxgroup', 'customscript_4601_wh_gl_impact_s', 'customscript_gen_vendor_purc_detail', 'customscript_gen_cust_sales_summary', 'customscript_map', 'customscript_4601_accrual_ue', 'customscript_4601_companyinfoloader_ue', 'customscript_4601_defaultwitaxcode', 'customscript_wtax_code_ue', 'customscript_wtax_run_job_ue', 'customscript_4601_wi_custrec_lock_ue', 'customscript_4601_void_pymnt', 'customscript_4601_wi_tran_lock_ue', 'customscript_4601_hidewitaxfields_ue', 'customscript_4601_payment_ue']),
  },
  286083: {
  },
  468574: {
  },
  319460: {
  },
  414835: {
  },
  412967: {
  },
  385757: {
  },
  405717: {
  },
  467364: {
  },
  21147: {
  },
  314864: {
  },
  317462: {
  },
  500910: {
  },
  217069: {
  },
  58416: {
    '2.00.0': new Set(['custentity_esc_industry', 'custentity_esc_annual_revenue', 'custentity_esc_no_of_employees', 'custentity_esc_last_modified_date', 'custbody_esc_last_modified_date', 'custbody_esc_created_date', 'custbody_esc_campaign_category', 'customlist_esc_industries', 'customlist_esc_ratings', 'custom1', 'custform_2_3368792_586', 'custform_10_3368792_586', 'custform_8_3368792_586', 'custform_12_3368792_586', 'custform_3_3368792_586', 'custform_5_3368792_586', 'custform_11_3368792_586', 'custform_13_3368792_586', 'custform_6_3368792_586', 'custform_7_3368792_586', 'custform_4_3368792_586', 'custform_9_3368792_586', 'custform_20_3368792_586', 'custform_19_3368792_586', 'custform_18_3368792_586', 'custform_21_3368792_586', 'customrole_esc_sales_rep', 'customrole_esc_sales_manager', 'customrole_esc_sales_admin', 'customrole_esc_sales_publisher', 'customsearch_esc_activity_search', 'customsearch_esc_my_activities', 'customsearch_esc_my_cases', 'customsearch_esc_contact_search', 'customsearch_esc_my_contacts', 'customsearch_esc_cust_lead_search', 'customsearch_esc_my_customers', 'customsearch_esc_my_leads', 'customsearch_esc_my_prospects', 'customsearch_esc_my_relationships', 'customsearch_esc_document_search', 'customsearch_esc_my_documents', 'customsearch_esc_event_search', 'customsearch_esc_scheduled_meetings', 'customsearch_esc_contact_grp_search', 'customsearch_esc_customer_group_search', 'customsearch_esc_group_search', 'customsearch_esc_my_groups', 'customsearch_esc_item_search', 'customsearch_esc_opportunity_search', 'customsearch_esc_my_opportunities', 'customsearch_esc_my_phone_calls', 'customsearch_esc_sales_campaign_search', 'customsearch_esc_my_sales_campaign', 'customsearch_esc_my_tasks', 'customsearch_esc_transaction_search', 'customsearch_esc_my_cash_sales', 'customsearch_esc_my_quotes', 'customsearch_esc_my_sales_orders', 'customsearch_esc_my_transactions', 'custtab_9_3368792_208', 'custtab_10_3368792_208', 'custtab_8_3368792_208', 'custtab_6_3368792_208', 'custtab_4_3368792_208', 'custtab_3_3368792_208', 'custtab_7_3368792_208', 'custtab_5_3368792_208', 'custtab_2_3368792_208', 'customscript_esc_bundle_script']),
  },
  49333: {
  },
  314865: {
  },
  217071: {
  },
  384223: {
    '2.0': new Set(['customlist_gscr_des_data_li', 'customlist_gscr_load_meth_li', 'customlist_gscr_fea_spec_data_lis', 'customlist_gscr_percent_complete', 'customlist_gscr_vert_spec_data', 'customlist_gscr_provide_data_li', 'customlist_gscr_data_pri_li', 'customlist_gscr_data_type', 'customrecord_gscr_data_tracker', 'customsearch328', 'customsearch332', 'customsearch334', 'customsearch335', 'customsearch337', 'customsearch_gscr_data_tracker_alert', 'customsearch_gscr_data_track_overv_dash']),
  },
  251783: {
    '1.2.3': new Set(['custitem_ns_sc_ext_id_hide_low_qty_msg', 'custitem_ns_sc_ext_id_low_stock_msg', 'custitem_ns_sc_ext_id_hide_qty_avl', 'custitem_ns_sc_ext_id_stock_message', 'custitem_ns_sc_ext_id_low_stock_thresh', 'custitem_ns_sc_ext_id_hide_invt_msg', 'custitem_ns_sc_ext_id_qty_avl_msg', 'custitem_ns_sc_ext_id_bo_msg', 'customrole_ns_sc_inventory_display', 'custtab_260_t1533071_680', 'custtab_ns_sc_ext_inventory_display', 'customscript_ns_sc_ext_bi_inv_display', 'customscript_ns_sc_sl_inventory_display']),
  },
  249416: {
    '1.0.4': new Set(['custitem_ns_sc_ext_sich_size_chart_id', 'custitem_ns_sc_ext_sich_size_chart', 'customrecord_ns_sc_ext_size_chart', 'custtab_260_t1533071_680', 'custtab_ns_sc_ext_sich_tab', 'customscript_ns_sc_ext_bi_sichart_ss2']),
  },
  347046: {
  },
  338212: {
    '1.00.1': new Set(['custrecord_sss_location_open_date', 'customlist_sss_reporting_period', 'customlist_sss_metric_list', 'customrecord_sss_calendar_pref', 'customrecord_sss_calendar', 'customrecord_sss_calendardates', 'customrecord_sss_elk_config', 'customrole_sss_user_sub_report_runner', 'customrole_sss_report_runner', 'customsearch_sss_calendar_yeardefault', 'customsearch_sss_calendar_dates', 'customsearch_sss_calendar_names', 'customsearch_sss_calendar_csvfolder', 'customsearch_sss_compare_method_one', 'customsearch_sss_report_data', 'customscript_sss_bi_bundlesetup', 'customscript_sss_cs_calendarvalidation', 'customscript_sss_pl_report', 'customscript_sss_ss_calendardates_delete', 'customscript_sss_ss_calendardates', 'customscript_sss_cal_preferences', 'customscript_sss_sl_link_to_report', 'customscript_sss_sl_csv_validations', 'customscript_sss_sl_detail_report', 'customscript_sss_ue_calendar', 'customscript_sss_ue_location', 'custcollection_same_store_sales']),
  },
  220017: {
  },
  95282: {
  },
  94255: {
  },
  464729: {
  },
  169224: {
  },
  34369: {
  },
  281760: {
  },
  359209: {
  },
  19656: {
    '2.00.0': new Set(['custentity_esc_last_modified_date', 'custentity_esc_industry', 'custentity_esc_no_of_employees', 'custentity_esc_annual_revenue', 'custbody_esc_campaign_category', 'custbody_esc_created_date', 'custbody_esc_last_modified_date', 'customlist_esc_industries', 'customlist_esc_ratings', 'custom1', 'custform_10_3368792_586', 'custform_2_3368792_586', 'custform_4_3368792_586', 'custform_5_3368792_586', 'custform_8_3368792_586', 'custform_6_3368792_586', 'custform_9_3368792_586', 'custform_11_3368792_586', 'custform_12_3368792_586', 'custform_7_3368792_586', 'custform_3_3368792_586', 'custform_13_3368792_586', 'custform_21_3368792_586', 'custform_18_3368792_586', 'custform_20_3368792_586', 'custform_19_3368792_586', 'customrole_esc_sales_rep', 'customrole_esc_sales_manager', 'customrole_esc_sales_admin', 'customrole_esc_sales_publisher', 'customsearch_esc_activity_search', 'customsearch_esc_my_activities', 'customsearch_esc_my_cases', 'customsearch_esc_contact_search', 'customsearch_esc_my_contacts', 'customsearch_esc_cust_lead_search', 'customsearch_esc_my_customers', 'customsearch_esc_my_leads', 'customsearch_esc_my_prospects', 'customsearch_esc_my_relationships', 'customsearch_esc_document_search', 'customsearch_esc_my_documents', 'customsearch_esc_event_search', 'customsearch_esc_scheduled_meetings', 'customsearch_esc_contact_grp_search', 'customsearch_esc_customer_group_search', 'customsearch_esc_group_search', 'customsearch_esc_my_groups', 'customsearch_esc_item_search', 'customsearch_esc_opportunity_search', 'customsearch_esc_my_opportunities', 'customsearch_esc_my_phone_calls', 'customsearch_esc_sales_campaign_search', 'customsearch_esc_my_sales_campaign', 'customsearch_esc_my_tasks', 'customsearch_esc_transaction_search', 'customsearch_esc_my_cash_sales', 'customsearch_esc_my_quotes', 'customsearch_esc_my_sales_orders', 'customsearch_esc_my_transactions', 'custtab_8_3368792_208', 'custtab_9_3368792_208', 'custtab_10_3368792_208', 'custtab_4_3368792_208', 'custtab_6_3368792_208', 'custtab_3_3368792_208', 'custtab_5_3368792_208', 'custtab_7_3368792_208', 'custtab_2_3368792_208', 'customscript_esc_bundle_script']),
  },
  248167: {
  },
  132058: {
  },
  179378: {
  },
  477064: {
  },
  446730: {
  },
  4154: {
  },
  354076: {
  },
  341701: {
  },
  199464: {
    '1.00.4': new Set(['customsearch_ns1099vpr_main', 'customsearch_ns1099_yearli_nec', 'customsearch_ns1099misc_yearli_pre_2020']),
  },
  496890: {
  },
  286063: {
  },
  219484: {
  },
  244699: {
  },
  305592: {
  },
  414815: {
  },
  254701: {
  },
  392827: {
  },
  410184: {
  },
  395663: {
  },
  413123: {
  },
  218287: {
  },
  190350: {
  },
  281349: {
  },
  397992: {
  },
  248415: {
  },
  239173: {
  },
  423978: {
  },
  282505: {
    '2.0': new Set(['custcol_created_from', 'custcol_receipt_url', 'customscript728']),
  },
  281356: {
  },
  265658: {
  },
  373062: {
  },
  468610: {
  },
  341388: {
  },
  190323: {
    '1.0.5': new Set(['customlist6', 'customrecordcms_merchzonetwo', 'customrecordcms_html', 'customrecordcms_text', 'customrecordcms_merchzone', 'customrecordcms_image', 'customscriptcontenttypemanager']),
  },
  467597: {
  },
  323305: {
  },
  166020: {
  },
  210160: {
  },
  464363: {
  },
  239499: {
    '2.00.67': new Set(['customscript_vat_bundle_install']),
  },
  248562: {
  },
  395821: {
  },
  12610: {
    '2.01': new Set(['customrecord_oa_record_type_synch', 'customrecord_oa_project_rate_card', 'customrecord_oa_cost_center', 'customrole1015', 'customscript_oa_send_to_openair', 'customscript_oa_send_to_openair_2']),
  },
  250407: {
  },
  302960: {
  },
  363984: {
  },
  308846: {
  },
  251246: {
    '1.1.4': new Set(['custitem_ns_ib_badges', 'custitem_ef_badges', 'custitem_ns_ib_show_badges', 'customlist_ns_ib_svg_shapes', 'customlist_ns_ib_text_weights', 'customrecord_ns_ib_badges', 'customrecord_ef_item_badges', 'customrecord_ns_ib_shapes', 'custtab_260_t1533071_680', 'custtab_136_4469174_805', 'customscript_ns_sc_ext_bi_itembadges100', 'customscript_ns_ib_mass_update', 'customscript_ns_sc_sl_itembadges']),
  },
  344590: {
    '1.0.1': new Set(['custitem_ns_sc_page_printer_behavior', 'customlist_ns_sc_page_printer_behavior', 'custtab_260_t1533071_680', 'custtab_ns_sc_ext_page_printer', 'customscript_ns_sc_ext_bi_pageprinter100']),
  },
  311390: {
  },
  497478: {
  },
  354070: {
  },
  26846: {
  },
  490515: {
  },
  377979: {
    NO_VERSION: new Set(['customlist_po_acknowledgment_decision', 'customrecordhj_tc_pkgcontentslineitem', 'customrecordhj_tc_package_contents', 'customrecord_hj_tc_poack_record', 'customsearch_hj_test_list_view_search', 'custtab_297_t1125625_150', 'custtab_308_t1125625_393']),
  },
  251558: {
    '1.1.0': new Set(['customscript_ns_sc_ext_bi_prodcompa']),
  },
  286094: {
  },
  295131: {
  },
  62340: {
  },
  249263: {
    '1.1.0': new Set(['customlist_ns_cols_text_color', 'customlist_ns_cols_text_align', 'customrecord_cct_ns_columns', 'customscript_sc_columns_install']),
  },
  48476: {
  },
  249422: {
    '1.2.0': new Set(['customlist_ns_sc_ext_pg_textcolor', 'customlist_sc_ext_pg_text_align', 'customlist_ns_sc_ext_pg_imgalign', 'customlist_sc_ext_pg_img_align', 'customlist_sc_ext_pg_hover_animation', 'customlist_ns_sc_ext_pg_overlay', 'customlist_ns_sc_ext_pg_style', 'customlist_ns_sc_ext_ct_height', 'customlist_sc_ext_pg_carousel_ani_time', 'customrecord_ns_sc_ext_photogallery', 'customscript_ns_phcct_install']),
  },
  348011: {
  },
  143437: {
    '2.06.0': new Set(['custentity_11724_pay_bank_fees', 'custbody_document_date', 'custbody_str_regime_code', 'custbody_11187_pref_entity_bank', 'custbody_str_fr_department', 'custbody_11724_bank_fee', 'custbody_establishment_code', 'custbody_11724_pay_bank_fees', 'custbody_fl_fec_ecriturelib', 'customlist_2663_bank_fee_code', 'customlist_2663_billing_type', 'customlist_2663_bank_acct_type', 'customlist_2663_reference_amended_type', 'customlist_2663_payment_type', 'customlist_2663_output_file_encoding', 'customlist_fl_list_componentstatus', 'customlist_2663_entity_bank_type', 'customlist_2663_acct_type', 'customrecord_2663_entity_bank_details', 'customrecord_fl_setting_preferences', 'customrecord_fl_custom_tran_type_data', 'customrecord_str_fr_department', 'customrecord_fl_setup_component', 'customrecord_2663_payment_file_format', 'customrecord_str_fr_regimecode', 'customsearch_fl_fec_coa_check', 'customsearch_fl_ss_vendors_to_match', 'customsearch_fl_ss_unmatched_by_vendor', 'customsearch_fl_ss_unmatched_by_customer', 'customsearch_fl_ss_matched_by_vendor', 'customsearch_fl_ss_matched_by_customer', 'customsearch_fl_ss_customers_to_match', 'customsearch_fl_fec_not_val_trans', 'customsearch_fl_fec_not_val_tran_list', 'customsearch_fl_fec_val_date_check', 'customsearch_fl_fec_document_date_check', 'custtab_10_4533432_230', 'custtab_11_4533432_230', 'custtab_12_4533432_230', 'custtab_str_transaction_tab', 'custtab_9_4533432_230', 'customscript_fl_bi_installation', 'customscript_fl_cs_valid_transaction', 'customscript_fl_cs_ebp_fr', 'customscript_fl_cs_docdate_validation', 'customscript_fl_cs_due_date', 'customscript_fl_cs_str_transaction', 'customscript_fl_ss_ebp_uninstall', 'customscript_fl_ss_ebp_install', 'customscript_fl_ss_csr_imports', 'customscript_fl_sl_ps', 'customscript_fl_sl_is', 'customscript_fl_sl_is_reports', 'customscript_fl_sl_csr_link', 'customscript_fl_sl_cofa', 'customscript_fl_sl_is_templates', 'customscript_fl_ue_docdate_validation', 'customscript_fl_ue_valid_account', 'customscript_fl_ue_ebp_fr', 'customscript_fl_ue_valid_transaction', 'customscript_fl_ue_due_date', 'customscript_fl_ue_str_transaction', 'customscript_fl_ue_valid_acc_period', 'customscript_fl_ue_valid_tax_type', 'customscript_fl_ue_fec_ecriturelib', 'custcollectionfrancelocalization', 'custcollection_emea_localization', 'custcollection_electronic_payments_objects_translations']),
  },
  153470: {
  },
  245936: {
  },
  350138: {
    '2.1.1': new Set(['customlist_sc_blog_post_cct_card_qty', 'customrecord_sc_blog_term', 'customrecord_sc_blog_author', 'customrecord_sc_blog_post_category', 'customrecord_sc_blog_page_type_post', 'customrecord_sc_blog_cct_blog_card', 'customrecord_sc_blog_page_import', 'customrole_sc_blog_data_loader', 'customscript_ns_sc_ext_bi_blogadv', 'customscript_ns_sc_ss_rss_generator', 'customscript_ns_sc_sl_blog_post_searcher', 'customscript_ns_sc_sl_blog_url_prov', 'customscript_ns_sc_sl_blog_entity_loader', 'customscript_ns_sc_ue_blog_import']),
  },
  405648: {
  },
  286129: {
  },
  161223: {
  },
  500712: {
  },
  486462: {
  },
  359508: {
  },
  251769: {
    '1.1.4': new Set(['customscript_sc_infscroll_install']),
  },
  411095: {
  },
  445345: {
  },
  241677: {
    '1.0': new Set(['custentity_nc_support_case_allow_view', 'custentity_nc_support_is_def_sup_user', 'custentity_nc_support_case_allow_open', 'customscript_nc_support_case_caller_srv', 'customscript_nc_support_forms_server']),
  },
  412881: {
  },
  8443: {
  },
  33437: {
  },
  410870: {
  },
  380861: {
  },
  167235: {
  },
  167330: {
  },
  449406: {
  },
  296469: {
    '1.0.1': new Set(['customrole_nc_suiteanalytic_cnctr']),
  },
  387667: {
  },
  286092: {
  },
  250929: {
  },
  47196: {
    '4.02.9': new Set(['customlist_pgp_secret_hash_algo', 'customlist_ccp_gateway_operation_type', 'customrecord_ccp_gateway_operation_url', 'customrecord_ccp_gateway', 'customrecord_ccp_securepay', 'customrecord_ccp_form_page_template', 'customrecord_ccp_asiapay_config_rec', 'customrecord_ccp_asiapay_direct_config', 'customrecord_ccp_operation_post_template', 'customrecord_ccp_merchant_credentials', 'customrecord_ccp_gateway_operation', 'customrecord_ccp_gateway_add_cred', 'customrecord_ccp_custom_variable', 'customrecord_ccp_payu_config_rec', 'customscript_6788_ccp_eway_xml', 'customscript_9384_ccp_pay_u', 'customscript_4912_ccp_veritrans', 'customscript_6788_ccp_eway', 'customscript_ccp_securepay_fraudguard', 'customscript_5247_ccp_asiapay', 'customscript_ccp_securepay', 'customscript_7352_ccp_asiapay_external', 'customrole_ccp_gateway_admin', 'customscript_pgp_uuid_gen_rl', 'customscript_ccp_form_submitter_su']),
  },
  328209: {
    '2.1': new Set(['customlist_ns_ts_priority_list', 'customlist_ns_ts_base_status_list', 'customlist_ns_ps_action_item_status', 'customlist_ns_ts_issue_type_list', 'customlist_ns_ibe_engagement_types', 'customlist_ns_pm_vertical', 'customlist_ns_one_req_qualification', 'customlist_ns_ts_deployed_to_list', 'customlist_ns_ps_process_list', 'customlist_ns_ps_action_item_priority', 'customlist_ns_ts_test_phase_list', 'customlist_ns_ts_fix_type_list', 'customlist_ns_ts_bus_process_list', 'customrecord_ns_ts_issue_statuses', 'customrecord_ns_ps_meeting_notes', 'customrecord_ns_ts_test_issue', 'customrecord_ns_ps_mfg_action_items', 'customrecord_ns_ibe_requirement', 'customrecord_ns_imp_process', 'customrecord_ns_imp_req_module', 'customrecord_ns_req_bug_resolut_statuses', 'customrecord_ns_ibe_req_types', 'customrecord_ns_ibe_skill_type', 'customrecord_ns_ibe_req_channel_or_area', 'customrecord_ns_req_bug_severities', 'customrecord_ns_ibe_req_plan_statuses', 'customrecord_ns_ibe_project', 'customrecord_ns_ibe_req_categories', 'customrecord_ns_ibe_bug_statuses', 'customrecord_ns_ibe_req_statuses', 'customrecord_ns_ibe_gap_types', 'customrecord_ns_ibe_project_statuses', 'customsearch_ns_greg_bohus_ai', 'customsearch_ns_ps_action_item_view_2__2', 'customsearch_ns_ps_action_item_view_3', 'customsearch_ns_ps_action_item_view_3_2', 'customsearch_ns_ps_action_item_view_3__2', 'customsearch_ns_test_issue_default_vie_2', 'customsearch_ns_test_issue_default_view', 'customworkflow_nsps_nsone_testissues', 'customworkflow_ns_pmo_ai_cc_email']),
  },
  250724: {
    '1.2.0': new Set(['customlist_ns_sc_ext_fp_btnstyle', 'customrecordcct_netsuite_featuredproduct', 'customscript_sc_fpcct_install', 'customscript_ns_sc_ss_featured_product']),
  },
  284929: {
  },
  223212: {
  },
  395819: {
  },
  297909: {
  },
  373094: {
  },
  244690: {
  },
  57060: {
  },
  303913: {
    '1.01.1': new Set(['custbody_str_nexuscountry', 'custtab_str_entity_tab', 'custtab_str_item_tab', 'custtab_str_transaction_tab', 'customscript_japac_bundle_installation']),
  },
  122422: {
  },
  284927: {
  },
  405710: {
  },
  203059: {
    '7.02.7': new Set(['custentity_sas_emp_limit_so', 'custentity_sas_delegation_delegateto', 'custentity_sas_emp_approver_vb', 'custentity_sas_delegation_startdate', 'custentity_sas_emp_limit_vb', 'custentity_sas_emp_aprvlimit_so', 'custentity_sas_emp_approver', 'custentity_sas_emp_approver_so', 'custentity_sas_emp_aprvlimit_vb', 'custentity_sas_delegation_enddate', 'custentity_sas_delegation_isdelegated', 'custentity_sas_emp_recordname', 'custentity_sas_emp_limit', 'custentity_sas_emp_aprvlimit', 'custbody_sas_journal_total', 'customlist_sas_tol_reapproval_type', 'customlist_sas_transaction_state', 'customlist_sas_transaction_types', 'customlist_sas_approvalmatrix_apptype', 'customlist_sas_approval_action', 'customrecord_sas_department_approver', 'customrecord_sas_approvalmatrix', 'customrecord_sas_draft_approval', 'customrecord_sas_approvalrule', 'customrecord_sas_approval_history', 'customrecord_sas_ss_exp_apprule', 'customrecord_sas_approval_logs', 'customrecord_sas_mirror_approval', 'customrecord_sas_ss_exp_mapping', 'customrecord_sas_approval_preferences', 'customrecord_sas_mapping_setup', 'customrecord_sas_email_templates', 'custtmpl_sas_vendorbill_pdf_template', 'customscript_sas_pl_ea_processing', 'customsearch_sas_ss_approvalrule_list', 'customsearch_sas_draft_approval_list', 'customsearch_sas_ss_email_applogs_delete', 'customsearch_sas_ss_email_approval_logs', 'customsearch_sas_ss_vendorbill_list', 'customsearch_sas_ss_docline_projmngr', 'customsearch_sas_ss_po_list', 'customsearch_sas_ss_er_list', 'custtab_sas_entity_approval_delegation', 'custtab_sas_entity_approval', 'customscript_sas_bi_setup', 'customscript_sas_cs_employee', 'customscript_sas_cs_department_approver', 'customscript_sas_mirror_approval_cleanup', 'customscript_sas_draft_approval_cleanup', 'customscript_sas_app_rule_fix_gen_limit', 'customscript_sas_approval_logs_cleanup', 'customscript_sas_recreate_mirror', 'customscript_sas_approval_rule_eval', 'customscript_sas_po_approval_list', 'customscript_sas_po_reminders', 'customscript_sas_rs_trigger_reapproval', 'customscript_sas_su_approval_list', 'customscript_sas_su_enterrejectreason', 'customscript_sas_su_appr_rule_assistant', 'customscript_sas_su_supportedrectypes', 'customscript_sas_su_dictionary_loader', 'customscript_sas_su_data_service', 'customscript_sas_su_approval_preference', 'customscript_sas_su_approvalrule_list', 'customscript_sas_su_approvalrule', 'customscript_sas_su_emailapplogs_list', 'customscript_sas_su_approval_delegation', 'customscript_sas_su_ea_processing', 'customscript_sas_ue_journal', 'customscript_sas_ue_approvalrule', 'customscript_sas_ue_approvallog', 'customscript_sas_ue_supportedrectypes', 'customscript_sas_ue_mapsetup', 'customscript_sas_ue_employee', 'customscript_sas_ue_context_checker', 'customscript_sas_ue_mirror_approval', 'customscript_sas_ue_department_approver', 'customscript_sas_ws_appmatrix_setprevapp', 'customscript_sas_ws_appmatr_hasmoremapp', 'customscript_sas_ws_appmatrix_getnxtrec', 'customscript_sas_ws_set_total_amount', 'customscript_sas_ws_appmatrix_vstotalamt', 'customscript_sas_ws_appmatr_getrejreason', 'customscript_sas_ws_log_action', 'customscript_sas_ws_appmatrix_getnxtapps', 'customscript_sas_ws_get_mapping_setup', 'customscript_sas_ws_cangenlimit_app_tran', 'customscript_sas_ws_get_resub_submitter', 'customscript_sas_ws_bill_validation', 'customscript_sas_ws_send_notification', 'customscript_sas_ws_get_record_date', 'customscript_sas_ws_appmatrix_getnxtapp', 'customscript_sas_ws_set_approvalemail_id', 'customscript_sas_ws_lock_transaction', 'customscript_sas_ws_app_hie_vs_totalamt', 'customscript_sas_ws_appmatrix_hasactvmem', 'customscript_sas_ws_update_reference_rec', 'customscript_sas_ws_isuserdelegateapp', 'customscript_sas_ws_has_more_approver', 'customscript_sas_ws_get_next_approver', 'customscript_sas_ws_canemplimit_app_tran', 'customscript_sas_ws_appmatrix_hasmoreapp', 'customscript_sas_ws_implement_app_log', 'customscript_sas_ws_validate_approver', 'custcollection_suiteapprovals', 'customworkflow_sas_ah_lockrecord', 'customworkflow_sas_approval_workflow']),
  },
  251806: {
    '1.0.5': new Set(['custitem_ns_sc_grid_order_stock_notif', 'custitem_ns_sc_grid_order_show_stock', 'custitem_ns_sc_grid_order_behavior', 'customlist_ns_sc_grid_order_behavior', 'custtab_260_t1533071_680', 'custtab_ns_sc_grid_order', 'customscript_ns_sc_ext_bi_gridorder']),
  },
  385249: {
  },
  486952: {
  },
  491023: {
  },
  388888: {
  },
  422358: {
  },
  276692: {
    '1.1': new Set(['customsearch_atlas_address_change_rpt', 'customsearch_atlas_cust_status_chnge_rpt', 'customsearch_atlas_it_deleted_records', 'customsearch_atlas_scrpt_chng_rem', 'customsearch_atlas_file_chng_rem', 'customsearch_atlas_global_employee', 'customsearch_atlas_item_price_change_rpt', 'customsearch_atlas_sales_item_audit_rpt', 'customsearch_atlas_sales_descrb_chng_rpt', 'customsearch_atlas_prch_item_chng_rpt', 'customsearch_atlas_webbrwsr_stat_rpt', 'customsearch_atlas_loginalert_rpt', 'customsearch_atlas_login_grph', 'customsearch_atlas_login_failure_rem', 'customsearch_atlas_saved_search_rpt', 'customsearch_atlas_sys_srvr_scrpt_rpt', 'customsearch_atlas_transaction_audit_rpt', 'customsearch_atlas_sysnote_custrec_rpt', 'customsearch_atlas_admin_sysnts_cnfg_rpt', 'customsearch_atlas_systemnotes_rpt', 'customsearch_atlas_acc_period_audit_rpt', 'customsearch_atlas_poratechange', 'customsearch_atlas_trns_apprv_alert', 'customsearch_atlas_salesdetail_query_rpt', 'customsearch_atlas_returnbyemployee_rpt', 'customsearch_atlas_trans_missing_tax_rem', 'customsearch_atlas_usernote_log_rpt']),
  },
  29321: {
  },
  369166: {
  },
  219323: {
  },
  240841: {
    '2.00.0.a': new Set(['custentity_naw_trans_need_approval', 'customlist_vb_memo_list', 'customrecord_wd_naw_workflow_excep', 'customsearch_vb_standalone_rule', 'customsearch_vb_po_qty_rule', 'customsearch_vb_po_partial_rcpt', 'customsearch_vb_po_partial_amt', 'customsearch_vb_po_amount_rule', 'customsearch_3way_vb_amt_vendortolerance', 'customsearch_3way_vb_amt_subs_tolerance', 'customsearch_3way_vb_amt_item_tolerance', 'customsearch_3way_vb_ir_qty_item_diff', 'customsearch_3way_vb_ir_qty_subs_diff', 'customsearch_3way_vb_ir_qty_vendor_diff', 'customsearch_3way_vb_item_recpt_qty_tol', 'customsearch_3way_vb_ir_qty_subs_tol', 'customsearch_3way_vb_amt_lessthan_po', 'customsearch_3way_vb_itemreceipt_check', 'customsearch_3way_vb_location_check', 'customsearch_3way_vb_qty_lessthan_po', 'customsearch_3way_vb_term_check', 'customsearch_3way_vb_ir_qty_vendor_tol', 'customsearch_3way_vb_po_item_qty_diff', 'customsearch_3way_vb_po_subs_qty_diff', 'customsearch_3way_vb_po_vendor_qty_diff', 'customsearch_3way_vb_qty_vendor_tol', 'customsearch_3way_vb_qty_item_tolerance', 'customsearch_3way_vb_qty_subs_tolerance', 'customsearch_iaw_certain_customers', 'customscript_nwb_bi_setup', 'customscript_wd_naw_su_showexc', 'customscript_naw_ue_delete_exception', 'customscript_naw_ws_get_user_pref', 'customscript_naw_ws_delete_exceptionrec', 'customscript_naw_ws_create_exceptionrec', 'customscript_naw_ws_check_feature', 'customscript_iaw_ws_iscustomerfirstinv', 'customscript_3way_ws_checksubsmatchfield', 'customscript_ws_showexceptions', 'customworkflow_vb_workflow', 'customworkflow_naw_iaw', 'customworkflow_3way_match_vb_approval_pr']),
  },
  312584: {
    '1.02.0': new Set(['custbody_so_bol_third_party_account', 'custbody_bol_total_item_weight', 'custbody_bol_printed', 'custbody_bol_fulfillment_weight_unit', 'custbody_bol_from_address', 'custbody_bol_accessorials', 'custbody_so_bol_freight_terms', 'custbody_bol_fullfilment_weight', 'custbody_if_bol_notes', 'custbody_if_bol_pro_number', 'custbody_so_bol_third_party_add', 'custbody_if_bol_total_weight_grams', 'custbody_bol_delivery_instructions', 'custcol_if_bol_col_type', 'custcol_if_bol_col_nmfc_no', 'custcol_bol_weight_units', 'custcol_bol_weight_units_show', 'custcol_if_bol_col_weight', 'custcol_if_bol_col_weight_item', 'custcol_bol_item_weight_script', 'custcol_bol_qty_handling_unit', 'custcol_if_bol_col_fak_class', 'customlist_bol_class', 'customlist_bol_accessorials', 'customlist_bol_nmfc_list', 'customlist_weight_units', 'customrecord_custbol_standalone_rec_type', 'customrecord_bol_preferences', 'customrecord_custbol_master_rec_type', 'custtmpl_bol_master_template', 'custtmpl_bol_standalone_template', 'customsearch_sch_script_if_update', 'customscript_bol_search_client', 'customscript_bol_itemfulfillment_cs', 'customscript_bol_cs_preferences', 'customscript_bol_ss_itemfulfillments', 'customscript_bol_custom_template_bol', 'customscript_bol_template_select', 'customscript_bol_redirect_bol_pref', 'customscript_bol_itemfulfillment_sl', 'customscript_bol_print_itemfulfillments', 'customscript_bol_sl_searchpage', 'customscript_bol_print_preferences', 'customscript_bol_itemfulfillment_ue', 'custcollection_bol_tc_translations']),
  },
  430400: {
  },
  308820: {
  },
  134181: {
  },
  380671: {
    '2.7': new Set(['custbody_dokka_url', 'custbody_dokka_user', 'customrole_dokka_integration_role', 'customscript_dokka_bundle_installer', 'customscript_dokka_rest_connector']),
  },
  230099: {
  },
  283976: {
  },
  230734: {
  },
  41420: {
  },
  45178: {
  },
  312859: {
    '3.4.1': new Set(['customscript_threadstheme_install_script']),
  },
  220014: {
  },
  56125: {
  },
  435663: {
  },
  297121: {
  },
  222420: {
    '1.02.2': new Set(['customlist_edp_update_status', 'customlist_edp_update_type', 'customrecord_edp_price_update', 'customrecord_edp_error_logs', 'customrecord_edp_item_category', 'customrecord_edp_price_update_sys_notes', 'customrecord_edp_price_detail_update', 'customsearch_edp_pricedetailupdate', 'customsearch_edp_error_messages_summary', 'customsearch_edp_error_messages_defaultv', 'customscript_edp_cs_pu_validations', 'customscript_edp_cs_pud_validation', 'customscript_edp_mr_customerpriceupdate', 'customscript_edp_mr_itemcategory_update', 'customscript_edp_mr_itempriceupdate', 'customscript_edp_mr_customergroup_update', 'customscript_edp_ue_ic_validation', 'customscript_edp_ue_price_detail_update', 'customscript_edp_ue_customrecord_locking', 'customscript_edp_ue_pu_validations', 'customscript_edp_ue_itm_ui_control']),
  },
  286061: {
  },
  490204: {
  },
  375099: {
  },
  270800: {
    '4.00.0': new Set(['custentity_sta_einvoicing_payer_operator', 'custentity_sta_einvoice_factoring_custno', 'custentity_sta_einvoice_language', 'custentity_sta_einv_businessid', 'custentity_sta_factoring_inv_not_to_cust', 'custentity_sta_ep_charge_bearer', 'custentity_sta_use_en16931_2017_a1_2019', 'custentity_sta_einvoicing_delivery_metho', 'custentity_sta_einvoice_routing_channel', 'custentity_sta_einvoicing_payer_ovt', 'custentity_sta_einv_ent_vat_excemption', 'custentity_sta_einvoice_factoring', 'custrecord_sta_select_vat_category', 'custrecord_sta_einvoicing_payee_iban', 'custrecord_company_bic', 'custrecord_sta_einvoicing_payee_vat', 'custrecord_current_factoring_batch_no', 'custrecord_sta_swe_mandatory_class', 'custrecord_sta_vat_type_code', 'custrecord_sta_acc_basecurr', 'custrecord_company_bic3', 'custrecord_sta_einvoicing_interest', 'custrecord_sta_einvoicing_payee_busin_id', 'custrecord_invoice_company_email', 'custrecord_sta_vatexempt_code', 'custrecord_sta_einvoicing_payee_iban2', 'custrecord_einvoice_factoring_msg', 'custrecord_sta_einvoice_factoring_id', 'custrecord_sta_swe_mandatory_dept', 'custrecord_sta_vatex_reason', 'custrecord_company_bic2', 'custrecord_sta_einvoicing_payee_edi', 'custrecord_sta_einvoicing_payee_iban3', 'custrecord_invoice_company_phone', 'custbody_payee_bic', 'custbody_sta_fin_taxrate3', 'custbody_sta_einvoicing_payee_zip', 'custbody_sta_einvoice_factoring', 'custbody_sta_einvoicing_inv_send_metho', 'custbody_sta_einvoicing_cust_id', 'custbody_sta_nord_yourref', 'custbody_sta_einvoicing_payee_bban_bic', 'custbody_sta_vatex_code4', 'custbody_invoice_so_number', 'custbody_sta_einvoicing_payer_ovt', 'custbody_sta_credit_duedate', 'custbody_sta_einvoicing_payee_iban3', 'custbody_payee_bic2', 'custbody_sta_nord_ourref', 'custbody_sta_vat_category4', 'custbody_sta_vat_exemption_text', 'custbody_sta_fin_subtotal4', 'custbody_sta_nor_reg_codes', 'custbody_invoice_company_phone', 'custbody_sta_einvoicing_payee_edi', 'custbody_sta_einvoicing_payee_name', 'custbody_sta_einvoicing_payee_city', 'custbody_sta_text_to_invoice1', 'custbody_custcontact', 'custbody_credited_invoicenumber', 'custbody_sta_loc_no_refno', 'custbody_sta_fin_vat_base_currency', 'custbody_sta_einvoicing_payee_vat', 'custbody_sta_deliverydate', 'custbody_sta_einvoicing_interest', 'custbody_sta_fin_subtotal3', 'custbody_sta_fin_subtotal1', 'custbody_sta_einvoicing_payee_address2', 'custbody_sta_fin_taxtotal_amount_base', 'custbody_sta_vatex_code1', 'custbody_sta_vatex_code3', 'custbody_sta_vat_category1', 'custbody_sta_vat_category2', 'custbody_sta_text_to_invoice2', 'custbody_sta_einvoicing_send_confirmed', 'custbody_payee_bic3', 'custbody_sta_einvoicing_payee_bban', 'custbody_sta_nord_rctext', 'custbody_sta_fin_taxrate1', 'custbody_sta_einvoicing_payer_operator', 'custbody_sta_einvoice_factoring_custno', 'custbody_sta_einvoice_factoring_batch', 'custbody_custcontact_phone', 'custbody_sta_fin_taxrate2', 'custbody_sta_fin_taxamount4', 'custbody_sta_fin_taxamount3', 'custbody_sta_fin_taxamount2', 'custbody_sta_fin_taxamount1', 'custbody_sta_fin_subtotal2', 'custbody_sta_einvoicing_payee_iban', 'custbody_invoice_company_email', 'custbody_sta_einvoice_routing_channel', 'custbody_sta_factoring_inv_not_to_cust', 'custbody_sta_fin_total4', 'custbody_sta_fin_total2', 'custbody_sta_fin_total1', 'custbody_sta_use_en16931_2017_a1_2019', 'custbody_sta_vatex_code2', 'custbody_sta_customer_order_reference', 'custbody_sta_einvoicing_payee_iban2', 'custbody_sta_einvoice_factoring_id', 'custbody_sta_einvoice_factoring_msg', 'custbody_sta_nord_trandate', 'custbody_sta_einvoicing_payee_address', 'custbody_sta_einvoicing_ready_tosend', 'custbody_sta_einvoice_language', 'custbody_sta_fin_total3', 'custbody_sta_fin_taxrate4', 'custbody_seller_phone', 'custbody_sta_vat_category3', 'custbody_sta_einvoicing_payee_country', 'custbody_sta_text_to_invoice3', 'custbody_fin_invoicereferencenumber', 'custbody_sta_einvoicing_payee_busin_id', 'custcol_so_rowposition', 'custcol_so_deliverynumber', 'custcol_sta_discount_percentage_1', 'custcol_sta_vatex_reason', 'custcol_so_displayname', 'custcol_sta_item_ean', 'custcol_so_deliverydate', 'custcol_sta_discount_percentage_2', 'custcol_sta_excl_electronic_invoice', 'custcol_sta_vat_type_description', 'custcol_sta_vat_type_code', 'custcol_sta_vatex_code', 'custcol_sta_discount_amnt_1', 'custcol_sta_discount_amnt_2', 'customlist_einvoice_visualize_language', 'customlist_sta_loc_lm_status', 'customlist_sta_ep_charge_bearer', 'customlist_sta_fin_invref_base', 'customlist_einvoice_routing_channel', 'customlist_sta_nor_reg_codes', 'customlist_sta_einvoicing_send_methods', 'customrecord_sta_gl', 'customrecord_sta_loc_license_mgt', 'customrecord_sta_suiteapp', 'customrecord_sta_paytemp', 'customrecord_sta_fin_loc_settings', 'customrecord_sta_loc_lisence_customer', 'customrecord_sta_vatex_codes', 'customrecord_sta_vat_category_codes', 'custform_2_t1440050_248', 'custtmpl_sta_nordic_inv_2', 'custform_sta_ss_creditmemo', 'custform_sta_ss_salesorder', 'custform_sta_std_invoice', 'custform_sta_ss_itemfulfillment', 'customsearch_active_subsidiaries', 'customsearch_sta_sie_search_transactions', 'customsearch_check_invoice_is_ok_to_send', 'custtab_294_t1463057_274', 'custtab_293_t1463057_274', 'custtab_9_4533432_230', 'customscript_license_mgr_bundle_install', 'customscript_sta_cl_mandatory_dimensions', 'customscript_sta_mandatory_dimensions2', 'customscript_sta_mandatory_dimensions', 'customscript_sta_refresh_bundle_licenses', 'customscript_sta_ue_nord_tran_bfrsubmit', 'customscript_sta_fin_vat_declaration_v2', 'customscript_sta_ecsalestaxc_v2', 'customscript_sta_fin_create_refrenc_numb', 'customscript_sta_ecsalestaxc', 'customscript_increase_factoring_batch_no', 'customscript_sta_fi_incfactbatchnum_ws', 'customscript_sta_inv2pdf_ws', 'customworkflow_prepare_invoices_einvoice', 'customworkflow_sta_invoicerefnum', 'customworkflow_sta_factoring_batchno', 'customworkflow_sta_einvoice_defaults_v2', 'customworkflow_sta_exsalestax']),
  },
  444573: {
  },
  14927: {
  },
  112449: {
  },
  107016: {
  },
  58023: {
    '1.02.0': new Set(['customrecord_campaign_events', 'customscript_campaign_assistant_bundle', 'customscript_ca_cs_campaignassistant', 'customscript_ca_cs_infopage', 'customscript_ca_ss_savedsearch', 'customscript_ca_ss_campaigntemplate', 'customscript_ca_ss_file', 'customscript_ca_ss_campaigntargetgroup', 'customscript_ca_ss_campaignassistant']),
  },
  272756: {
  },
  439833: {
  },
  356248: {
  },
  260430: {
  },
  331180: {
    '1.00.0': new Set(['custentity_prm_risk_level', 'custentity_prm_risk_desc', 'customlist_prm_risk_level_list', 'customsearch_prm_setup_projects', 'customscript_prm_bundle_install', 'customscript_prm_mr_projects', 'custcollection_prm_setup_strings']),
  },
  269695: {
  },
  286064: {
  },
  36477: {
  },
  49247: {
  },
  210158: {
  },
  17653: {
  },
  422673: {
  },
  346642: {
  },
  163135: {
  },
  324055: {
    '1.5': new Set(['custitem_srr_revenue_account', 'custbody_srr_related_record', 'custbody_srr_je_record', 'custcol_srr_start_date', 'custcol_srr_related_item', 'custcol_srr_revenue_account', 'custcol_srr_source_item_line', 'custcol_srr_end_date', 'customlist_srr_trans_field_types', 'customrecord_srr_settings', 'customrecord_srr_mapping_table', 'customscript_srr_ss_license_bndl_install', 'customscript_srr_cs_trans_forms', 'customscript_srr_ss_license_sched', 'customscript_srr_ss_proxy', 'customscript_srr_ss_proxy_suitescript1', 'customscript_srr_ss_trans_forms_admin', 'customscript_srr_ss_settings']),
  },
  192046: {
  },
  249983: {
    '1.1.6': new Set(['customscript_sc_ext_bi_shippingbar']),
  },
  254705: {
  },
  418641: {
  },
  250920: {
    '1.00.3': new Set(['customsearch_ns1099_track1099', 'customsearch_ns1099_track1099_nec']),
  },
  77210: {
  },
  250891: {
    '1.1.6': new Set(['customrecord_ef_bs_suscription', 'customrecord_ns_sc_ext_sn_subscription', 'customrecord_ef_bs_helper', 'customrecord_ef_bs_config', 'customsearch_stockn_sentmail', 'customsearch_stockn_waitlist', 'customsearch_stockn_top', 'customsearch_stockn_newsletter', 'customscript_ns_sc_ext_bi_stocknotifs', 'customscript_ns_sc_ext_mr_sn_emails', 'customscript_ef_bs_schedule', 'customscript_ns_sc_ext_ue_sync', 'customscript_bis_transactional']),
  },
  4159: {
  },
  270801: {
    '4.00.0': new Set(['custentity_sta_einvoice_factoring', 'custentity_sta_ep_charge_bearer', 'custentity_sta_einvoice_language', 'custentity_sta_einvoicing_payer_operator', 'custentity_sta_einv_businessid', 'custentity_sta_einvoicing_payer_ovt', 'custentity_sta_einvoicing_delivery_metho', 'custentity_sta_einvoice_factoring_custno', 'custentity_sta_factoring_inv_not_to_cust', 'custentity_sta_einvoice_routing_channel', 'custentity_sta_einv_ent_vat_excemption', 'custentity_sta_use_en16931_2017_a1_2019', 'custitem_sta_fin_vat_nature', 'custrecord_sta_vat_type_code', 'custrecord_current_factoring_batch_no', 'custrecord_sta_giro_bic', 'custrecord_sta_select_vat_category', 'custrecord_sta_vatexempt_code', 'custrecord_sta_giro', 'custrecord_sta_swe_mandatory_class', 'custrecord_sta_swe_sru_code', 'custrecord_sta_placeofdomicile', 'custrecord_sta_acc_basecurr', 'custrecord_sta_einvoicing_payee_edi', 'custrecord_sta_einvoicing_payee_iban2', 'custrecord_sta_einvoicing_interest', 'custrecord_sta_vatex_reason', 'custrecord_company_bic3', 'custrecord_invoice_company_email', 'custrecord_sta_einvoice_factoring_id', 'custrecord_invoice_company_phone', 'custrecord_sta_einvoicing_payee_busin_id', 'custrecord_einvoice_factoring_msg', 'custrecord_sta_swe_mandatory_dept', 'custrecord_company_bic', 'custrecord_company_bic2', 'custrecord_sta_einvoicing_payee_iban', 'custrecord_sta_einvoicing_payee_iban3', 'custrecord_sta_einvoicing_payee_vat', 'custbody_sta_einvoicing_payee_edi', 'custbody_sta_einvoicing_payee_name', 'custbody_sta_einvoicing_payee_address2', 'custbody_sta_einvoicing_payee_address', 'custbody_sta_einvoicing_payee_iban2', 'custbody_payee_bic2', 'custbody_sta_einvoicing_payee_giro', 'custbody_payee_bic', 'custbody_sta_fin_taxrate2', 'custbody_sta_fin_subtotal4', 'custbody_sta_fin_subtotal2', 'custbody_sta_swe_reg_codes', 'custbody_sta_fin_taxrate4', 'custbody_sta_einvoicing_payee_zip', 'custbody_sta_text_to_invoice3', 'custbody_credited_invoicenumber', 'custbody_sta_nord_yourref', 'custbody_sta_vatex_code2', 'custbody_sta_vatex_code4', 'custbody_sta_vat_exemption_text', 'custbody_sta_vat_category3', 'custbody_sta_fin_total2', 'custbody_sta_fin_total1', 'custbody_sta_vat_category4', 'custbody_sta_einvoicing_payee_country', 'custbody_sta_einvoicing_inv_send_metho', 'custbody_sta_einvoice_factoring_id', 'custbody_sta_einvoice_factoring_msg', 'custbody_sta_einvoice_language', 'custbody_sta_einvoicing_payee_bban', 'custbody_sta_use_en16931_2017_a1_2019', 'custbody_sta_vatex_code3', 'custbody_sta_einvoicing_payee_giro_bic', 'custbody_sta_fin_total3', 'custbody_custcontact', 'custbody_sta_einvoicing_payee_iban', 'custbody_sta_customer_order_reference', 'custbody_sta_einvoice_routing_channel', 'custbody_sta_einvoice_factoring_custno', 'custbody_sta_fin_vat_base_currency', 'custbody_sta_vatex_code1', 'custbody_sta_fin_subtotal3', 'custbody_sta_fin_subtotal1', 'custbody_sta_einvoicing_payee_bban_bic', 'custbody_sta_einvoicing_payee_vat', 'custbody_sta_vat_category1', 'custbody_sta_einvoicing_ready_tosend', 'custbody_sta_einvoicing_send_confirmed', 'custbody_custcontact_phone', 'custbody_sta_credit_duedate', 'custbody_sta_fin_taxtotal_amount_base', 'custbody_sta_nord_rctext', 'custbody_sta_einvoicing_payer_ovt', 'custbody_sta_einvoicing_payee_city', 'custbody_sta_text_to_invoice2', 'custbody_sta_einvoicing_interest', 'custbody_sta_fin_total4', 'custbody_sta_loc_no_refno', 'custbody_sta_nord_trandate', 'custbody_sta_einvoicing_payee_iban3', 'custbody_sta_einvoicing_cust_id', 'custbody_sta_factoring_inv_not_to_cust', 'custbody_sta_nord_ourref', 'custbody_sta_fin_taxrate3', 'custbody_sta_fin_taxamount2', 'custbody_seller_phone', 'custbody_sta_fin_taxrate1', 'custbody_invoice_so_number', 'custbody_sta_einvoicing_payer_operator', 'custbody_sta_einvoice_factoring_batch', 'custbody_sta_einvoicing_payee_busin_id', 'custbody_sta_text_to_invoice1', 'custbody_sta_vat_category2', 'custbody_invoice_company_phone', 'custbody_invoice_company_email', 'custbody_sta_fin_taxamount4', 'custbody_sta_fin_taxamount3', 'custbody_sta_fin_taxamount1', 'custbody_sta_einvoice_factoring', 'custbody_payee_bic3', 'custbody_sta_deliverydate', 'custbody_fin_invoicereferencenumber', 'custcol_so_deliverydate', 'custcol_sta_item_ean', 'custcol_sta_discount_percentage_2', 'custcol_sta_vatex_reason', 'custcol_sta_vatex_code', 'custcol_sta_discount_percentage_1', 'custcol_sta_excl_electronic_invoice', 'custcol_sta_vat_type_description', 'custcol_sta_discount_amnt_1', 'custcol_sta_vat_type_code', 'custcol_so_displayname', 'custcol_sta_discount_amnt_2', 'custcol_so_rowposition', 'custcol_so_deliverynumber', 'customlist_sta_fin_invref_base', 'customlist_sta_einvoicing_send_methods', 'customlist_sta_ep_charge_bearer', 'customlist_sta_swe_reg_codes', 'customlist_sta_loc_lm_status', 'customlist_item_vat_typeof_nature', 'customlist_einvoice_routing_channel', 'customlist_einvoice_visualize_language', 'customlist_sta_sie_type', 'customrecord_sta_vatex_codes', 'customrecord_sta_paytemp', 'customrecord_sta_vat_category_codes', 'customrecord_sta_loc_license_mgt', 'customrecord_sta_fin_loc_settings', 'customrecord_sta_gl', 'customrecord_sta_suiteapp', 'customrecord_sta_loc_lisence_customer', 'custform_2_t1440050_248', 'custtmpl_sta_nordic_inv_2', 'custform_sta_ss_creditmemo', 'custform_sta_ss_salesorder', 'custform_sta_std_invoice', 'custform_sta_ss_itemfulfillment', 'customrole_sta_nsi', 'customsearch_active_subsidiaries', 'customsearch_sta_sie_pl', 'customsearch_sta_sie_search_ib', 'customsearch_sta_sie_search_psaldo', 'customsearch_sta_sie_search_res', 'customsearch_sta_sie_search_transactions', 'customsearch_check_invoice_is_ok_to_send', 'custtab_294_t1463057_274', 'custtab_293_t1463057_274', 'custtab_9_4533432_230', 'customscript_license_mgr_bundle_install', 'customscript_sta_cl_mandatory_dimensions', 'customscript_sta_mandatory_dimensions', 'customscript_sta_mandatory_dimensions2', 'customscript_sta_nor_mr_sie_file_export', 'customscript_sta_refresh_bundle_licenses', 'customscript_sta_nor_sl_sie_file_export', 'customscript_sta_ue_nord_tran_bfrsubmit', 'customscript_sta_inv2pdf_ws', 'customscript_increase_factoring_batch_no', 'customscript_sta_ecsalestaxc', 'customscript_sta_fi_incfactbatchnum_ws', 'customscript_sta_ecsalestaxc_v2', 'customscript_sta_fin_vat_declaration_v2', 'customscript_sta_fin_create_refrenc_numb', 'customworkflow_sta_invoicerefnum', 'customworkflow_sta_exsalestax', 'customworkflow_sta_einvoice_defaults_v2', 'customworkflow_sta_factoring_batchno', 'customworkflow_prepare_invoices_einvoice']),
  },
  312814: {
    '3.1.0': new Set(['customscript_bridgetheme_install_script']),
  },
  112469: {
    '1.07.2': new Set(['customlist_ed_config_list', 'customrecord_ed_preference', 'customrecord_ob_org_tree', 'customsearch_ed_default', 'customsearch_ed_employee_directory', 'customscript_ed_bundle_installation', 'customscript_ed_emp_dir_portlet', 'customscript_ob_org_browser_tree_ss', 'customscript_ob_org_browser_su', 'customscript_ob_org_browser_backend_su', 'customscript_ed_preferences_backend_su', 'customscript_ed_emp_dir_su', 'customscript_ed_preferences_su', 'customscript_ed_emp_search_backend_su', 'customscript_ob_employee_ue']),
  },
  168463: {
  },
  455185: {
  },
  364000: {
  },
  312817: {
    '3.5.0': new Set(['customscript_manortheme_install_script']),
  },
  314888: {
  },
  334874: {
    '1.8.2': new Set(['custrecord_nc_adv_inv_default_bin', 'custbody_nc_longsn_tracknum', 'custbody_nc_body_sn_link', 'custcol_nc_adv_ic_show_substitute_itm', 'custcol_nc_body_sn_link', 'customlist_nc_adv_inventory_if_status', 'customrecord_nc_adv_inventory_settings', 'customrecord_nc_adv_inventory_log', 'customrecord_nc_inv_count_file_upload', 'customrecord_nc_batch_assembly_builds', 'customrecord_nc_sn_long_text', 'customrecord_nc_adv_inv_snh_add_lists', 'customsearch_nc_bab_batch_abs_comp_view', 'customsearch_nc_inv_count_actual_qty_r', 'customsearch_nc_inv_count_snapshot_qty_r', 'customscript_nc_adv_inv_bundle_install', 'customscript_nc_snh_cs_sn_history', 'customscript_nc_bomi_form_cs', 'customscript_nc_adv_inv_form_cs', 'customscript_nc_adv_inv_long_sn_input_cs', 'customscript_nc_adv_inv_license_gen_scs', 'customscript_nc_bomi_form_ss', 'customscript_nc_adv_inv_handler_ss', 'customscript_nc_adv_inv_inventory_report', 'customscript_nc_adv_inv_variance_report', 'customscript_nc_adv_inv_long_sn_input_ss', 'customscript_nc_snh_ss_sn_history', 'customscript_nc_adv_inv_form_csreg_ss', 'customscript_nc_adv_inv_form_ss']),
  },
  237702: {
    '2.00.46': new Set(['custentity_ste_taxgroups', 'custentity_ste_taxcodes', 'custentity_ste_taxagencysrcnexus', 'custentity_ste_taxregnumres', 'custentity_ste_vendor_stecode', 'custentity_ste_entity_nexuses', 'custitem_ste_taxschedule_coachingtext', 'custitem_ste_taxschedule', 'custitem_ste_item_taxitem_type', 'custitem_ste_oss_taxschedule', 'custrecord_ste_taxcode_rate_value', 'custrecord_ste_taxcode_threshold_type', 'custrecord_ste_taxcode_availableon', 'custrecord_ste_taxcode_stecode', 'custrecord_ste_accounttype', 'custrecord_ste_taxcode_taxrate', 'custrecord_ste_taxcode_receivablesacc', 'custrecord_ste_taxcode_payablesacc', 'custrecord_ste_taxcode_rate_visibility', 'custrecord_ste_accountsrcnexus', 'custrecord_ste_taxcode_level', 'custrecord_ste_taxcode_reversechargelink', 'custrecord_ste_taxcode_tiered_rate', 'custrecord_ste_taxcode_currency', 'custrecord_ste_taxcode_threshold_basis', 'custrecord_ste_taxaccount_stecode', 'custrecord_ste_taxcode_ratetype', 'custrecord_ste_taxcode_children', 'custrecord_ste_taxcode_state', 'custrecord_ste_taxcode_oss', 'custbody_ste_transaction_type', 'custbody_ste_alltaxregistrations', 'custbody_ste_rcs_invoice_texts', 'custbody_ste_oss_country', 'custbody_ste_economic_union', 'custbody_ste_oss_scheme', 'custbody_ste_discounted_price', 'custbody_ste_discounted_total', 'custbody_ste_use_tax', 'custbody_ste_discounted_vat', 'custbody_ste_rcs_applicable', 'custbody_ste_ship_vat_from_country', 'custcol_ste_item_oss_tax_schedule', 'custcol_ste_tax_item_type', 'custcol_ste_item_tax_schedule', 'custcol_ste_tax_item_type_code', 'customrecord_ste_taxcode_threshold_type', 'customrecord_ste_dataprovision_queue_err', 'customrecord_ste_exmpt_cert_item_binding', 'customrecord_ste_taxcode_level', 'customrecord_ste_nexus_default_tax_codes', 'customrecord_ste_taxcode_ledger_slave', 'customrecord_ste_provisioning_log_rt', 'customrecord_ste_item_taxitemtype', 'customrecord_ste_tax_schedule_body', 'customrecord_ste_country_group_union', 'customrecord_ste_taxcode_threshold_basis', 'customrecord_ste_taxcode_history', 'customrecord_ste_create_records_type', 'customrecord_ste_lookup_st_sc_us', 'customrecord_ste_exemption_certificate', 'customrecord_ste_csv_import_task_list', 'customrecord_ste_lookup_transition', 'customrecord_ste_taxcode_ratetype', 'customrecord_ste_data_storage', 'customrecord_ste_lookup_process', 'customrecord_ste_slavelist', 'customrecord_ste_slave_import_test', 'customrecord_ste_country_list', 'customrecord_ste_taxrate_tier_currency', 'customrecord_ste_backend_invoker_error', 'customrecord_ste_lookup_state_scenario', 'customrecord_ste_dataimport', 'customrecord_ste_tax_reg_format', 'customrecord_ste_setting', 'customrecord_ste_last_emal_notification', 'customrecord_ste_taxcode_availableon', 'customrecord_ste_taxcode_import', 'customrecord_ste_oss_scheme_setup', 'customrecord_ste_oss_setup', 'customrecord_ste_create_records', 'customrecord_ste_item_tax_exemption', 'customrecord_ste_provisioning_log', 'customrecord_ste_provisioning_task', 'customrecord_ste_tax_schedule', 'customrecord_ste_update_queue', 'customrecord_ste_dataprovision_type', 'customrecord_ste_tax_group', 'customrecord_ste_dataimport_plugins', 'customrecord_ste_lookup_node', 'customrecord_ste_roles_permissions', 'customrecord_ste_entity_lookup_settings', 'customrecord_ste_transaction_type', 'customrecord_ste_country_group_member', 'customrecord_ste_nexus_pre_def_tax_codes', 'customrecord_ste_country_gr_union_member', 'customrecord_ste_oss_tax_schedule', 'customrecord_ste_state_us', 'customrecord_ste_state_us_category', 'customrecord_ste_lookup', 'customrecord_ste_provisioning_request', 'customrecord_ste_rates_import', 'customrecord_ste_nexus_compliance_text', 'customrecord_ste_taxrate', 'customrecord_ste_country_group', 'customrecord_ste_oss_tax_schedule_body', 'customrecord_ste_item_tax_rules', 'customrecord_ste_taxtype', 'customrecord_ste_roles_permission_levels', 'customrecord_ste_nexuspreferences', 'customrecord_ste_oss_scheme', 'customrecord_ste_tg_line', 'customrecord_ste_vatvalidation_results', 'customrecord_ste_dataprovision_queue', 'customrecord_ste_taxcode_ledger_master', 'customrecord_ste_country', 'customscript_ste_suitetaxengine', 'customsearch_ste_item_searches', 'custtab_59_4452715_573', 'customscript_ste_bundle_install', 'customscript_ste_cs_nexus', 'customscript_ste_cs_rol_perm_detail', 'customscript_ste_cs_transaction', 'customscript_ste_cs_taxschedule_detail', 'customscript_ste_cs_oss_setup', 'customscript_ste_cs_entity', 'customscript_ste_mr_exempt_items_save', 'customscript_ste_mr_data_provisioning', 'customscript_ste_mr_data_update', 'customscript_ste_mr_item_tax_exempt_save', 'customscript_ste_mr_confirmation_email', 'customscript_ste_mr_create_records', 'customscript_ste_mr_exempt_allitems_save', 'customscript_ste_mr_taxschedule_itemsave', 'customscript_ste_mr_item_tax_rules_save', 'customscript_ste_mr_lookupprocess_delete', 'customscript_ste_mr_itr_save_from_search', 'customscript_ste_mr_oss_taxschd_itemsave', 'customscript_ste_rl_country_manager', 'customscript_ste_rl_get_repeat', 'customscript_ste_sc_auto_data_update', 'customscript_ste_sl_backend_restricted', 'customscript_ste_sl_backend_admin', 'customscript_ste_sl_record', 'customscript_ste_sl_oss_setup', 'customscript_ste_sl_oss_taxsched_list', 'customscript_ste_sl_oss_setup_list', 'customscript_ste_sl_reg_format_detail', 'customscript_ste_sl_tax_validation', 'customscript_ste_sl_rol_perm_detail', 'customscript_ste_sl_exempt_cert_list', 'customscript_ste_sl_reg_format_list', 'customscript_ste_sl_taxschedule_detail', 'customscript_ste_sl_exempt_cert_detail', 'customscript_ste_sl_subsidiary_service', 'customscript_ste_sl_oss_taxsched_detail', 'customscript_ste_sl_taxschedule_list', 'customscript_ste_sl_dataprovisioning', 'customscript_ste_sl_transaction_type', 'customscript_ste_sl_item_tax_rules_det', 'customscript_ste_sl_item_tax_rules_list', 'customscript_ste_sl_taxgroup_detail', 'customscript_ste_sl_updatedeployment', 'customscript_ste_sl_rol_perm_list', 'customscript_ste_sl_tax_group_list', 'customscript_ste_ue_item', 'customscript_ste_ue_entity', 'customscript_ste_ue_account', 'customscript_ste_ue_oss_setup', 'customscript_ste_ue_transaction', 'customscript_ste_ue_nexus', 'customscript_ste_ue_subsidiary', 'customscript_ste_ue_taxcode_ui', 'customscript_ste_ue_tax_type', 'customscript_ste_wf_lookup_process_act', 'customscript_ste_wf_trans_comp_text_act', 'custcollection_ste', 'customworkflow_ste_wf_ratetype', 'customworkflow_ste_wf_lookup_process', 'customworkflow_ste_wf_trans_comp_text']),
  },
  354072: {
  },
  358126: {
  },
  237699: {
    '1.23.1': new Set(['custbody_str_jrnl_adjustment_box', 'custcol_str_tax_reporting_category', 'custcol_str_tax_item_type', 'custcol_str_item_category', 'customlist_str_tax_item_type', 'customrecord_str_job', 'customrecord_str_roles_permissions', 'customrecord_str_roles_permission_levels', 'customrecord_str_roles_permission_lvl_fv', 'customrecord_str_suiteapp_profiler', 'customrecord_str_custom_config_cache', 'customrecord_str_tax_filing_creds', 'customrecord_str_ctr_component', 'customrecord_str_tax_filing', 'customrecord_str_tax_reporting_category', 'customrecord_str_trantypelist', 'customrecord_str_job_details', 'customrecord_str_schema', 'customrecord_str_nexus_dep', 'customrecord_str_ctr_bundle', 'customrecord_str_schema_details', 'customrecord_str_item_cat', 'customrecord_str_nex_item_cat', 'customrecord_str_schema_details_js', 'customscript_str_bundle_installation', 'customscript_str_item_cs', 'customscript_str_adjustment_jrnl_cs', 'customscript_reportschema_installer_mr', 'customscript_str_querytask_proc_mr', 'customscript_str_searchtask_proc_mr', 'customscript_str_searchinstaller_mr', 'customscript_str_trc_installer_mr', 'customscript_str_logger_rs', 'customscript_str_queryrunner_ss', 'customscript_str_reportpostprocessor_ss', 'customscript_str_search_installer_ss', 'customscript_str_jobmanager_ss', 'customscript_str_recordloader_ss', 'customscript_str_searchrunner_ss', 'customscript_str_bundle_installer_ss', 'customscript_str_tax_filing_ss', 'customscript_str_querytask_proc_ss', 'customscript_str_reportpreprocessor_ss', 'customscript_str_searchtask_proc_ss', 'customscript_str_jmrunner_ss', 'customscript_str_tax_filing_auth_su', 'customscript_str_tax_filing_su', 'customscript_str_querytask_runner_su', 'customscript_str_searchtask_runner_su', 'customscript_str_schema_editor_su', 'customscript_str_account_svc_su', 'customscript_str_country_report_su', 'customscript_str_report_preferences_su', 'customscript_str_output_data_reader_su', 'customscript_str_roles_su', 'customscript_str_vat_drilldown_su', 'customscript_str_config_svc_su', 'customscript_str_journal_entry_svc_su', 'customscript_str_adjust_return_su', 'customscript_str_country_form_su', 'customscript_str_tax_filing_progress_su', 'customscript_str_taf_su', 'customscript_ctr_options_svc_su', 'customscript_str_jobmanager_su', 'customscript_str_tax_return_setup_su', 'customscript_str_tax_filing_setup', 'customscript_str_item_cat_svc_su', 'customscript_str_report_job_progress_su', 'customscript_str_recoverability_su', 'customscript_str_job_ue', 'customscript_str_roles_permissions_ue', 'customscript_str_item_ue', 'customscript_str_tax_filing_ue', 'customscript_str_adjusment_jrnl_ue', 'customscript_str_sub_settings_ue', 'customscript_str_job_details_ue', 'custcollection_trf_objects', 'custcollection_trf_oss_report', 'custcollection_trf_components', 'custcollection_trf_rec_schema_details_js', 'custcollection_trf_rec_component']),
  },
  429861: {
  },
  26153: {
  },
  213294: {
    '1.00.12': new Set(['custentity_evd_itmset_exclded_custgrp', 'custentity_evd_defaultdiscount', 'custbody_evd_enabledvalidations', 'custcol_evd_olditemqty', 'customlist_evd_validationtype', 'customrecord_evd_enablevalidations', 'customrecord_evd_itemset', 'customrole_evd_scriptadmin', 'customsearch_evd_enablevalidations', 'customsearch_evd_customergroup', 'customsearch_evd_items', 'customsearch_evd_itemset', 'customscript_evd_cs_enablevalidations', 'customscript_evd_cs_validatetxn', 'customscript_evd_ue_enablevalidations', 'customscript_evd_ue_validatetxn', 'customscript_evd_ue_itemset']),
  },
  187488: {
  },
  265447: {
  },
  320155: {
    '1.2.2': new Set(['customrole1001']),
  },
  244403: {
  },
  302959: {
  },
  17524: {
    'v1.3': new Set(['custitem_bp_sleeve_dimension', 'custitem_bp_net_weight', 'custitem_bp_carbon_duty', 'custitem_bp_weight_persleeve', 'custitem_bp_uom', 'custitem_data_touched', 'custitem_bp_items_persleeve', 'custitem_bp_carton_cbm', 'custitem_bp_sleeve_height', 'custitem_landed_vendor_purch_price', 'custitem_bp_sleeves_peruom', 'custitem_bp_items_peruom', 'customlist_bp_uom_list', 'customrecord_sales_location', 'customsearch45', 'customsearch47', 'customsearch46_2', 'customsearch48_2', 'customsearch40', 'customsearch37', 'customsearch34', 'custtab_43_1309466_824', 'customscript_bp_mu_salesitemalerts', 'customscript_bp_ue_salesitemalerts']),
  },
  286060: {
  },
  281755: {
  },
  410185: {
  },
  286052: {
  },
  202280: {
    '1.00.6': new Set(['custentity_comp_soc', 'custrecord_payroll_coe', 'custrecord_payroll_use_box14_cust_label', 'custrecord_payroll_box14_cust_label', 'custrecord_payroll_default_box14_label', 'custrecord_payroll_alaska_geocode', 'customrecord_comp_fld_emp_payroll_tab', 'customrecord_paycode_box14_mapping', 'customrecord_payroll_comp_upd_rec', 'customrecord_payroll_comp_fld_def', 'customscript_payroll_comp_fields_emp_cl', 'customscript_payroll_comp_emp_ue', 'customscript_box14_payroll_item_ue', 'customscript_payroll_comp_workplace_ue']),
  },
  35075: {
  },
  482718: {
  },
  188088: {
    NO_VERSION: new Set(['customrole_read_only_admin']),
  },
  347165: {
  },
  390151: {
  },
  354073: {
  },
  239212: {
  },
  319542: {
  },
  132060: {
  },
  419588: {
  },
  41309: {
    '2.06.0': new Set(['customrecord_dad_enabled_record_type', 'customrecord_dad_file', 'customrecord_dad_file_html', 'customscript_dad_bundle_install', 'customscript_dad_enabled_record_type_cl', 'customscript_dad_cs_admin_assist', 'customscript_dad_bundle_install_sched', 'customscript_dad_file_cab_front_end_sl', 'customscript_dad_admin_service_sl', 'customscript_dad_generate_css_sl', 'customscript_dad_user_service_sl', 'customscript_dad_admin_setup_assistant', 'customscript_dad_record_page_cr_ue', 'customscript_dad_record_page_ue', 'customscript_dad_enabled_record_type_ue']),
  },
  341344: {
  },
  185105: {
  },
  375075: {
  },
  364290: {
  },
  318158: {
    '1.02.1': new Set(['customrecord_sra_sales_return_acc_map', 'customscript_sra_custom_gl_plugin', 'customrole_sra_accountant', 'customsearch_sra_sales_return_accnt_map', 'customscript_sra_cs_sales_rtn_acc_field', 'customscript_sra_ue_income_account_list', 'custcollection_sra_translation_collection']),
  },
  1894: {
    '9.0': new Set(['custentity_ava_usetaxassessment', 'custentity_ava_exemptcertno', 'custitem_ava_ewaste_netweight', 'custitem_ava_ewaste_firstuse', 'custitem_ava_isoperatorprovided', 'custitem_ava_taxcode', 'custitem_ava_bottletax_uom_packsize', 'custitem_ava_ewaste_screensize', 'custitem_ava_ewaste_containsmercury', 'custitem_ava_ewaste_studded', 'custitem_ava_is_taxable_service', 'custitem_ava_iscoloradosmmregistered', 'custitem_ava_ewaste_uom_screensize', 'custitem_ava_ewaste_uom_packsize', 'custitem_ava_ewaste_uom_treadwidth', 'custitem_ava_ewaste_packsize', 'custitem_ava_ewaste_rimdiameter', 'custitem_ava_iselectricvehicle', 'custitem_ava_grossweight', 'custitem_ava_bottletax_uom_netvolume', 'custitem_ava_ewaste_uom_containersize', 'custitem_ava_ewaste_containersize', 'custitem_ava_isheavymachinery', 'custitem_ava_isacceleratedtaxpaid', 'custitem_ava_isintercompany', 'custitem_ava_udf2', 'custitem_ava_ewaste_voltage', 'custitem_ava_ewaste_tiretype', 'custitem_ava_ewaste_treadwidth', 'custitem_ava_unitofmeasure', 'custitem_ava_bottletax_bevcontmat', 'custitem_ava_bottletax_netvolume', 'custitem_ava_ewaste_uom_rimdiameter', 'custitem_ava_issusedvehicle', 'custitem_ava_isindeterminatelength', 'custitem_ava_numberofdays', 'custitem_ava_istexasterpeligible', 'custitem_ava_udf1', 'custitem_ava_bottletax_packsize', 'custitem_ava_ewaste_uom_voltage', 'custitem_ava_ewaste_uom_netweight', 'custitem_ava_preowned', 'custitem_ava_netweight', 'custrecord_ava_taxcodes', 'custrecord_ava_ispos', 'custbody_ava_scis_trans_flag', 'custbody_ava_is_sellerimporter', 'custbody_ava_billtousecodetext', 'custbody_ava_customerfirstname', 'custbody_ava_partnerisperson', 'custbody_ava_taxoverride', 'custbody_ava_discountamount', 'custbody_ava_invoicemessage', 'custbody_ava_shiptousecode', 'custbody_ava_billto_latitude', 'custbody_ava_transport', 'custbody_ava_partnerentityid', 'custbody_ava_taxdateoverride', 'custbody_ava_handlingamount1', 'custbody_avashippingcode', 'custbody_ava_salesresp', 'custbody_ava_custexternalid', 'custbody_ava_partnercompanyname', 'custbody_ava_customercompanyname', 'custbody_ava_taxoverridedate', 'custbody_ava_shippingamount', 'custbody_ava_shippingamount1', 'custbody_ava_discountmapping', 'custbody_ava_taxcredit', 'custbody_ava_shipto_latitude', 'custbody_ava_created_from_so', 'custbody_ava_postingperiodname', 'custbody_ava_partnermiddlename', 'custbody_ava_scisnotemsg', 'custbody_ava_handlingamount', 'custbody_ava_usebilltoaddress', 'custbody_ava_pickup', 'custbody_ava_shipto_longitude', 'custbody_ava_billtousecode', 'custbody_ava_customduty', 'custbody_ava_customerisperson', 'custbody_ava_suspendtaxcall', 'custbody_ava_vatregno', 'custbody_ava_purchaseorder_ref', 'custbody_ava_sendimportaddress', 'custbody_ava_shiptousecodetext', 'custbody_ava_vatbusinessid', 'custbody_ava_exemptcertno', 'custbody_ava_customermiddlename', 'custbody_ava_shippingtaxinclude', 'custbody_ava_disable_tax_calculation', 'custbody_avashippingcodetext', 'custbody_ava_partnerfirstname', 'custbody_ava_customerlastname', 'custbody_ava_entity_type', 'custbody_avalara_status', 'custbody_ava_taxinclude', 'custbody_ava_billto_longitude', 'custbody_ava_customertaxable', 'custbody_ava_customerentityid', 'custbody_ava_partnerlastname', 'custcol_ava_bottletax_packsize', 'custcol_ava_shipto_latitude', 'custcol_ava_ewaste_treadwidth', 'custcol_ava_isindeterminatelength', 'custcol_ava_iselectricvehicle', 'custcol_ava_rentalleasingtaxrate', 'custcol_ava_item', 'custcol_ava_vat_bin', 'custcol_ava_bottletax_uom_netvolume', 'custcol_ava_multitaxtypes', 'custcol_ava_ewaste_uom_voltage', 'custcol_ava_ewaste_uom_screensize', 'custcol_ava_shippingamount1', 'custcol_ava_udf1', 'custcol_ava_preowned', 'custcol_ava_ewaste_uom_containersize', 'custcol_ava_ewaste_voltage', 'custcol_ava_ewaste_firstuse', 'custcol_ava_ewaste_packsize', 'custcol_ava_ewaste_tax', 'custcol_ava_issusedvehicle', 'custcol_ava_bottletaxrate', 'custcol_ava_incomeaccount', 'custcol_ava_bottletax_bevcontmat', 'custcol_ava_gross_amount', 'custcol_ava_shiptousecode', 'custcol_ava_numberofdays', 'custcol_ava_netweight', 'custcol_ava_ewaste_rimdiameter', 'custcol_ava_bottletax', 'custcol_ava_isheavymachinery', 'custcol_ava_isoperatorprovided', 'custcol_ava_shiptousecodetext', 'custcol_ava_upccode', 'custcol_ava_assetaccounttext', 'custcol_ava_bottletax_uom_packsize', 'custcol_ava_shipto_longitude', 'custcol_ava_pickup', 'custcol_ava_customdutyrate', 'custcol_ava_taxamount', 'custcol_ava_transport', 'custcol_ava_unitofmeasure', 'custcol_ava_isacceleratedtaxpaid', 'custcol_ava_assetaccount', 'custcol_ava_ewaste_netweight', 'custcol_ava_shippingamount', 'custcol_ava_handlingamount1', 'custcol_ava_gross_amount1', 'custcol_ava_ewaste_containsmercury', 'custcol_ava_ewaste_taxrate', 'custcol_ava_expenseaccounttext', 'custcol_ava_shipfrom_vat_bin', 'custcol_ava_ewaste_uom_packsize', 'custcol_ava_handlingamount', 'custcol_ava_udf2', 'custcol_ava_ewaste_uom_treadwidth', 'custcol_ava_ewaste_screensize', 'custcol_ava_ewaste_containersize', 'custcol_ava_ewaste_studded', 'custcol_ava_iscoloradosmmregistered', 'custcol_ava_istexasterpeligible', 'custcol_ava_isintercompany', 'custcol_ava_bottletax_netvolume', 'custcol_ava_vatcode', 'custcol_ava_grossweight', 'custcol_ava_ewaste_uom_rimdiameter', 'custcol_ava_ewaste_uom_netweight', 'custcol_ava_taxcodemapping', 'custcol_ava_shipto_vat_bin', 'custcol_ava_hsncode', 'custcol_ava_rentalleasingtax', 'custcol_ava_ewaste_tiretype', 'custcol_ava_is_taxable_service', 'custcol_ava_expenseaccount', 'customlist_ava_bottletax_uom_netvolume', 'customlist_ava_ewaste_uom_containersiz', 'customlist_ava_statuslist', 'customlist_ava_transportlist', 'customlist_ava_bottletax_uom_packsize', 'customlist_ava_unitofmeasure', 'customlist_ava_bottletax_bevcontmat', 'customlist_ava_ewaste_uom_packsize', 'customlist_ava_ewaste_uom_screensize', 'customlist_ava_ewaste_tiretype', 'customlist_ava_ewaste_uom_rimdiameter', 'customlist_ava_multitaxtype_param', 'customlist_ava_ewaste_uom_treadwidth', 'customlist_ava_ewaste_uom_voltage', 'customlist_ava_ewaste_uom_netweight', 'customrecord_avaentityusecodes', 'customrecord_avareconcilebatch', 'customrecord_avacertemail', 'customrecord_avausetaxheaderdetails', 'customrecord_avacertcapturebatch', 'customrecord_avadeleteoldrecord', 'customrecord_avashippingitemcodes', 'customrecord_avashippingcodes', 'customrecord_avacustomerexemptmapping', 'customrecord_avaimsdetails', 'customrecord_avaitemmapping', 'customrecord_avaentityusemapping_new', 'customrecord_vataddresses', 'customrecord_avatwowayimsbatch', 'customrecord_avaentityusemapping', 'customrecord_avaaddvalidationbatchrecord', 'customrecord_avarecalculatebatch', 'customrecord_avatwowayimsdetails', 'customrecord_avareconcilebatchrecords', 'customrecord_avaimsbatch', 'customrecord_avataxheaderdetails', 'customrecord_avatransactionlogs', 'customrecord_avaaddvalflag', 'customrecord_vendorvataddresses', 'customrecord_avaconfig', 'customrecord_avaaddressvalidationbatch', 'customrecord_avacoordinates', 'customrecord_avacustomerstocertcapture', 'customrole1001', 'customscript_ava_bundleinstallation', 'customscript_avaentity_client', 'customscript_avatransaction_client', 'customscript_avapurchase_client', 'customscript_avaaddressvalidation_sched', 'customscript_ava_twowayitemmastersyn_map', 'customscript_ava_itemmastersync_map', 'customscript_avaaddcusttocertcapture_map', 'customscript_avacommittrans_map', 'customscript_avarecalctaxes_map', 'customscript_ava_deleteoldrecord_map', 'customscript_ava_reconcileavatax_sched', 'customscript_ava_general_restlet', 'customscript_avadeleteaddvalbatch_sched', 'customscript_ava_2wayimsrecorddelete_sch', 'customscript_avadeletetranlogs_sched', 'customscript_avaupdatevalidatedadd_sched', 'customscript_avadeletecertbatches_sched', 'customscript_avaentityusecodeslist_sched', 'customscript_avaregtkn_sched', 'customscript_avadeletebatch_sched', 'customscript_avaconfig_suitlet', 'customscript_avaconfig_wizard1', 'customscript_ava_deleteoldrecordcb_suit', 'customscript_avagetcertificates_suitelet', 'customscript_avagettaxhistory_suitelet', 'customscript_avaquickvalidation_suitlet', 'customscript_ava_reconcilelist_suitelet', 'customscript_avaaddvalidresults_suitelet', 'customscript_ava_createcompany_suitelet', 'customscript_ava_deleteoldrecordvb_suit', 'customscript_avaentityuseform_suitlet', 'customscript_avaentityuselist_suitlet', 'customscript_avacertstatus_suitelet', 'customscript_avashippinglist_suitlet', 'customscript_avasuitecommerce_suitelet', 'customscript_ava_twowayimsviewbatch_suit', 'customscript_ava_imsviewbatch_suitelet', 'customscript_avashippingcodeform_suitlet', 'customscript_avatransactionlist_suitelet', 'customscript_ava_2wayimscreatebatch_suit', 'customscript_avacommittedlist_suitlet', 'customscript_avacustlistforcert_suitelet', 'customscript_avadashboard_suitelet', 'customscript_ava_recalcbatches', 'customscript_avareconcilelist_suitelet', 'customscript_avaregtkn_suitelet', 'customscript_avaddressvalidation_suitlet', 'customscript_avataxparameters_suitelet', 'customscript_ava_imscreatebatch_suitelet', 'customscript_ava_recalcutility', 'customscript_ava_recordload_suitelet', 'customscript_avaaddcuststocert_suitelet', 'customscript_avaaddvalidlist_suitelet', 'customscript_avacertviewbatch_suitelet', 'customscript_avaconfig_wizard', 'customscript_avaenablenexus_suitelet', 'customscript_avavoidedlist_suitlet', 'customscript_avacertificates_suitelet', 'customscript_avagetcertimage_suitelet', 'customscript_ava_reconciliation_suitelet', 'customscript_avatransactionlog_suitelet', 'customscript_ava_2wayimsbatchdetails_sui', 'customscript_avacustomer_address', 'customscript_avacustomer_certs', 'customscript_ava_shippingitem', 'customscript_avavendor', 'customscript_avalocation', 'customscript_avatransactiontab_2', 'customscript_avacustomer', 'customscript_ava_inventoryitems', 'customscript_avapurchasetransactiontab', 'customscript_ava_expensecategory', 'customscript_avatransactiontab', 'customscript_avacommitapprtrans']),
  },
  224753: {
  },
  330428: {
  },
  292257: {
  },
  352481: {
  },
  257625: {
    '2023.3.5': new Set(['custentity_dunning_email', 'custentity_ilo_field_payment_method', 'custentityil_tax_payer_id', 'custentity_ilo_bank_account_name', 'custentity_ilo_bank_account_address', 'custentityilo_bookkeeping_start_date', 'custentityil_expiry_date', 'custentityilo_cust_bank_branch_number', 'custentityil_org_type', 'custentity_ilo_print_hebrew', 'custentity_ilo_iban', 'custentity_ilo_cust_bank_number', 'custentityil_tax_officer_number', 'custentity_ilo_bank_branch_number', 'custentity_ilo_bank_name', 'custentity_dunning_notification', 'custentity_ilo_bank_account_number', 'custentity_fin_search_from_date', 'custentityilo_cust_bank_branch', 'custentity_vat_reg_no', 'custentity_ilo_virtual_partnetship', 'custentity_ilo_bank_swift_code', 'custentityilo_bookkeeping_created_date', 'custentityil_bookkeeping_certification', 'custentity_ilo_cust_bank_address', 'custentity_ilo_include_in_shaam_report', 'custentityil_occupation_description', 'custentity_4601_defaultwitaxcode', 'custentity_exclude_from_dunning_notific', 'custentity_ilo_cust_bank_name', 'custentity_ilo_customer_bank', 'custentity_legacy_number', 'custentity_il_aba_number', 'custentity_ilo_cust_bank_account_number', 'custentity_isbudegtowner', 'custentity_fin_search_to_date', 'custentity_ilo_shaam_update', 'custitem_4601_defaultwitaxcode', 'custrecord_ilo_acc_account_number', 'custrecord_ilo_masav_clearing_account', 'custrecord_ilo_occupation_description', 'custrecord_ilo_paying_org_type', 'custrecordil_tiknik', 'custrecord_po_additional_comment_hebrew', 'custrecord_department_budgetary_control', 'custrecord_4110_category', 'custrecord_ilo_subsid_heb_companyname', 'custrecord_ilo_acc_bank_branch_number', 'custrecord_ilo_email_856', 'custrecord_ilo_masav_number_code_shidur', 'custrecord_ilo_org_type', 'custrecord_po_additional_comment_english', 'custrecord_budgetary_control_level', 'custrecord_revalue_indicator', 'custrecordil_tax_payer_id_subsidary', 'custrecord_of_inventory_account_indicati', 'custrecord_ilo_currency_indicator', 'custrecord_eliminate_indicator', 'custrecord_ilo_subsid_english_remit', 'custrecord_ilo_subsid_hebrew_address', 'custrecord_ilo_acc_bank_number', 'custrecord_of_from_date', 'custrecord_ilo_masav_mosad', 'custrecord_ilo_phone', 'custrecordof_ret_earnings_account', 'custrecord_under_budgetary_control', 'custrecord_acct_bank_account_number', 'custrecord_ilo_subsid_eng_address', 'custrecord_ilo_subsid_hebrew_remit', 'custrecord_budget_section', 'custrecordil_tax_code_for_localization', 'custrecord_of_to_date', 'custrecord_bank_branch_number', 'custrecord_ilo_acc_bank_details', 'custrecord_cross_subsidiary_budgeting', 'custrecordof_ret_earnings_acc_internalid', 'custrecord_fam_account_showinfixedasset', 'custbody_glm_csv_reference', 'custbody_ilo_wht_amount', 'custbody_ilo_row_ven_bank_account_name', 'custbody_ilo_grossamt_format', 'custbody_ilo_cust_account_number', 'custbody_ilo_cust_bank_name', 'custbody_ilo_vatregnum', 'custbody_ilo_wh_tax_percent', 'custbodyilo_selected_for_payment', 'custbody_ilo_total_words', 'custbody_vendor_prepayment_internal_id', 'custbody_ilo_row_ven_bank_acc_number', 'custbody_ilo_row_ven_bank_accou_addres', 'custbody_ilo_row_vend_bank_name', 'custbody_ilo_vat_l_tranid', 'custbody_ilo_netamt_format', 'custbody_ilo_cust_bank_branch', 'custbody_ilo_tax_payer_id', 'custbody_ilo_wh_tax_percent_vendor', 'custbody_glm_reference', 'custbody_ilo_print_hebrew', 'custbody_ilo_header_vat_period', 'custbody_ilo_gross_amount', 'custbody_ilo_eom_daysahead', 'custbody_ilo_cust_check_date', 'custbodyilo_vat_reported', 'custbodycustbody_ilo_print_draft', 'custbody_ilo_row_ven_aba_number', 'custbody_email_sent', 'custbody_ilo_exclude_from_shaam_report', 'custbody_ilo_reversed_address', 'custbody_ilo_masav_batch', 'custbody_ilo_payment_method', 'custbody_ilo_prepayment_amount', 'custbody_ilo_applied_wht_je', 'custbody_ilo_row_ven_bank_swift_code', 'custbody_ilo_whtamt_format', 'custbody_glm_cs_permission', 'custbody_ilo_cust_bank_number', 'custbody_4601_pymnt_ref_id', 'custbody_annual_budgeting_unit', 'custbody_control_budgeting_unit', 'custbody_ilo_inv_cust_bankname', 'custbody_my_import_declaration_num', 'custbody_subsidiary', 'custbody_ilo_net_amount', 'custbody_ilo_comments', 'custbody_exclude_invoice_from_dunning', 'custbody_ilo_cust_bank_branch_number', 'custbody_ilo_palestinian_doc_number', 'custbody_4599_sg_import_permit_num', 'custbody_4599_mx_operation_type', 'custbody_ilo_org_printed', 'custbody1', 'custbody_ilo_row_vend_bank_branch_num', 'custcol_ilo_memo_frm_bill', 'custcol_ilo_employee', 'custcol_budgeting_unit', 'custcol_isr_report_vat', 'custcol2', 'custcol_ilo_travel_number_column', 'custcol_ilo_car', 'custcol_budget_control_unit', 'custcol3', 'customlist_department_budgetary_contro', 'customlistil_organization_type', 'customlistil_yes_no', 'customlist_yes_or_no', 'customlist_ilo_dateformat', 'customlistil_certificate_yes_no', 'customlist_il_masav_code_shidur', 'customlist_ilo_paying_org_type_list', 'customlist_ilo_payment_method', 'customlistil_israeli_tax_codes', 'customlist_po_email_approval_sender', 'customlist_ilo_contacts_tosend_types', 'customlist_environment_list', 'customlist218', 'customlistilo_tax_period_status', 'customlist_operation_type', 'customlist_car_leasing_company_list', 'customlist_dev_req_prioritys', 'customlist_ilo_tax_officer_number', 'customlist_budget_control_level', 'customlist_ilo_setup_of_multi', 'customlist_dev_req_statuses', 'customlist_estimation_approval', 'customlist_gender', 'customlistilo_list_masav_number', 'customlist_ilo_masav_mosad', 'customlist220', 'customlist_budgetary_control_section', 'customlist_ilo_occupation_description', 'customlist_ilo_lst_masav_batchstatus', 'customlist_wtax_available_on', 'customlist_ncfar_deprhistmethods', 'customlist_ncfar_transactiontype', 'customlist_ncfar_assetstatus', 'customlist_ncfar_depractive', 'customlist_ncfar_deprrules', 'customlist_ncfar_conventions', 'customlist_far_monthnames', 'customlist_ncfar_revisionrules', 'customlist_ncfar_deprperiod', 'customlist_ncfar_disposaltype', 'customlist_fam_list_period_convention', 'customlist_ncfar_annualentry', 'customlist_ncfar_taxmethodstatus', 'customlist_fam_list_accrual_convention', 'customlist_fam_list_final_convention', 'customlist_fam_depr_tables', 'customlist_fam_forecaststatus', 'customlist_fam_list_usedaccounts', 'customlist_ncfar_unitmeasurment', 'customrecord_ilo_travel_record', 'customrecord_ilo_cars', 'customrecord_ilo_masav_batch', 'customrecord_ilo_shaam_groups', 'customrecord_ilo_setup', 'customrecord_4601_witaxtype', 'customrecord_4601_groupedwitaxcode', 'customrecord_ilo_bank_details', 'customrecord_oil_vendor_cert', 'customrecord_4601_witaxsetup', 'customrecord_ilo_cr_openformat', 'customrecord_ilo_vendor_bank', 'customrecord_4601_witaxcode', 'customrecord_ph4014_wtax_type_kind', 'customrecordilo_tax_period', 'customrecord_isr_vat_periods_locked', 'customrecord_annual_budgeting_unit', 'customrecord_control_budgeting_unit', 'customrecord_rejection_reason', 'customrecord_transactions_approval_log', 'customrecord_ncfar_deprhistory', 'customrecord_ncfar_assettype', 'customrecord_ncfar_asset', 'customrecord_ncfar_altdepreciation', 'customrecord_ncfar_deprmethod', 'customrecord_ncfar_altmethods', 'customrecord_bg_summaryrecord', 'customrecord_fam_assetvalues', 'customrecord_repairmaintsubcategoryb', 'customrecord_repairmaintsubcategory', 'customrecord_repairmaintcategory', 'custcenter_dunning_center', 'custcenter_budget_center', 'custtmpl_105_1283062_146', 'custtmpl_il_invoice', 'custtmplil_payment', 'custtmpl_il_purchase_template', 'custtmpl_il_deposit', 'custtmpl_109_1283062_645', 'custtmpl_il_credit_memo', 'custtmpl_108_1283062_121', 'custtmpl_il_vendor_payment', 'custform_63_1283062_896', 'custform_2_1283062_800', 'custform_38_1283062_800', 'custform_66_1283062_356', 'custform_71_1283062_881', 'custform_68_1283062_733', 'custform_44_1283062_800', 'custform_67_1283062_441', 'custform_ilo_israeli_vendor_credit_id', 'custform_98_1283062_297', 'custform_37_1283062_800', 'custform_68_1283062_996', 'custformilo_check_form', 'custform_40_1283062_567', 'custform_76_1283062_466', 'custform_48_1283062_800', 'custform_36_1283062_800', 'customrole1032', 'customrole1031', 'customrole1018', 'customrole1030', 'customsearch_bgt_coa_budgetary_setup', 'customsearch_bgt_budget_vs_actual_all', 'customsearch_bgt_budget_vs_actual_own', 'customsearch_bgt_abu_without_budget_own', 'customsearch111', 'customsearch_contacts_dunning_setup', 'customsearch_customers_contacts', 'customsearch_owner_inconsistency_abu_cbu', 'customsearch_customers_dunning_setup', 'customsearch_customers_without_sales_rep', 'customsearch_customers_without_terms', 'customsearch_customers_without_email', 'customsearch110_2_2_2', 'customsearch_fam_compound_altdep', 'customsearch_fam_compound_disp_details', 'customsearch_annual_cost_dprn', 'customsearch_fam_compound_dephist', 'customsearch749', 'customsearch_ilo_isreli_tax_period', 'customsearch_ilo_taxperiods', 'customsearch_ilo_acc_multi_book', 'customsearch_ilo_b100_2019', 'customsearch_ilo_alltaxcodes_search', 'customsearch_ilo_b110_2019_no_mb', 'customsearch_ilo_c100_2019_2_no_mb', 'customsearch_ilo_c_d_fulfill_2019_no_mb', 'customsearch_ilo_of_d110_d120_2_no_mb', 'customsearch_ilo_m100_2019_2_no_mb', 'customsearch739', 'customsearch_ilo_bill_credit', 'customsearch_il_vat_items', 'customsearch_856_balance', 'customsearch_ilo_m100_2019', 'customsearch_ilo_c_d_fulfill_2019', 'customsearch_ilo_c100_2019', 'customsearch_ilo_b110_2019', 'customsearch_ilo_prepay_je', 'customsearch_ilo_wht_detail_report_102', 'customsearch_ilo_print_deposit_search', 'customsearch_ilo_voided_je', 'customsearch_il_vat_items_2020', 'customsearch_ilo_b100_nomulti', 'customsearch_ilo_of_d110_d120', 'customsearch_dunning_letters_sent', 'customsearch_invoices_mark_as_email_sent', 'customsearch_open_invoices_aging_days', 'customsearch_ilo_vat_period_errors', 'customsearch_dunning_letters', 'customsearch_ilo_transaction_without_vat', 'customsearch_ilo_wht_102_errors', 'customsearch_bgt_abu_encum_release_total', 'customsearch_bgt_abu_actual_total_line', 'customsearch_bgt_abu_actual_total_body', 'customsearch_bgt_abu_encumbrance_total', 'customsearch_bgt_abu_encumbrance_release', 'customsearch_bgt_abu_actual_details_line', 'customsearch_bgt_abu_encumbrance_details', 'customsearch_bgt_abu_actual_detail_body', 'customsearch_bgt_cbu_actual_total_line', 'customsearch_bgt_cbu_encumbrance_total', 'customsearch_bgt_cbu_actual_total_body', 'customsearch_bgt_cbu_encum_release_total', 'customsearch_bgt_cbu_encumbrance_release', 'customsearch_bgt_cbu_actual_details_line', 'customsearch_bgt_cbu_encumbrance_details', 'customsearch_bgt_cbu_actual_detail_body', 'customsearch782', 'customsearch746', 'customsearch_bgt_lines_without_linkage_i', 'customsearch_bgt_lines_without_linkage_e', 'customsearch_ilo_masav_vendors_bank', 'customsearch_israeli_vendors', 'customsearch_il_vendor_certificate', 'custtab_74_1283062_909', 'custtab_40_1283062_683', 'custtab_76_1283062_162', 'custtab_17_3776644_208', 'custtab_glm_matching_hidden', 'custtab_70_1283062_594', 'custtab_glm_matching', 'customscriptilo_bundle_installation', 'customscript_ilo_customer_cs', 'customscript_ilo_vend_cs_prepayment', 'customscript_validation', 'customscript_ilo_cs_masav1', 'customscript_ilo_cs_vend_payment', 'customscript_ilo_invoice_sequencing_cs', 'customscript_line_car_validation_client', 'customscript_ilo_cs_masav2', 'customscript_ilo_vendor_cs', 'customscript_ilo_deposit_print_cs', 'customscript_ilo_vendor_taxcode_cs', 'customscript_ilo_elec_sign_client', 'customscript_ilo_cs_tran', 'customscript_ilo_cs_eom', 'customscript_ilo_shaam_in_mr', 'customscript_snav_portlet', 'customscript_ilo_update_exchangerates_ss', 'customscript_update_exchangerates_ss', 'customscript_ilo_concate_files', 'customscript_ilo_ss_masavexec', 'customscript_ilo_ss_openfromat', 'customscript_ilo_shaam_in_scheduled', 'customscriptilo_sh_close_trans', 'customscript_ilo_ss_mark_masav_bills', 'customscript_ilo_awt_scheduled', 'customscript_gen_vendor_detail', 'customscriptilo_su_openformat', 'customscript_ilo_script_masav_exe', 'customscript_ilo_shaamout_su', 'customscript_ilo_shaam_out', 'customscript_ilo_open_format_2019', 'customscript_generate_vat_file', 'customscript_ilo_masav_citi_file', 'customscript_masav_leumi_file', 'customscript_ilo_shaamin_su', 'customscript_ilo_elec_sign_suitlet', 'customscript_ilo_awt_control_suitlet', 'customscript_ilo_namage_tax_periods', 'customscript_ilo_converter', 'customscriptilo_ss_102_reports', 'customscript_ilo_shaam_in', 'customscript_ilo_su_openfromat', 'customscript_ilo_citi_masav', 'customscriptilo_ss_masav', 'customscript_ilo_masav_create_file', 'customscript_ilo_deposit_print_suitlet', 'customscript_ilo_numtotext_ue_as', 'customscript_ilo_vat_period_changed_2020', 'customscript_ilo_ue_vend_payment', 'customscript_ilo_ue_wht_changed', 'customscript_ilo_su_payment_wht', 'customscript_ilo_ue_trans', 'customscript_vendor_prepayment_internal_', 'customscript_ilo_vat_period_changed', 'customscript_ilo_ue_invoice', 'customscript_ilo_deposit_printbtn_ue', 'customscript_ilo_setup_deploy_exrates', 'customscript_car_line_validation_ue', 'customscript_ilo_vendor_taxcode_bs_ue', 'customworkflow_ilo_payments', 'customworkflow_accounts_indicator_brs', 'customworkflow_accounts_indicator_brl']),
  },
  13512: {
    '5.0': new Set(['custtab_13_660883_627', 'customscript_oa_home_portlet', 'customscript_oa_sso_help', 'customscript_oa_sso_admin', 'customscript_oa_sso_resources', 'customscript_oa_sso_purchases', 'customscript_oa_sso_projects', 'customscript_oa_sso_workspaces', 'customscript_oa_sso_home', 'customscript_oa_sso_expenses', 'customscript_oa_sso_timesheets', 'customscript_oa_sso_support', 'customscript_oa_sso_invoices', 'customscript_oa_sso_reports']),
  },
  405015: {
  },
  185219: {
    '1.09.0': new Set(['customlist_dt_translatable_flds', 'customlist_dt_wrapping', 'customlist_dt_tile_summarytype', 'customlist_dt_tile_transflds', 'customlist_dt_tile_type', 'customlist_dt_tile_alertops', 'customlist_dt_tile_comparetype', 'customrecord_dt_tile', 'customrecord_dt_translations', 'customrole_translation_script_admin', 'customsearch_dt_tile_searchall', 'customsearch_dt_translations', 'customscript_dt_cs_translation', 'customscript_dt_cs_tile', 'customscript_dt_portlet_tiles', 'customscript_dt_ss_updateroles', 'customscript_dt_su_tile_backend', 'customscript_dt_su_translation', 'customscript_dt_su_updatepage', 'customscript_dt_su_translation_query', 'customscript_dt_ue_translation']),
  },
  134179: {
  },
  447660: {
  },
  284926: {
  },
  279508: {
    '2.01.4': new Set(['custentity_fefo_custshelf_min_fulfil', 'custitem_fefo_days_before_shipment', 'custitem_fefo_commit_group_inactive', 'custitem_fefo_shelf_life_days', 'custitem_fefo_shelf_life_grp', 'custitem_fefo_shelf_life_inactive', 'custitem_fefo_expiry_date_required', 'custitem_fefo_commit_grp_code', 'custbody_fefo_apply_expirydate_intgrtn', 'custbody_fefo_failed_so_reas_for_rep', 'custbody_fefo_so_all_items_processed', 'custbody_kit_failed_reasons', 'custbody_fefo_post_period_fm_ingrtn', 'custbody_fefo_fulfill_date_fm_ingrtn', 'custbody_fefo_so_reasons', 'custbody_fefo_kit_reasons_for_rep', 'custbody_fefo_createif_frm_so_intgrtn', 'custbody_fefo_ship_status_fm_ingrtn', 'custbody_fefo_min_fulfill', 'custcol_fefo_line_reas_for_report', 'custcol_fefo_line_location_empty', 'custcol_fefo_supplyreqdate_update', 'custcol_allocate_fulfill_check', 'custcol_fefo_line_reason', 'custcol_fefo_inventory_location_empty', 'custcol_fefo_lotdetails', 'custcol_fefo_soline_loc_preference', 'custcol_fefo_allocate_and_fulfill', 'custcol_fefo_from_assign_fulfill', 'custcol_fefo_line_item_added_manually', 'customlist_csv_column_delimiter', 'customlist_ship_status_for_integration', 'customlist_character_encoding', 'customrecord_csv_import_allocate_fulfill', 'customrecord_fefo_custshelf_life_grp', 'customrecord_fefo_commit_grp_code', 'customrecord_fefo_elastic_logger_fields', 'customrecord_fefo_lot_allocation_params', 'customrecord_fefo_csv_cash_sale_report', 'customrecord_fefo_shelf_life_group', 'custform_fefo_inventory_detail_form', 'customscript_fefo_custom_plugin_default', 'customrole_fefo_role_service', 'customsearch_commit_group_view', 'customsearch_fefo_commit_grp_inactive_up', 'customsearch_fefo_cust_search', 'customsearch_customer_shelf_life_view', 'customsearch_customer_shelflife_view', 'customsearch_shelf_life_group_view', 'customsearch_fefo_shelf_life_inactive_up', 'customsearch_fefo_lot_numbers_search', 'customsearch_fefo_inventory_search', 'customsearch_custom_rolesearch', 'customsearch_fefo_mr_lot_alloc_instance', 'customsearch_so_lineitems_with_lots', 'customsearch_fefo_so_unallocated_lines', 'customsearch_fefo_so_lines_selection', 'customsearch_fefo_picked_qty', 'customsearch_fefo_allocate_and_fulfill', 'customsearch_so_with_non_lot_items', 'custtab_fefo_shelf_life', 'custtab_fefo_allocations', 'customscript_fefo_bundle_installation', 'customscript_fefo_cs_itemfulfillment', 'customscript_fefo_cs_validations', 'customscript_fefo_cs_lot_alloc_params', 'customscript_fefo_so_cs_validations', 'customscript_cs_fefo_shelflifegroup', 'customscript_fefo_so_loc_pref_update', 'customscript_fefo_items_atp_update', 'customscript_fefo_mr_reallocate', 'customscript_fefo_mr_lot_allocation', 'customscript_fefo_ss_report_page', 'customscript_fefo_ss_csvimport_cashsale', 'customscript_fefo_sl_reportpage', 'customscript_fefo_sl_super_role', 'customscript_fefo_sl_csv_cashsale', 'customscript_fefo_sl_csv_import', 'customscript_fefo_sl_data_service', 'customscript_fefo_so_sl_salesorder', 'customscript_fefo_sl_itemfulfillment', 'customscript_fefo_sl_cashsale_csvtrigger', 'customscript_fefo_show_unallocated_lines', 'customscript_fefo_sl_ondemand_allocation', 'customscript_fefo_ue_item_fulfillment', 'customscript_fefo_ue_lot_alloc_params', 'customscript_fefo_ue_salesorder', 'customscript_fefo_ue_shelflife_commitgrp', 'customscript_fefo_allocation_tab_view', 'customscript_fefo_ue_lot_inventory', 'customscript_fefo_custshelf_ue_deploy', 'customscript_fefo_ue_csv_import', 'customscript_fefo_expirydatevalidation', 'custcollection_fefo_lot_assignments']),
  },
  472167: {
  },
  188299: {
    '1.01.2': new Set(['customsearch_psgacc_so_for_followup', 'customsearch_psgacc_so_for_billing', 'customscript_psgacc_mr_acc', 'custcollection_accc_translation_collection']),
  },
  107253: {
  },
  410864: {
  },
  245935: {
  },
  470152: {
  },
  484689: {
  },
  338746: {
  },
  219297: {
  },
  186103: {
    '1.04.1': new Set(['customrecord_nav_shortcut', 'customrecord_nav_shortcut_tooltip', 'customrecord_nav_category', 'customrecord_nav_shortcutgroup', 'customsearch_nav_shortcutgroup', 'customscript_nav_cs_navcategoryentry', 'customscript_nav_po_navigationportlet', 'customscript_nav_ss_rolemassupdate', 'customscript_nav_su_rolemassupdate', 'customscript_nav_su_navigationportlet', 'customscript_nav_ue_navcategoryentry']),
  },
  146013: {
  },
  372579: {
    '2.2.44': new Set(['customrecord_oro_1010_config', 'customrecord_oro_1010_queue', 'customrecord_oro_1010_queue_handler', 'customrole_oro_webservice_admin', 'customscript_oro_1010_mr_queue_process', 'customscript_oro_1010_ue_config', 'customscript_oro_1010_ue_queue_handler']),
  },
  108404: {
  },
  219480: {
  },
  22491: {
  },
  323359: {
    '1.0': new Set(['custentity_oro_1020_customer', 'custbody_oro_1020_sales', 'customscript_oro_1020_pl_iframe', 'customscript_oro_1020_ue_processmap']),
  },
  233125: {
  },
  500777: {
  },

}
