odoo.define('pos.customer.account.transactions.tree', function (require) {
"use strict";
    var core = require('web.core');
    var ListController = require('web.ListController');
    var ListView = require('web.ListView');
    var viewRegistry = require('web.view_registry');

    var CustomerAccountTransactionsListController = ListController.extend({
        buttons_template: 'CustomerAccountTransactionsListView.buttons',
        events: _.extend({}, ListController.prototype.events, {
            'click .oe_apply_credit_button': '_creditButton',
            'click .oe_apply_debit_button': '_debitButton',
            'click .oe_bulk_import_button': '_bulkImportButton',
        }),
        _creditButton: function() {
            this._callButtonAction({
                type: 'action',
                name: 'pos_customer_account.action_customer_account_apply_credit_form',
            });
        },
        _debitButton: function() {
            this._callButtonAction({
                type: 'action',
                name: 'pos_customer_account.action_customer_account_apply_debit_form',
            });
        },
        _bulkImportButton: function() {
            this._callButtonAction({
                type: 'action',
                name: 'pos_customer_account.action_customer_account_bulk_import_form',
            });
        },
    });

    var CustomerAccountTransactionsListView = ListView.extend({
        config: _.extend({}, ListView.prototype.config, {
            Controller: CustomerAccountTransactionsListController,
        }),
    });

    viewRegistry.add('account_move_line_tree', CustomerAccountTransactionsListView);
});
