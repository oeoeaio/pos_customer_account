odoo.define('pos.customer.account.apply_buttons', function (require) {
    "use strict";
    var core = require('web.core');
    var ListController = require('web.ListController');

    ListController.include({
        renderButtons: function($node) {
            this._super.apply(this, arguments);
            if (this.$buttons) {
                let credit_button = this.$buttons.find('.oe_apply_credit_button');
                credit_button && credit_button.click(this.proxy('credit_button'));
                let debit_button = this.$buttons.find('.oe_apply_debit_button');
                debit_button && debit_button.click(this.proxy('debit_button'));
                let bulk_import_button = this.$buttons.find('.oe_bulk_import_button');
                bulk_import_button && bulk_import_button.click(this.proxy('bulk_import_button'));
            }
        },
        credit_button: function() {
            this._callButtonAction({
                type: 'action',
                name: 'pos_customer_account.action_customer_account_apply_credit_form',
            });
        },
        debit_button: function() {
            this._callButtonAction({
                type: 'action',
                name: 'pos_customer_account.action_customer_account_apply_debit_form',
            });
        },
        bulk_import_button: function() {
            this._callButtonAction({
                type: 'action',
                name: 'pos_customer_account.action_customer_account_bulk_import_form',
            });
        },
    });
})
